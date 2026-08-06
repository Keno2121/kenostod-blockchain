'use strict';

/**
 * KENODirectAutoBurnService — Bot Wallet Arb Profits → KENO Burn
 *
 * Flow:
 *   LiveArbBot earns BNB from cross-DEX arb trades on BSC
 *     → 15% of each new profit increment is allocated to the burn queue (Kaprekar Law I)
 *     → When pendingBurnBNB reaches BURN_THRESHOLD_BNB (0.005 BNB), this service:
 *         1. Sends that BNB from the bot wallet to the KENOAutoBurn contract
 *         2. Calls executeBurnAmount(sendWei, minKeno) as AutoBurn owner
 *         → PancakeSwap V2 buys KENO with all contract BNB → burns to 0xdEaD
 *
 * Safety invariants:
 *   - Bot wallet always keeps BOT_RESERVE_BNB (0.10 BNB) for LiveArbBot trades + gas
 *   - Sweep is capped at min(pendingBurnBNB, actualBalance - BOT_RESERVE_BNB)
 *   - Single-flight mutex prevents concurrent double-spend
 *   - pendingBurnBNB is only accumulated from *increases* in LiveArbBot.stats.profitUSD
 *   - Also checks KENOAutoBurn contract BNB balance — if positive, burns that too
 *
 * Required env (scan-only until set):
 *   BOT_WALLET_PRIVATE_KEY — BSC key (owner of AutoBurn, source of burn BNB)
 *
 * All 7 Constitutional Laws active.
 */

const https      = require('https');
const { ethers } = require('ethers');

const Kaprekar    = require('./Kaprekar');
const Euler       = require('./Euler');
const GoldenRatio = require('./GoldenRatio');
const Ramanujan   = require('./Ramanujan');

// ── Chain & Contract Config ────────────────────────────────────────────────────
const BSC_RPC  = process.env.BSC_RPC_PRIMARY || process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/';

const AUTOBURN  = '0x9Fb4f8d4798d9E484c27c6F7571DCaFc82215A79'; // KENOAutoBurn on BSC
const KENO_ADDR = '0x48bb049afe50b050b458624dc6233acd51024ab4'; // KENO v2
const BSC_WBNB  = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const PC_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E'; // PancakeSwap V2

// ── Thresholds ────────────────────────────────────────────────────────────────
const KAPREKAR_BURN_SHARE = 0.15;   // 15% of arb profit → burn (Law I)
const BURN_THRESHOLD_BNB  = 0.005;  // minimum BNB to trigger a sweep (~$2)
const BOT_RESERVE_BNB     = 0.10;   // always keep this in bot wallet for LiveArbBot trades
const GAS_RESERVE_BNB     = 0.005;  // gas headroom for fund + executeBurn txs
const SWEEP_SLIPPAGE      = 0.02;   // 2% slippage on PancakeSwap quote
const POLL_INTERVAL_MS    = 6 * 60 * 60 * 1000; // every 6 hours

// ── ABIs (minimal) ────────────────────────────────────────────────────────────
const AUTOBURN_ABI = [
    'function executeBurnAmount(uint256 bnbAmount, uint256 minKenoOut) external',
    'function executeBurn(uint256 minKenoOut) external',
    'function totalKenoBurned() view returns (uint256)',
    'function totalBnbUsed() view returns (uint256)',
    'function burnCount() view returns (uint256)',
    'event KenoBurned(address indexed triggeredBy, uint256 bnbIn, uint256 kenoBurned, uint256 totalBurned)',
    'receive() external payable',
];

const PC_ROUTER_ABI = [
    'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)',
];

class KENODirectAutoBurnService {
    constructor(liveArbBot) {
        this.arbBot       = liveArbBot;  // reference to LiveArbBot instance
        this.running      = false;
        this.pollTimer    = null;
        this.logs         = [];

        // Accounting — all amounts in BNB
        this.pendingBurnBNB = 0;    // BNB queued for the next burn sweep
        this.totalBurned    = 0;    // cumulative KENO burned via this service
        this.totalBNBUsed   = 0;    // total BNB sent to AutoBurn
        this.sweepCount     = 0;
        this._r1729Hit      = false;

        // Income tracking — only accumulate *increases* in arb profit
        this._lastProfitUSD = null;  // null = not yet seeded
        this._bnbPriceUSD   = 600;   // conservative fallback; refreshed each sweep

        // On-chain stats cache
        this.autoBurnStats    = null;
        this.lastStatsCheck   = null;

        // Concurrency guard
        this._sweepInProgress = false;
    }

    // ── Telegram ──────────────────────────────────────────────────────────────
    _tgToken()  { return process.env.KINGS_SHIELD_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || ''; }
    _tgChatId() { return process.env.SHIELD_ALERT_CHAT_ID   || process.env.FAL_ALERT_CHAT_ID  || ''; }

    _sendTg(text) {
        const token = this._tgToken(), chatId = this._tgChatId();
        if (!token || !chatId) return;
        const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
        const req  = https.request({
            hostname: 'api.telegram.org',
            path:     `/bot${token}/sendMessage`,
            method:   'POST',
            headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        });
        req.on('error', () => {});
        req.write(body); req.end();
    }

    // ── Live-mode check ───────────────────────────────────────────────────────
    _isLive() { return !!process.env.BOT_WALLET_PRIVATE_KEY; }

    // ── Start / Stop ──────────────────────────────────────────────────────────
    start() {
        if (this.running) return { ok: false, msg: 'KENO AutoBurn already running' };
        this.running = true;
        this._log('🔥 KENO Direct AutoBurn Service started');

        this._sendTg(
            '🔥 <b>KENO Direct AutoBurn Service — STARTED</b>\n\n' +
            '⛓ <b>Chain:</b> BNB Chain — bot wallet arb profits → KENOAutoBurn\n' +
            `💵 <b>Burn allocation:</b> ${KAPREKAR_BURN_SHARE * 100}% of LiveArbBot profits (Kaprekar Law I)\n` +
            `🎯 <b>Trigger threshold:</b> ${BURN_THRESHOLD_BNB} BNB pending\n` +
            `🛡 <b>Bot reserve:</b> ${BOT_RESERVE_BNB} BNB always kept for arb trading\n` +
            `⏱ <b>Poll interval:</b> Every 6 hours\n` +
            `⚡ <b>Mode:</b> ${this._isLive() ? 'LIVE — auto-burn from bot wallet 🔴' : 'SCAN-ONLY 🟡'}\n` +
            `🎯 <b>AutoBurn contract:</b> <code>${AUTOBURN}</code> (BSC)\n` +
            '📐 <b>Laws:</b> Kaprekar 15% · Euler compound · φ allocation · Ramanujan 1,729'
        );

        // Run once immediately, then on interval
        this._poll();
        this.pollTimer = setInterval(() => this._poll(), POLL_INTERVAL_MS);
        return { ok: true, msg: 'KENO Direct AutoBurn Service started — polling every 6 hours' };
    }

    stop() {
        if (!this.running) return { ok: false, msg: 'Not running' };
        this.running = false;
        clearInterval(this.pollTimer); this.pollTimer = null;
        this._log('🛑 KENO AutoBurn Service stopped');
        return { ok: true, msg: 'KENO AutoBurn Service stopped' };
    }

    // ── Main Poll ─────────────────────────────────────────────────────────────
    async _poll() {
        if (!this.running) return;

        // 1. Sync arb profit from LiveArbBot
        await this._syncArbProfit();

        // 2. Check AutoBurn contract on-chain (has it accumulated BNB from other sources?)
        await this._checkAutoBurnContract();

        // 3. Sweep if threshold met
        if (this.pendingBurnBNB >= BURN_THRESHOLD_BNB) {
            await this._executeSweep();
        } else {
            this._log(
                `⏳ Pending: ${this.pendingBurnBNB.toFixed(6)} BNB` +
                ` (threshold: ${BURN_THRESHOLD_BNB} BNB)` +
                (this._lastProfitUSD === null ? ' — awaiting first profit reading' : '')
            );
        }
    }

    // ── Step 1: Sync arb profit delta from LiveArbBot ─────────────────────────
    // SAFETY: First call seeds the baseline; only increases after that trigger burns.
    async _syncArbProfit() {
        try {
            const status   = this.arbBot ? this.arbBot.getStatus() : null;
            const profitUSD = status?.stats?.profitUSD ?? 0;

            // First poll: seed baseline — no burn accumulated for historical profit
            if (this._lastProfitUSD === null) {
                this._lastProfitUSD = profitUSD;
                this._log(`📊 Arb profit baseline seeded at $${profitUSD.toFixed(4)} — only new profits from here fund burns`);
                return;
            }

            if (profitUSD <= this._lastProfitUSD) return;

            const delta = profitUSD - this._lastProfitUSD;
            this._lastProfitUSD = profitUSD;

            await this._refreshBNBPrice();

            // ── Law I: Kaprekar — 15% burn, 60% founder, 25% reinvest ────────
            const burnSliceUSD    = delta * KAPREKAR_BURN_SHARE;
            const founderSliceUSD = delta * 0.60;
            const reinvSliceUSD   = delta * 0.25;
            const burnSliceBNB    = burnSliceUSD / this._bnbPriceUSD;

            this.pendingBurnBNB += burnSliceBNB;

            // ── Law III: Golden Ratio ─────────────────────────────────────────
            let phiNote = '';
            try {
                if (GoldenRatio.phiMultiplier) {
                    const phi = GoldenRatio.phiMultiplier(this.sweepCount + 1);
                    phiNote   = ` | φ-tier-${this.sweepCount + 1}: ${phi.toFixed(4)}`;
                }
            } catch (_) {}

            // ── Law V: Euler — 30-day compound projection ─────────────────────
            let euler30d = 0;
            try {
                if (Euler.continuousEarnings && profitUSD > 0) {
                    euler30d = Euler.continuousEarnings(profitUSD, KAPREKAR_BURN_SHARE, 30 / 365);
                }
            } catch (_) {}

            this._log(`💵 New arb profit: +$${delta.toFixed(4)} | burn share: ${burnSliceBNB.toFixed(6)} BNB | pending: ${this.pendingBurnBNB.toFixed(6)} BNB${phiNote}`);
            this._log(`📐 Kaprekar: pocket $${founderSliceUSD.toFixed(4)} · reinvest $${reinvSliceUSD.toFixed(4)} · burn $${burnSliceUSD.toFixed(4)} (~${burnSliceBNB.toFixed(6)} BNB)`);
            if (euler30d > 0) {
                this._log(`📐 Euler 30d burn projection: ${(euler30d / this._bnbPriceUSD).toFixed(6)} BNB from $${profitUSD.toFixed(2)} total arb`);
            }
        } catch (e) {
            this._log(`⚠ Arb profit sync error: ${e.message}`, 'warn');
        }
    }

    // ── Step 2: Check AutoBurn contract BNB balance ───────────────────────────
    // If the contract already holds BNB (manual sends, other sweeps), add it
    // to the pending queue so it gets burned on the next sweep cycle.
    async _checkAutoBurnContract() {
        try {
            const provider     = new ethers.JsonRpcProvider(BSC_RPC);
            const contractBal  = await provider.getBalance(AUTOBURN);
            const contractBNB  = parseFloat(ethers.formatEther(contractBal));

            const [burnedWei, bnbUsedWei, burnCountBN] = await Promise.all([
                new ethers.Contract(AUTOBURN, AUTOBURN_ABI, provider).totalKenoBurned(),
                new ethers.Contract(AUTOBURN, AUTOBURN_ABI, provider).totalBnbUsed(),
                new ethers.Contract(AUTOBURN, AUTOBURN_ABI, provider).burnCount(),
            ]);

            this.autoBurnStats = {
                totalKenoBurned: parseFloat(ethers.formatEther(burnedWei)),
                totalBnbUsed:    parseFloat(ethers.formatEther(bnbUsedWei)),
                burnCount:       Number(burnCountBN),
                contractBNB,
            };
            this.lastStatsCheck = new Date().toISOString();

            this._log(`🔥 AutoBurn: ${this.autoBurnStats.totalKenoBurned.toFixed(4)} KENO burned | ${this.autoBurnStats.burnCount} events | ${contractBNB.toFixed(6)} BNB in contract`);

            // If the contract itself holds unburned BNB (from external sends),
            // queue it for the next burn without counting against bot wallet balance.
            if (contractBNB >= BURN_THRESHOLD_BNB) {
                this._log(`💡 Contract holds ${contractBNB.toFixed(6)} BNB — will burn on next sweep`);
                // Force a sweep on this cycle even if pendingBurnBNB is low
                this.pendingBurnBNB = Math.max(this.pendingBurnBNB, contractBNB);
            }
        } catch (e) {
            this._log(`⚠ AutoBurn contract check error: ${e.message}`, 'warn');
        }
    }

    // ── Step 3: Execute Sweep ─────────────────────────────────────────────────
    async _executeSweep() {
        if (this._sweepInProgress) {
            this._log('⚠ Sweep already in progress — skipping', 'warn');
            return;
        }
        this._sweepInProgress = true;

        const allocatedBNB  = this.pendingBurnBNB;
        this.pendingBurnBNB = 0;
        let spentBNB        = 0;

        this._log(`🚀 Sweep triggered: ${allocatedBNB.toFixed(6)} BNB allocated for burn`);

        if (!this._isLive()) {
            this.pendingBurnBNB = allocatedBNB; // restore for scan-only
            this._sweepInProgress = false;
            await this._sendSweepAlert(allocatedBNB);
            return;
        }

        try {
            const provider  = new ethers.JsonRpcProvider(BSC_RPC);
            const rawKey    = process.env.BOT_WALLET_PRIVATE_KEY || '';
            const botKey    = rawKey.startsWith('0x') ? rawKey : '0x' + rawKey;
            const botSigner = new ethers.Wallet(botKey, provider);
            const GAS_PRICE = ethers.parseUnits('3', 'gwei');

            // Check actual bot wallet balance
            const botBal      = await provider.getBalance(botSigner.address);
            const botFloat    = parseFloat(ethers.formatEther(botBal));
            const safeFloor   = BOT_RESERVE_BNB + GAS_RESERVE_BNB; // 0.105 BNB floor
            const availableForBurn = botFloat - safeFloor;

            this._log(`💰 Bot wallet: ${botFloat.toFixed(6)} BNB | safe floor: ${safeFloor} BNB | available for burn: ${availableForBurn.toFixed(6)} BNB`);

            // Check how much BNB is already sitting in the AutoBurn contract
            const contractBal = await provider.getBalance(AUTOBURN);
            const contractBNB = parseFloat(ethers.formatEther(contractBal));

            // If the contract already has enough BNB, skip the fund step
            if (contractBNB >= BURN_THRESHOLD_BNB) {
                this._log(`💡 Contract already holds ${contractBNB.toFixed(6)} BNB — skipping fund step, burning directly`);
                await this._callExecuteBurn(botSigner, provider, contractBNB, GAS_PRICE);
                spentBNB = contractBNB;
            } else {
                // Need to send BNB from bot wallet to contract
                if (availableForBurn < BURN_THRESHOLD_BNB * 0.5) {
                    this._log(`⚠ Bot wallet too low to burn (have ${botFloat.toFixed(6)} BNB, need >${safeFloor} BNB floor + ${BURN_THRESHOLD_BNB} BNB) — deferring`, 'warn');
                    this._sendTg(
                        `⚠️ <b>KENO AutoBurn — Deferred</b>\n\n` +
                        `Bot wallet balance too low to spare BNB for burn.\n` +
                        `Balance: ${botFloat.toFixed(6)} BNB | Floor: ${safeFloor} BNB | Queued: ${allocatedBNB.toFixed(6)} BNB\n` +
                        `Waiting for arb profits to build up the wallet.`
                    );
                    return; // finally block restores pendingBurnBNB
                }

                // Cap send at the lesser of allocated amount and available balance
                const sendBNB = Math.min(allocatedBNB, availableForBurn);
                const sendWei = ethers.parseEther(sendBNB.toFixed(18));

                this._log(`🔗 Step 1/2: Sending ${sendBNB.toFixed(6)} BNB from bot wallet to AutoBurn contract`);
                const fundTx = await botSigner.sendTransaction({
                    to:       AUTOBURN,
                    value:    sendWei,
                    gasLimit: 50_000n,
                    gasPrice: GAS_PRICE,
                });
                const fundReceipt = await fundTx.wait();
                this._log(`✅ Funded AutoBurn: ${fundReceipt.hash}`);

                const totalInContract = sendBNB + contractBNB;
                await this._callExecuteBurn(botSigner, provider, totalInContract, GAS_PRICE);
                spentBNB = sendBNB;

                // Return unspent allocation
                const unspent = allocatedBNB - sendBNB;
                if (unspent > 0.000001) this.pendingBurnBNB += unspent;
            }

            this.sweepCount++;
            this.totalBNBUsed += spentBNB;

            // ── Law VI: Ramanujan milestone ───────────────────────────────────
            if (!this._r1729Hit && this.totalBurned >= 1729) {
                this._r1729Hit = true;
                this._sendTg(
                    '🏛 <b>Ramanujan Milestone — 1,729 KENO Burned via Arb Profits</b>\n\n' +
                    'LiveArbBot profits have now funded the burning of 1,729 KENO. The Hardy-Ramanujan number. 🔑'
                );
            }

        } catch (e) {
            this._log(`🔴 Sweep error: ${e.message}`, 'error');
            this._sendTg(
                `⚠️ <b>KENO AutoBurn — Sweep Error</b>\n\n` +
                `Error: ${e.message.slice(0, 200)}\n` +
                `Pending burn: ${allocatedBNB.toFixed(6)} BNB\n` +
                `Manual: send BNB to <code>${AUTOBURN}</code> then call executeBurnAmount()`
            );
        } finally {
            if (spentBNB === 0) this.pendingBurnBNB += allocatedBNB; // restore on failure
            this._sweepInProgress = false;
        }
    }

    // ── Sub-step: call executeBurnAmount on the contract ─────────────────────
    async _callExecuteBurn(botSigner, provider, contractBNB, gasPrice) {
        this._log(`🔗 Step 2/2: Calling executeBurn() — ${contractBNB.toFixed(6)} BNB in contract → KENO → 0xdEaD`);

        const contract    = new ethers.Contract(AUTOBURN, AUTOBURN_ABI, botSigner);
        const totalWei    = ethers.parseEther(contractBNB.toFixed(18));

        // Get PancakeSwap quote for min KENO out
        let minKeno = 0n;
        try {
            const router = new ethers.Contract(PC_ROUTER, PC_ROUTER_ABI, provider);
            const amts   = await router.getAmountsOut(totalWei, [BSC_WBNB, KENO_ADDR]);
            minKeno      = amts[1] * BigInt(Math.floor((1 - SWEEP_SLIPPAGE) * 100)) / 100n;
            this._log(`💱 PancakeSwap quote: ${ethers.formatEther(amts[1])} KENO for ${contractBNB.toFixed(6)} BNB (min with ${SWEEP_SLIPPAGE * 100}% slippage: ${ethers.formatEther(minKeno)})`);
        } catch (e) {
            this._log(`⚠ Quote failed — proceeding with minKeno=0: ${e.message}`, 'warn');
        }

        const burnTx      = await contract.executeBurn(minKeno, { gasLimit: 350_000n, gasPrice });
        const burnReceipt = await burnTx.wait();
        this._log(`🔥 executeBurn TX: ${burnReceipt.hash}`);

        // Parse KenoBurned event to get exact KENO burned this sweep
        let kenoThisBurn = 0;
        const topic = contract.interface.getEvent('KenoBurned').topicHash;
        for (const log of burnReceipt.logs) {
            if (log.topics[0] === topic) {
                try {
                    const parsed = contract.interface.parseLog(log);
                    kenoThisBurn = parseFloat(ethers.formatEther(parsed.args.kenoBurned));
                    this._log(`🔥 KenoBurned event: ${kenoThisBurn.toFixed(4)} KENO burned for ${ethers.formatEther(parsed.args.bnbIn)} BNB`);
                } catch (_) {}
                break;
            }
        }

        this.totalBurned += kenoThisBurn;

        this._sendTg(
            `🔥 <b>KENO AutoBurn — Arb Profits → Burn Complete!</b>\n\n` +
            `⛓ Source: LiveArbBot arb profits (bot wallet) → KENOAutoBurn (BSC)\n` +
            `💰 BNB used: <b>${contractBNB.toFixed(6)} BNB</b>\n` +
            `🔥 KENO burned: <b>${kenoThisBurn.toFixed(4)} KENO</b> → 0xdEaD\n` +
            `📊 Cumulative via arb profits: ${this.totalBurned.toFixed(4)} KENO (${this.sweepCount + 1} sweeps)\n` +
            `🔗 Burn TX: <code>${burnReceipt.hash}</code>\n` +
            `🎯 AutoBurn: <code>${AUTOBURN}</code> (BSC)\n\n` +
            `<i>Every trade we make, KENO supply shrinks. Law VII: we receive.</i>`
        );
    }

    // ── Scan-Only Alert ───────────────────────────────────────────────────────
    async _sendSweepAlert(amountBNB) {
        let eulerLine = '';
        try {
            if (Euler.continuousEarnings && amountBNB > 0) {
                const usdVal = amountBNB * this._bnbPriceUSD;
                const p30    = Euler.continuousEarnings(usdVal, KAPREKAR_BURN_SHARE, 30 / 365);
                eulerLine    = `\n📐 Euler 30d projection on burn capital: $${p30.toFixed(4)}`;
            }
        } catch (_) {}

        this._sendTg(
            `🔥 <b>KENO AutoBurn — Sweep Ready (scan-only)</b>\n\n` +
            `💰 Burn allocation: <b>${amountBNB.toFixed(6)} BNB</b> (~$${(amountBNB * this._bnbPriceUSD).toFixed(2)})\n` +
            `📍 Source: Bot wallet arb profits\n` +
            `🎯 Destination: KENOAutoBurn <code>${AUTOBURN}</code>\n\n` +
            `<b>Manual steps:</b>\n` +
            `1. Send ${amountBNB.toFixed(6)} BNB to <code>${AUTOBURN}</code>\n` +
            `2. Call executeBurn(0) from bot wallet\n\n` +
            `⚡ <b>BOT_WALLET_PRIVATE_KEY must be set to automate this</b>` +
            eulerLine
        );
    }

    // ── BNB price refresh ─────────────────────────────────────────────────────
    async _refreshBNBPrice() {
        try {
            const BSC_USDT = '0x55d398326f99059fF775485246999027B3197955';
            const provider = new ethers.JsonRpcProvider(BSC_RPC);
            const router   = new ethers.Contract(PC_ROUTER, PC_ROUTER_ABI, provider);
            const amts     = await router.getAmountsOut(ethers.parseEther('1'), [BSC_WBNB, BSC_USDT]);
            const price    = parseFloat(ethers.formatUnits(amts[1], 18));
            if (price > 50 && price < 10000) {
                this._bnbPriceUSD = price;
                this._log(`💱 BNB price: $${price.toFixed(2)}`);
            }
        } catch (_) {} // non-critical
    }

    // ── Manual trigger from API ───────────────────────────────────────────────
    async triggerManualSweep() {
        if (this.pendingBurnBNB < BURN_THRESHOLD_BNB * 0.1) {
            // Still allow if contract has BNB sitting there
            const provider    = new ethers.JsonRpcProvider(BSC_RPC);
            const contractBal = await provider.getBalance(AUTOBURN).catch(() => 0n);
            const contractBNB = parseFloat(ethers.formatEther(contractBal));
            if (contractBNB < BURN_THRESHOLD_BNB * 0.5) {
                return {
                    ok:  false,
                    msg: `Nothing to sweep — pending: ${this.pendingBurnBNB.toFixed(6)} BNB, contract: ${contractBNB.toFixed(6)} BNB`,
                };
            }
            // Force queue the contract balance
            this.pendingBurnBNB = Math.max(this.pendingBurnBNB, contractBNB);
        }
        await this._executeSweep();
        return { ok: true, msg: `Manual sweep triggered — queued: ${this.pendingBurnBNB.toFixed(6)} BNB` };
    }

    // ── Logger ────────────────────────────────────────────────────────────────
    _log(msg, level = 'info') {
        const entry = { time: new Date().toISOString(), msg, level };
        this.logs.unshift(entry);
        if (this.logs.length > 200) this.logs.pop();
        const icon = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🔥';
        console.log(`[KENOAutoBurn] ${icon} ${msg}`);
    }

    // ── Status ────────────────────────────────────────────────────────────────
    getStatus() {
        return {
            running:          this.running,
            pendingBurnBNB:   this.pendingBurnBNB,
            totalBurned:      this.totalBurned,
            totalBNBUsed:     this.totalBNBUsed,
            sweepCount:       this.sweepCount,
            autoBurnContract: AUTOBURN,
            autoBurnStats:    this.autoBurnStats,
            lastStatsCheck:   this.lastStatsCheck,
            liveMode:         this._isLive(),
            threshold:        BURN_THRESHOLD_BNB,
            botReserve:       BOT_RESERVE_BNB,
            burnShare:        KAPREKAR_BURN_SHARE,
            pollIntervalHours: POLL_INTERVAL_MS / 3_600_000,
            recentLogs:       this.logs.slice(0, 50),
        };
    }
}

module.exports = KENODirectAutoBurnService;

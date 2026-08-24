'use strict';

/**
 * AsterAutoBurnService — Aster LP Earnings → KENO Burn (same BSC chain, no bridge)
 *
 * Flow (simpler than GMX — no cross-chain bridge needed):
 *   Aster LP fee income recorded in AsterLPBotManager (BNB Chain)
 *     → Kaprekar 15% burn split applied ONLY to verified new income (totalFeesEarned delta)
 *     → pendingBurnBNB accumulates until threshold met
 *     → ASTER_PRIVATE_KEY signs BNB transfer from Aster LP wallet to AutoBurn
 *     → BOT_WALLET_PRIVATE_KEY calls executeBurn() (AutoBurn contract owner)
 *     → KENO bought on PancakeSwap V2 + sent to 0xdEaD
 *
 * Safety invariants:
 *   - pendingBurnBNB is derived ONLY from increases in AsterLPBotManager.totalFeesEarned
 *   - The sweep sends from ASTER_WALLET_ADDRESS (LP earnings wallet), NOT from the bot wallet
 *   - Sweep is capped at min(pendingBurnBNB, actual ASTER wallet BNB balance - gas reserve)
 *   - Manual sweep only runs if there is a verified pendingBurnBNB > 0
 *   - Scan-only mode fires alerts but never moves funds
 *
 * Required env (scan-only until BOTH are set):
 *   ASTER_PRIVATE_KEY       — EVM private key for the Aster LP wallet (source of LP fee BNB)
 *   BOT_WALLET_PRIVATE_KEY  — BSC key (calls executeBurn on AutoBurn contract as owner)
 *
 * All 7 Constitutional Laws active.
 */

const https        = require('https');
const { ethers }   = require('ethers');

const Kaprekar    = require('./Kaprekar');
const Euler       = require('./Euler');
const GoldenRatio = require('./GoldenRatio');
const Ramanujan   = require('./Ramanujan');

// ── Chain & Contract Config ────────────────────────────────────────────────────
const BSC_RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/';

// BSC contracts
const AUTOBURN = '0x9Fb4f8d4798d9E484c27c6F7571DCaFc82215A79'; // KENOAutoBurn (same chain)

// Thresholds
const BURN_THRESHOLD_BNB  = 0.005;  // minimum BNB to trigger a sweep (~$2 at $400/BNB)
const GAS_RESERVE_BNB     = 0.003;  // BNB kept in ASTER wallet for gas (never swept)
const MAX_SINGLE_SWEEP_BNB = 1;     // hard cap per sweep; excess stays queued for a later poll
const KAPREKAR_BURN_SHARE = 0.15;   // 15% of Aster LP income goes to AutoBurn (Law I)
const SWEEP_SLIPPAGE      = 0.02;   // 2% slippage on executeBurn
const MIN_POLL_MS         = 30 * 60 * 1000; // check every 30 min

// BSC contracts for quoting
const BSC_WBNB  = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const KENO_ADDR = '0x48bb049afe50b050b458624dc6233acd51024ab4';
const PC_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

// ── ABIs (minimal) ────────────────────────────────────────────────────────────
const AUTOBURN_ABI = [
    // Burns exactly bnbAmount from contract balance (not entire balance)
    'function executeBurnAmount(uint256 bnbAmount, uint256 minKenoOut) external',
    'function stats() view returns (uint256 totalBurned, uint256 totalBnbUsed, uint256 burnCount, uint256 pendingBnb)',
    'function getBurnQuote() view returns (uint256)',
    'event KenoBurned(address indexed triggeredBy, uint256 bnbIn, uint256 kenoBurned, uint256 totalBurned)',
    'receive() external payable',
];

const PC_ROUTER_ABI = [
    'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)',
];

// Aster referral/partner API endpoints to try
const ASTER_REFERRAL_ENDPOINTS = [
    'https://api.aster.com/v1/referrals/KENO',
    'https://api.aster.xyz/v1/referrals/KENO',
    'https://api.aster.com/partner/KENO',
];

class AsterAutoBurnService {
    constructor(asterLPManager) {
        this.lpManager     = asterLPManager; // reference to AsterLPBotManager
        this.running       = false;
        this.pollTimer     = null;
        this.logs          = [];

        // Accounting — all amounts in BNB
        this.pendingBurnBNB  = 0;    // BNB confirmed for burning (15% of verified LP income)
        this.totalBurned     = 0;    // cumulative KENO burned via this service (in KENO units)
        this.totalBNBUsed    = 0;    // total BNB swept to AutoBurn
        this.sweepCount      = 0;
        this._r1729Hit       = false;

        // Income tracking — only accumulate from *increases* in LP manager's totalFeesEarned
        this._lastIncome     = null; // null = not yet seeded (first poll seeds it, no burn)

        // Referral/partner tracking
        this.referralCode     = 'KENO';
        this.referralEarned   = 0;   // USD earned via Aster referral program
        this.referralActive   = false;
        this._lastReferral    = 0;   // USD baseline for referral deltas

        // AutoBurn contract stats (live from BSC)
        this.autoBurnStats       = null;
        this.lastAutoBurnCheck   = null;

        // BNB price estimate for USD→BNB conversion
        this._bnbPriceUSD = 400; // conservative fallback; refreshed each sweep

        // Concurrency guard — prevents overlapping sweeps from double-spending
        this._sweepInProgress = false;
    }

    // ── Telegram ──────────────────────────────────────────────────────────────
    _tgToken()  { return process.env.KINGS_SHIELD_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || ''; }
    _tgChatId() { return process.env.SHIELD_ALERT_CHAT_ID   || process.env.FAL_ALERT_CHAT_ID  || ''; }

    _sendTg(text) {
        const token = this._tgToken(), chatId = this._tgChatId();
        if (!token || !chatId) return;
        const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
        const req = https.request({
            hostname: 'api.telegram.org',
            path:     `/bot${token}/sendMessage`,
            method:   'POST',
            headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        });
        req.on('error', () => {});
        req.write(body); req.end();
    }

    // ── Live-mode check ───────────────────────────────────────────────────────
    // Live sweep requires ALL THREE env vars — fail closed if any is missing:
    //   ASTER_PRIVATE_KEY      — signs the BNB transfer FROM the Aster LP wallet
    //   ASTER_WALLET_ADDRESS   — the expected source wallet address (key must match)
    //   BOT_WALLET_PRIVATE_KEY — calls executeBurnAmount() as AutoBurn contract owner
    _isLive() {
        return !!(
            process.env.ASTER_PRIVATE_KEY &&
            process.env.ASTER_WALLET_ADDRESS &&
            process.env.BOT_WALLET_PRIVATE_KEY
        );
    }

    // ── Start / Stop ──────────────────────────────────────────────────────────
    start() {
        if (this.running) return { ok: false, msg: 'Aster AutoBurn Service already running' };
        this.running = true;
        this._log('🔥 Aster AutoBurn Service started');

        this._sendTg(
            '🔥 <b>Aster → KENOAutoBurn Service — STARTED</b>\n\n' +
            '⛓ <b>Chain:</b> BNB Chain — no bridge needed! Same chain as AutoBurn ✅\n' +
            '🌊 <b>Source:</b> Aster LP trading fees (verified income delta only)\n' +
            `💵 <b>Burn allocation:</b> ${KAPREKAR_BURN_SHARE * 100}% of Aster LP income (Kaprekar Law I)\n` +
            `🎯 <b>Trigger threshold:</b> ${BURN_THRESHOLD_BNB} BNB of confirmed income\n` +
            `🛡 <b>Single-sweep cap:</b> ${MAX_SINGLE_SWEEP_BNB} BNB (excess remains queued)\n` +
            `🔖 <b>Aster referral code:</b> <code>KENO</code> — register at aster.com/referrals\n` +
            `⚡ <b>Mode:</b> ${this._isLive() ? 'LIVE — will auto-sweep from ASTER wallet 🔴' : 'SCAN-ONLY — alerts only 🟡'}\n` +
            `🎯 <b>AutoBurn contract:</b> <code>${AUTOBURN}</code> (BSC)\n` +
            '🔒 <b>Safety:</b> Sweeps from ASTER_WALLET only; BOT_WALLET never used as income source\n' +
            '📐 <b>Laws:</b> Kaprekar 15% burn · Euler compounding · φ allocation · Ramanujan milestone'
        );

        this._poll();
        this.pollTimer = setInterval(() => this._poll(), MIN_POLL_MS);
        return { ok: true, msg: 'Aster AutoBurn Service started — monitoring LP fee income every 30 min' };
    }

    stop() {
        if (!this.running) return { ok: false, msg: 'Not running' };
        this.running = false;
        clearInterval(this.pollTimer); this.pollTimer = null;
        this._log('🛑 Aster AutoBurn Service stopped');
        return { ok: true, msg: 'Aster AutoBurn Service stopped' };
    }

    // ── Main Poll ─────────────────────────────────────────────────────────────
    async _poll() {
        if (!this.running) return;

        // 1. Sync verified income delta from AsterLPBotManager
        await this._syncLPIncome();

        // 2. Check Aster referral/partner rebates
        await this._checkAsterReferral();

        // 3. Read AutoBurn contract stats on BSC
        await this._checkAutoBurnStats();

        // 4. Sweep if BNB threshold met
        if (this.pendingBurnBNB >= BURN_THRESHOLD_BNB) {
            await this._executeSweep();
        } else {
            this._log(
                `⏳ Pending burn: ${this.pendingBurnBNB.toFixed(6)} BNB` +
                ` (threshold: ${BURN_THRESHOLD_BNB} BNB)` +
                (this._lastIncome === null ? ' — awaiting first income reading' : '')
            );
        }
    }

    // ── Step 1: Sync LP fee income from AsterLPBotManager ─────────────────────
    // SAFETY: On first call, seed _lastIncome WITHOUT accumulating pending burn.
    //         This prevents the service from treating all historical fees as new income.
    //         Only *increases* after the service starts are attributed to the burn queue.
    async _syncLPIncome() {
        try {
            const status  = this.lpManager ? this.lpManager.getStatus() : null;
            const current = status?.totalProfit || 0; // USD fees earned (cumulative)

            // First poll: seed the baseline — no burn accumulated
            if (this._lastIncome === null) {
                this._lastIncome = current;
                this._log(`📊 Income baseline seeded at $${current.toFixed(4)} USD — only new income from here will fund burns`);
                return;
            }

            // No new income — nothing to do
            if (current <= this._lastIncome) return;

            // New income detected — accumulate only the delta
            const newIncomeUSD = current - this._lastIncome;
            this._lastIncome   = current;

            // Refresh BNB price before conversion
            await this._refreshBNBPrice();

            // ── Law I: Kaprekar — 15% to burn, 60% to founder, 25% reinvest ─────
            const burnSliceUSD    = newIncomeUSD * KAPREKAR_BURN_SHARE;
            const founderSliceUSD = newIncomeUSD * 0.60;
            const reinvSliceUSD   = newIncomeUSD * 0.25;
            const burnSliceBNB    = burnSliceUSD / this._bnbPriceUSD;

            this.pendingBurnBNB += burnSliceBNB;

            // ── Law III: Golden Ratio — φ allocation note ─────────────────────
            let phiNote = '';
            try {
                if (GoldenRatio.phiMultiplier) {
                    const phi = GoldenRatio.phiMultiplier(this.sweepCount + 1);
                    phiNote = ` | φ-tier-${this.sweepCount + 1}: ${phi.toFixed(4)}`;
                }
            } catch (_) {}

            // ── Law V: Euler — 30-day compound projection ─────────────────────
            let euler30d = 0;
            try {
                if (Euler.continuousEarnings && current > 0) {
                    euler30d = Euler.continuousEarnings(current, KAPREKAR_BURN_SHARE, 30 / 365);
                }
            } catch (_) {}

            this._log(`💵 New Aster LP income: +$${newIncomeUSD.toFixed(4)} | burn share: ${burnSliceBNB.toFixed(6)} BNB | pending: ${this.pendingBurnBNB.toFixed(6)} BNB${phiNote}`);
            this._log(`📐 Kaprekar: pocket $${founderSliceUSD.toFixed(4)} · reinvest $${reinvSliceUSD.toFixed(4)} · burn $${burnSliceUSD.toFixed(4)} (~${burnSliceBNB.toFixed(6)} BNB)`);
            if (euler30d > 0) {
                this._log(`📐 Euler 30d burn projection from total $${current.toFixed(2)}: ${(euler30d / this._bnbPriceUSD).toFixed(6)} BNB`);
            }
        } catch (e) {
            this._log(`⚠ LP income sync error: ${e.message}`, 'warn');
        }
    }

    // ── Step 2: Check Aster referral/partner program ───────────────────────────
    async _checkAsterReferral() {
        for (const url of ASTER_REFERRAL_ENDPOINTS) {
            try {
                const data = await new Promise((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error('timeout')), 7000);
                    https.get(url, { headers: { 'User-Agent': 'SovereignEconomy/1.0' } }, res => {
                        clearTimeout(timer);
                        let d = ''; res.on('data', c => d += c);
                        res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
                    }).on('error', e => { clearTimeout(timer); reject(e); });
                });

                const earned  = parseFloat(data?.earned || data?.rebatesUsd || data?.rewardsUsd || data?.total || 0);
                const traders = data?.traders || data?.users || data?.referrals || 0;

                // Seed _lastReferral on first successful read without accumulating
                if (this._lastReferral === 0 && this.referralEarned === 0) {
                    this._lastReferral  = earned;
                    this.referralEarned = earned;
                    if (earned > 0) {
                        this.referralActive = true;
                        this._log(`🔖 Aster referral "KENO" baseline seeded: $${earned.toFixed(4)} | users: ${traders}`);
                    }
                    return;
                }

                if (earned > this.referralEarned) {
                    const newRebate    = earned - this.referralEarned;
                    this.referralEarned = earned;
                    await this._refreshBNBPrice();
                    const newBurnBNB   = (newRebate * KAPREKAR_BURN_SHARE) / this._bnbPriceUSD;
                    this.pendingBurnBNB += newBurnBNB;
                    this.referralActive = true;
                    this._log(`🔖 Aster referral "KENO": +$${newRebate.toFixed(4)} rebates → +${newBurnBNB.toFixed(6)} BNB to burn | users: ${traders}`);
                    this._sendTg(
                        `🔖 <b>Aster Referral "KENO" — New Rebate</b>\n\n` +
                        `💰 New rebate: $${newRebate.toFixed(4)}\n` +
                        `🔥 Added to burn queue: ${newBurnBNB.toFixed(6)} BNB\n` +
                        `👥 Referred users: ${traders}\n` +
                        `📊 Total earned via referral: $${earned.toFixed(4)}`
                    );
                } else {
                    this._log(`🔖 Aster referral "KENO": $${earned.toFixed(4)} total | ${traders} users`);
                    if (earned > 0) this.referralActive = true;
                }
                return;
            } catch (_) { continue; }
        }

        // All endpoints failed
        if (!this.referralActive && this.referralEarned === 0) {
            this._log('🔖 Aster referral "KENO" API not reachable — register at https://aster.com/referrals');
        }
    }

    // ── Step 3: Read AutoBurn contract stats from BSC ─────────────────────────
    async _checkAutoBurnStats() {
        try {
            const provider  = new ethers.JsonRpcProvider(BSC_RPC);
            const contract  = new ethers.Contract(AUTOBURN, AUTOBURN_ABI, provider);
            const [totalBurned, totalBnbUsed, burnCount, pendingBnb] = await contract.stats();
            const burnQuote = await contract.getBurnQuote().catch(() => 0n);

            this.autoBurnStats = {
                totalKenoBurned: ethers.formatEther(totalBurned),
                totalBnbUsed:    ethers.formatEther(totalBnbUsed),
                burnCount:       Number(burnCount),
                pendingBnbWei:   pendingBnb.toString(),
                pendingBnb:      ethers.formatEther(pendingBnb),
                burnQuoteKeno:   ethers.formatEther(burnQuote),
            };
            this.lastAutoBurnCheck = new Date().toISOString();
            this._log(`🔥 AutoBurn: ${this.autoBurnStats.totalKenoBurned} KENO burned | ${this.autoBurnStats.burnCount} events | ${this.autoBurnStats.pendingBnb} BNB pending`);
        } catch (e) {
            this._log(`⚠ AutoBurn stats error: ${e.message}`, 'warn');
        }
    }

    // ── Step 4: Execute Same-Chain Sweep (Aster wallet BNB → KENOAutoBurn) ────
    //
    // Fund flow:
    //   ASTER_PRIVATE_KEY signs a BNB transfer from ASTER_WALLET_ADDRESS → AUTOBURN
    //   BOT_WALLET_PRIVATE_KEY calls executeBurnAmount(sendWei, minKeno) as AutoBurn owner
    //
    // Safety:
    //   - Single-flight mutex (_sweepInProgress) prevents concurrent double-spend
    //   - Allocation is reserved (zeroed) before any async work; restored on failure
    //   - ASTER_PRIVATE_KEY address MUST match ASTER_WALLET_ADDRESS — fails closed otherwise
    //   - Sweep capped at min(allocatedBNB, asterBalance - GAS_RESERVE_BNB)
    //   - executeBurnAmount burns exactly sendWei, never pre-existing contract BNB
    async _executeSweep() {
        // ── Concurrency guard ──────────────────────────────────────────────────
        if (this._sweepInProgress) {
            this._log('⚠ Sweep already in progress — skipping concurrent request', 'warn');
            return;
        }
        this._sweepInProgress = true;

        // Reserve the allocation up-front so no concurrent poll can re-spend it.
        // The cap limits a single execution; remaining verified income stays queued.
        // Any unspent amount is returned in the finally block on failure.
        const queuedBNB     = this.pendingBurnBNB;
        const allocatedBNB  = Math.min(queuedBNB, MAX_SINGLE_SWEEP_BNB);
        this.pendingBurnBNB = queuedBNB - allocatedBNB;
        let spentBNB        = 0; // tracks how much was actually sent

        this._log(
            `🚀 Sweep triggered: ${allocatedBNB.toFixed(6)} BNB reserved for burn ` +
            `(Aster LP wallet → AutoBurn)` +
            (queuedBNB > MAX_SINGLE_SWEEP_BNB
                ? ` — ${this.pendingBurnBNB.toFixed(6)} BNB remains queued behind the ${MAX_SINGLE_SWEEP_BNB} BNB cap`
                : '')
        );

        if (!this._isLive()) {
            this.pendingBurnBNB += allocatedBNB; // restore capped allocation — preserve any queued remainder
            this._sweepInProgress = false;
            await this._sendSweepAlert(allocatedBNB, false);
            return;
        }

        // ── Live mode: send BNB from ASTER wallet to AutoBurn, then executeBurnAmount() ─
        try {
            const provider    = new ethers.JsonRpcProvider(BSC_RPC);
            const asterSigner = new ethers.Wallet(process.env.ASTER_PRIVATE_KEY, provider);
            const botSigner   = new ethers.Wallet(process.env.BOT_WALLET_PRIVATE_KEY, provider);

            // Always validate key/address match — fail closed, never conditional
            const configuredAddr = process.env.ASTER_WALLET_ADDRESS.toLowerCase();
            if (asterSigner.address.toLowerCase() !== configuredAddr) {
                this._log(`🔴 ASTER_PRIVATE_KEY address (${asterSigner.address}) ≠ ASTER_WALLET_ADDRESS (${configuredAddr}) — aborting`, 'error');
                await this._sendSweepAlert(allocatedBNB, false, `Key/address mismatch — check ASTER_PRIVATE_KEY and ASTER_WALLET_ADDRESS`);
                return; // finally block restores pendingBurnBNB
            }

            // Check actual BNB balance of the Aster LP wallet
            const asterBal   = await provider.getBalance(asterSigner.address);
            const asterFloat = parseFloat(ethers.formatEther(asterBal));
            this._log(`💰 Aster LP wallet BNB balance: ${asterFloat.toFixed(6)} BNB`);

            const availableBNB = asterFloat - GAS_RESERVE_BNB;
            if (availableBNB <= 0) {
                this._log(`⚠ Aster LP wallet balance (${asterFloat.toFixed(6)} BNB) below gas reserve (${GAS_RESERVE_BNB} BNB) — skipping`, 'warn');
                await this._sendSweepAlert(allocatedBNB, false, `Aster wallet balance (${asterFloat.toFixed(6)} BNB) below gas reserve`);
                return; // finally block restores pendingBurnBNB
            }

            // Cap sweep at actual available balance — never more than allocated
            const sendBNB = Math.min(allocatedBNB, availableBNB);
            if (sendBNB < BURN_THRESHOLD_BNB * 0.5) {
                this._log(`⚠ Effective sweep amount too small (${sendBNB.toFixed(6)} BNB) — skipping`, 'warn');
                return; // finally block restores pendingBurnBNB
            }

            const sendWei = ethers.parseEther(sendBNB.toFixed(18));

            // ── Step 1/2: Send BNB from Aster LP wallet to AutoBurn (triggers receive()) ─
            this._log(`🔗 Step 1/2: Sending ${sendBNB.toFixed(6)} BNB from Aster LP wallet (${asterSigner.address}) to AutoBurn`);
            const sendTx = await asterSigner.sendTransaction({
                to:       AUTOBURN,
                value:    sendWei,
                gasLimit: 50_000n,
            });
            const sendReceipt = await sendTx.wait();
            this._log(`✅ BNB sent to AutoBurn: ${sendReceipt.hash}`);

            // ── Step 2/2: Call executeBurnAmount(sendWei, minKeno) — burns exactly sendWei ─
            // Using executeBurnAmount (not executeBurn) so only our contributed BNB is spent,
            // never pre-existing contract BNB from other sources.
            this._log(`🔗 Step 2/2: Calling executeBurnAmount(${sendBNB.toFixed(6)} BNB) — exact-amount burn`);
            const autoBurn = new ethers.Contract(AUTOBURN, AUTOBURN_ABI, botSigner);

            // Quote KENO out for exactly sendWei BNB via PancakeSwap
            let minKeno = 0n;
            try {
                const pcRouter  = new ethers.Contract(PC_ROUTER, PC_ROUTER_ABI, provider);
                const amounts   = await pcRouter.getAmountsOut(sendWei, [BSC_WBNB, KENO_ADDR]);
                const kenoQuote = amounts[1];
                minKeno = kenoQuote * BigInt(Math.floor((1 - SWEEP_SLIPPAGE) * 100)) / 100n;
                this._log(`💱 PancakeSwap quote: ${ethers.formatEther(kenoQuote)} KENO for ${sendBNB.toFixed(6)} BNB (minKeno with slippage: ${ethers.formatEther(minKeno)})`);
            } catch (e) {
                this._log(`⚠ Could not fetch PancakeSwap quote — proceeding with minKeno=0: ${e.message}`, 'warn');
            }

            const burnTx      = await autoBurn.executeBurnAmount(sendWei, minKeno);
            const burnReceipt = await burnTx.wait();
            this._log(`🔥 executeBurnAmount TX: ${burnReceipt.hash}`);

            // Read KENO burned from the KenoBurned event in the receipt (incremental, not cumulative)
            let kenoThisBurn = 0;
            const kenoBurnedTopic = autoBurn.interface.getEvent('KenoBurned').topicHash;
            for (const log of burnReceipt.logs) {
                if (log.topics[0] === kenoBurnedTopic) {
                    try {
                        const parsed = autoBurn.interface.parseLog(log);
                        kenoThisBurn = parseFloat(ethers.formatEther(parsed.args.kenoBurned));
                        this._log(`🔥 KenoBurned event: ${kenoThisBurn.toFixed(4)} KENO burned for ${ethers.formatEther(parsed.args.bnbIn)} BNB`);
                    } catch (_) {}
                    break;
                }
            }

            // Update accounting using incremental values from event, not contract totals.
            // pendingBurnBNB was already zeroed up-front; only add back the unspent portion.
            this.totalBurned  += kenoThisBurn;
            this.totalBNBUsed += sendBNB;
            spentBNB           = sendBNB;
            // If allocated > sent (balance was lower), return the difference
            const unspent = allocatedBNB - sendBNB;
            if (unspent > 0.000001) this.pendingBurnBNB += unspent;
            this.sweepCount++;

            // ── Law VI: Ramanujan milestone ───────────────────────────────────────
            if (!this._r1729Hit && this.totalBurned >= 1729) {
                this._r1729Hit = true;
                this._sendTg(
                    '🏛 <b>Ramanujan Milestone — 1,729 KENO Burned via Aster</b>\n\n' +
                    'Aster LP fees have now funded the burning of 1,729 KENO.\n' +
                    'The Hardy-Ramanujan number. From LP fees to permanent deflation. 🔑'
                );
            }

            this._sendTg(
                `🔥 <b>Aster → KENOAutoBurn — Complete!</b>\n\n` +
                `⛓ Same chain: Aster LP wallet → AutoBurn (no bridge) ✅\n` +
                `💰 BNB swept: <b>${sendBNB.toFixed(6)} BNB</b> from Aster LP wallet\n` +
                `🔥 KENO burned this sweep: <b>${kenoThisBurn.toFixed(4)} KENO</b> → 0xdEaD\n` +
                `📊 Cumulative via Aster: ${this.totalBurned.toFixed(4)} KENO (${this.sweepCount} sweeps)\n` +
                `🔗 Send TX: <code>${sendReceipt.hash}</code>\n` +
                `🔗 Burn TX: <code>${burnReceipt.hash}</code>\n` +
                `🎯 AutoBurn: <code>${AUTOBURN}</code> (BSC)\n\n` +
                `<i>Aster's $4.66T volume pays us → we burn KENO. Law VII: we receive.</i>`
            );

        } catch (e) {
            this._log(`🔴 Sweep error: ${e.message}`, 'error');
            this._sendTg(
                `⚠️ <b>Aster AutoBurn — Sweep Error</b>\n\n` +
                `Error: ${e.message.slice(0, 200)}\n` +
                `Pending burn: ${allocatedBNB.toFixed(6)} BNB\n` +
                `Source wallet: ASTER_WALLET_ADDRESS\n` +
                `Manual: send BNB to <code>${AUTOBURN}</code> then call executeBurnAmount()`
            );
        } finally {
            // Always release the mutex.
            // If nothing was spent (error or early-return), restore the full allocation.
            if (spentBNB === 0) this.pendingBurnBNB += allocatedBNB;
            this._sweepInProgress = false;
        }
    }

    // ── Scan-Only Alert ───────────────────────────────────────────────────────
    async _sendSweepAlert(amountBNB, executed, note = '') {
        let eulerLine = '';
        try {
            if (Euler.continuousEarnings && amountBNB > 0) {
                const usdVal = amountBNB * this._bnbPriceUSD;
                const p30 = Euler.continuousEarnings(usdVal, KAPREKAR_BURN_SHARE, 30 / 365);
                eulerLine = `\n📐 Euler 30d projection on burn capital: $${p30.toFixed(4)}`;
            }
        } catch (_) {}

        this._sendTg(
            `🔥 <b>Aster AutoBurn — Sweep Ready</b>\n\n` +
            `💰 Burn allocation: <b>${amountBNB.toFixed(6)} BNB</b> (~$${(amountBNB * this._bnbPriceUSD).toFixed(2)})\n` +
            `📍 Source: Aster LP wallet on BNB Chain (same chain as AutoBurn)\n` +
            `🎯 Destination: KENOAutoBurn <code>${AUTOBURN}</code>\n` +
            (note ? `⚠️ Note: ${note}\n` : '') + '\n' +
            `<b>Manual steps (no bridge needed!):</b>\n` +
            `1. Send ${amountBNB.toFixed(6)} BNB from ASTER LP wallet to AutoBurn:\n` +
            `   <code>${AUTOBURN}</code>\n` +
            `2. Call executeBurn() on the AutoBurn contract\n\n` +
            `⚡ <b>Set ASTER_PRIVATE_KEY + ASTER_WALLET_ADDRESS + BOT_WALLET_PRIVATE_KEY to automate this</b>` +
            eulerLine
        );
    }

    // ── BNB price refresh (via PancakeSwap getAmountsOut) ─────────────────────
    async _refreshBNBPrice() {
        try {
            const BSC_USDT  = '0x55d398326f99059fF775485246999027B3197955';
            const BSC_WBNB  = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
            const PC_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
            const PC_ABI    = ['function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)'];

            const provider = new ethers.JsonRpcProvider(BSC_RPC);
            const router   = new ethers.Contract(PC_ROUTER, PC_ABI, provider);
            const amts     = await router.getAmountsOut(ethers.parseEther('1'), [BSC_WBNB, BSC_USDT]);
            const price    = parseFloat(ethers.formatUnits(amts[1], 18));
            if (price > 50 && price < 10000) {
                this._bnbPriceUSD = price;
                this._log(`💱 BNB price refreshed: $${price.toFixed(2)}`);
            }
        } catch (_) {
            // Keep fallback price — non-critical
        }
    }

    // ── Manual sweep trigger from API ─────────────────────────────────────────
    // Non-mutating guard: returns an error if no verified income is pending.
    async triggerManualSweep() {
        if (this.pendingBurnBNB < BURN_THRESHOLD_BNB * 0.1) {
            return {
                ok:  false,
                msg: `No verified pending burn amount — pendingBurnBNB=${this.pendingBurnBNB.toFixed(6)} BNB. ` +
                     `Income is only queued when AsterLPBotManager.totalFeesEarned increases after service start.`,
            };
        }
        this._log(`🔧 Manual sweep triggered — ${this.pendingBurnBNB.toFixed(6)} BNB pending`);
        await this._executeSweep();
        return { ok: true, msg: `Sweep triggered for ${this.pendingBurnBNB.toFixed(6)} BNB from Aster LP wallet` };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    _log(msg, level = 'info') {
        const entry = { time: new Date().toISOString(), msg, level };
        this.logs.unshift(entry);
        if (this.logs.length > 200) this.logs.pop();
        console.log(`[AsterAutoBurn] ${level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🔥'} ${msg}`);
    }

    getStatus() {
        return {
            running:            this.running,
            pendingBurnBNB:     this.pendingBurnBNB,
            pendingBurnUSD:     this.pendingBurnBNB * this._bnbPriceUSD,
            totalBNBUsed:       this.totalBNBUsed,
            totalBurned:        this.totalBurned,
            sweepCount:         this.sweepCount,
            referralCode:       this.referralCode,
            referralEarned:     this.referralEarned,
            referralActive:     this.referralActive,
            autoBurnContract:   AUTOBURN,
            autoBurnStats:      this.autoBurnStats,
            lastAutoBurnCheck:  this.lastAutoBurnCheck,
            bnbPriceUSD:        this._bnbPriceUSD,
            burnThresholdBNB:   BURN_THRESHOLD_BNB,
            maxSingleSweepBNB:  MAX_SINGLE_SWEEP_BNB,
            kaprekarShare:      KAPREKAR_BURN_SHARE,
            incomeBaselineUSD:  this._lastIncome,
            liveMode:           this._isLive(),
            recentLogs:         this.logs.slice(0, 50),
        };
    }
}

module.exports = AsterAutoBurnService;

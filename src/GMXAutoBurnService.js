'use strict';

/**
 * GMXAutoBurnService — GMX v2 Earnings → Cross-Chain → KENO Burn
 *
 * Flow:
 *   GMX v2 funding income (USDC, Arbitrum)
 *     → Kaprekar 15% burn split
 *     → Uniswap V3 on Arbitrum: USDC → WETH
 *     → Stargate bridge: WETH/USDC Arbitrum → USDC BSC (chain 102)
 *     → PancakeSwap V2 on BSC: USDC → BNB
 *     → KENOAutoBurn.executeBurn() → KENO bought + burned to 0xdEaD
 *
 * Referral channel (parallel income stream):
 *   Register code "KENO" on app.gmx.io/#/referrals
 *   → traders using "KENO" get 5% discount, we earn 15% of their fees as USDC
 *   → same sweep → burn flow
 *
 * Required env (scan-only until set):
 *   GMX_PRIVATE_KEY      — Arbitrum private key (signs bridge + swap tx)
 *   GMX_WALLET_ADDRESS   — Arbitrum EVM address
 *   BOT_WALLET_PRIVATE_KEY — BSC key (calls executeBurn on AutoBurn contract)
 *
 * All 7 Constitutional Laws active.
 */

const https   = require('https');
const { ethers } = require('ethers');

const Kaprekar    = require('./Kaprekar');
const Euler       = require('./Euler');
const GoldenRatio = require('./GoldenRatio');
const Ramanujan   = require('./Ramanujan');

// ── Chain & Contract Config ────────────────────────────────────────────────────
const ARB_RPC  = process.env.ARB_RPC_URL || 'https://arb1.arbitrum.io/rpc';
const BSC_RPC  = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/';

// Arbitrum contracts
const ARB_USDC        = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'; // native USDC on Arbitrum
const ARB_WETH        = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
const UNI_V3_ROUTER   = '0xE592427A0AEce92De3Edee1F18E0157C05861564'; // Uniswap V3 SwapRouter
const STARGATE_ROUTER = '0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614'; // Stargate V1 Router Arbitrum
const STG_POOL_USDC_ARB = 1;   // Stargate USDC pool on Arbitrum
const STG_POOL_USDC_BSC = 2;   // Stargate USDC pool on BSC
const STG_CHAIN_BSC     = 102; // Stargate chain ID for BSC

// BSC contracts
const BSC_USDC       = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const BSC_WBNB       = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const PC_ROUTER      = '0x10ED43C718714eb63d5aA57B78B54704E256024E'; // PancakeSwap V2
const AUTOBURN       = '0x9Fb4f8d4798d9E484c27c6F7571DCaFc82215A79';
const KENO           = '0x48bb049afe50b050b458624dc6233acd51024ab4';
const DEAD           = '0x000000000000000000000000000000000000dEaD';

// Thresholds
const BURN_THRESHOLD_USD  = 5;    // minimum USDC to trigger a sweep ($5)
const KAPREKAR_BURN_SHARE = 0.15; // 15% of GMX income goes to AutoBurn
const SWEEP_SLIPPAGE      = 0.02; // 2% slippage on swaps
const MIN_POLL_MS         = 30 * 60 * 1000; // check every 30 min

// ── ABIs (minimal) ────────────────────────────────────────────────────────────
const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)',
];
const UNI_V3_ABI = [
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
];
const STARGATE_ABI = [
    'function swap(uint16 _dstChainId, uint256 _srcPoolId, uint256 _dstPoolId, address payable _refundAddress, uint256 _amountLD, uint256 _minAmountLD, (uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams, bytes _to, bytes _payload) payable',
    'function quoteLayerZeroFee(uint16 _dstChainId, uint8 _functionType, bytes _toAddress, bytes _transferAndCallPayload, (uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams) view returns (uint256, uint256)',
];
const PC_ROUTER_ABI = [
    'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)',
    'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)',
];
const AUTOBURN_ABI = [
    'function executeBurn(uint256 minKenoOut) external',
    'function stats() view returns (uint256 totalBurned, uint256 totalBnbUsed, uint256 burnCount, uint256 pendingBnb)',
    'function getBurnQuote() view returns (uint256)',
];

class GMXAutoBurnService {
    constructor(gmxFundingManager) {
        this.fundingManager = gmxFundingManager; // reference to track income
        this.running        = false;
        this.pollTimer      = null;
        this.logs           = [];

        // Accounting
        this.pendingBurnUSD = 0;    // USDC allocated for burning (15% of income)
        this.totalBridged   = 0;    // USDC bridged to BSC
        this.totalBurned    = 0;    // KENO burned via this service
        this.sweepCount     = 0;
        this._r1729Hit      = false;
        this._lastIncome    = 0;    // last known GMX income total

        // Referral tracking
        this.referralCode   = 'KENO';
        this.referralEarned = 0;
        this.referralTraders = 0;

        // AutoBurn contract stats (from BSC)
        this.autoBurnStats  = null;
        this.lastAutoBurnCheck = null;
    }

    // ── Telegram ──────────────────────────────────────────────────────────────
    _tgToken()  { return process.env.KINGS_SHIELD_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || ''; }
    _tgChatId() { return process.env.SHIELD_ALERT_CHAT_ID   || process.env.FAL_ALERT_CHAT_ID  || ''; }

    _sendTg(text) {
        const token = this._tgToken(), chatId = this._tgChatId();
        if (!token || !chatId) return;
        const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
        const req = https.request({ hostname: 'api.telegram.org', path: `/bot${token}/sendMessage`, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } });
        req.on('error', () => {});
        req.write(body); req.end();
    }

    // ── Start / Stop ──────────────────────────────────────────────────────────
    start() {
        if (this.running) return { ok: false, msg: 'GMX AutoBurn Service already running' };
        this.running = true;
        this._log('🔥 GMX AutoBurn Service started');

        const liveMode = !!(process.env.GMX_PRIVATE_KEY && process.env.BOT_WALLET_PRIVATE_KEY);

        this._sendTg(
            '🔥 <b>GMX → KENOAutoBurn Service — STARTED</b>\n\n' +
            '⛓ <b>Flow:</b> GMX USDC (Arbitrum) → Stargate bridge → PancakeSwap → KENOAutoBurn\n' +
            `💵 <b>Burn allocation:</b> ${KAPREKAR_BURN_SHARE * 100}% of GMX funding income\n` +
            `🎯 <b>Trigger threshold:</b> $${BURN_THRESHOLD_USD} USDC\n` +
            `🔖 <b>GMX Referral code:</b> <code>KENO</code> (register at app.gmx.io/#/referrals)\n` +
            `⚡ <b>Mode:</b> ${liveMode ? 'LIVE — will auto-sweep and burn 🔴' : 'SCAN-ONLY — alerts only 🟡'}\n` +
            '📐 <b>Laws:</b> Kaprekar 15% burn · Euler compounding · Ramanujan $1,729 · φ allocation'
        );

        this._poll();
        this.pollTimer = setInterval(() => this._poll(), MIN_POLL_MS);
        return { ok: true, msg: 'GMX AutoBurn Service started' };
    }

    stop() {
        if (!this.running) return { ok: false, msg: 'Not running' };
        this.running = false;
        clearInterval(this.pollTimer); this.pollTimer = null;
        this._log('🛑 GMX AutoBurn Service stopped');
        return { ok: true, msg: 'GMX AutoBurn Service stopped' };
    }

    // ── Main Poll ─────────────────────────────────────────────────────────────
    async _poll() {
        if (!this.running) return;

        // 1. Sync income from GMXFundingBotManager
        await this._syncFundingIncome();

        // 2. Check GMX referral rebates on Arbitrum
        await this._checkReferralRebates();

        // 3. Check AutoBurn contract stats on BSC
        await this._checkAutoBurnStats();

        // 4. Sweep if threshold met
        if (this.pendingBurnUSD >= BURN_THRESHOLD_USD) {
            await this._executeSweep();
        } else {
            this._log(`⏳ Pending burn: $${this.pendingBurnUSD.toFixed(4)} USDC (threshold: $${BURN_THRESHOLD_USD})`);
        }
    }

    // ── Step 1: Sync income from GMX Funding Bot ──────────────────────────────
    async _syncFundingIncome() {
        try {
            const status  = this.fundingManager ? this.fundingManager.getStatus() : null;
            const current = status?.totalProfit || 0;

            if (current > this._lastIncome) {
                const newIncome = current - this._lastIncome;
                this._lastIncome = current;

                // ── Law I: Kaprekar — 15% to burn, 60% to founder, 25% reinvest ─────
                const burnSlice    = newIncome * KAPREKAR_BURN_SHARE;
                const founderSlice = newIncome * 0.60;
                const reinvSlice   = newIncome * 0.25;

                this.pendingBurnUSD += burnSlice;

                // ── Law V: Euler — compound projection ───────────────────────────────
                let euler30d = 0;
                try { if (Euler.continuousEarnings) euler30d = Euler.continuousEarnings(current, 0.15, 30/365); } catch(_) {}

                this._log(`💵 New GMX income: +$${newIncome.toFixed(4)} | burn share: $${burnSlice.toFixed(4)} | pending: $${this.pendingBurnUSD.toFixed(4)}`);
                this._log(`📐 Kaprekar: pocket $${founderSlice.toFixed(4)} · reinvest $${reinvSlice.toFixed(4)} · burn $${burnSlice.toFixed(4)}`);

                // ── Law VI: Ramanujan ─────────────────────────────────────────────────
                if (!this._r1729Hit && this.totalBurned >= 1729) {
                    this._r1729Hit = true;
                    this._sendTg('🏛 <b>Ramanujan Milestone — $1,729 KENO Burned via GMX</b>\n\nGMX funding has now funded the burning of $1,729 worth of KENO. The Hardy-Ramanujan number. 🔑');
                }
            }
        } catch (e) {
            this._log(`⚠ Income sync error: ${e.message}`, 'warn');
        }
    }

    // ── Step 2: Check GMX Referral Rebates ────────────────────────────────────
    async _checkReferralRebates() {
        const urls = [
            `https://arbitrum-api.gmxinfra.io/referrals/v2/referrals?code=${this.referralCode}`,
            `https://stats.gmx.io/api/referrals?referralCode=${this.referralCode}`,
        ];
        for (const url of urls) {
            try {
                const data = await new Promise((resolve, reject) => {
                    const timer = setTimeout(() => reject(new Error('timeout')), 7000);
                    https.get(url, { headers: { 'User-Agent': 'SovereignEconomy/1.0' } }, res => {
                        clearTimeout(timer);
                        let d = ''; res.on('data', c => d += c);
                        res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
                    }).on('error', e => { clearTimeout(timer); reject(e); });
                });

                const traders = data?.traders || data?.data?.traders || 0;
                const earned  = parseFloat(data?.rebatesUsd || data?.data?.rebatesUsd || 0);

                if (earned > this.referralEarned) {
                    const newRebate = earned - this.referralEarned;
                    this.referralEarned = earned;
                    this.pendingBurnUSD += newRebate * KAPREKAR_BURN_SHARE;
                    this._log(`🔖 Referral code "KENO": +$${newRebate.toFixed(4)} rebates | traders: ${traders}`);
                } else {
                    this._log(`🔖 Referral "KENO": $${earned.toFixed(4)} total earned | ${traders} traders`);
                }
                this.referralTraders = traders;
                break;
            } catch (_) { continue; }
        }

        // If no referral data yet, log how to register
        if (this.referralEarned === 0 && this.referralTraders === 0) {
            this._log('🔖 Referral code "KENO" not yet active — register at https://app.gmx.io/#/referrals to start earning 15% of trader fees');
        }
    }

    // ── Step 3: Check AutoBurn contract stats on BSC ───────────────────────────
    async _checkAutoBurnStats() {
        try {
            const provider = new ethers.JsonRpcProvider(BSC_RPC);
            const contract = new ethers.Contract(AUTOBURN, AUTOBURN_ABI, provider);
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
            this._log(`🔥 AutoBurn contract: ${this.autoBurnStats.totalKenoBurned} KENO burned | ${this.autoBurnStats.burnCount} events | ${this.autoBurnStats.pendingBnb} BNB pending`);
        } catch (e) {
            this._log(`⚠ AutoBurn stats error: ${e.message}`, 'warn');
        }
    }

    // ── Step 4: Execute Cross-Chain Sweep ──────────────────────────────────────
    async _executeSweep() {
        const amountUSD = this.pendingBurnUSD;
        this._log(`🚀 Sweep triggered: $${amountUSD.toFixed(4)} USDC to bridge and burn`);

        const liveMode = !!(process.env.GMX_PRIVATE_KEY && process.env.BOT_WALLET_PRIVATE_KEY);

        if (!liveMode) {
            // ── Scan-only: alert with exact manual steps ──────────────────────
            await this._sendSweepAlert(amountUSD, false);
            return;
        }

        // ── Live mode: execute the full cross-chain sweep ─────────────────────
        try {
            this._log(`🔗 Step 1/4: Checking USDC balance on Arbitrum`);
            const arbProvider = new ethers.JsonRpcProvider(ARB_RPC);
            const arbSigner   = new ethers.Wallet(process.env.GMX_PRIVATE_KEY, arbProvider);
            const usdcArb     = new ethers.Contract(ARB_USDC, ERC20_ABI, arbSigner);
            const usdcBal     = await usdcArb.balanceOf(arbSigner.address);
            const usdcDec     = await usdcArb.decimals();
            const usdcFloat   = parseFloat(ethers.formatUnits(usdcBal, usdcDec));

            if (usdcFloat < 0.5) {
                this._log(`⚠ USDC balance on Arbitrum: $${usdcFloat.toFixed(4)} — below sweep minimum`, 'warn');
                await this._sendSweepAlert(amountUSD, false, `Insufficient USDC on Arbitrum ($${usdcFloat.toFixed(4)})`);
                return;
            }

            // Use the lesser of pendingBurnUSD and actual balance
            const sweepAmt   = Math.min(amountUSD, usdcFloat);
            const sweepWei   = ethers.parseUnits(sweepAmt.toFixed(usdcDec), usdcDec);

            this._log(`🔗 Step 2/4: Approving USDC for Stargate Router`);
            const approvalTx = await usdcArb.approve(STARGATE_ROUTER, sweepWei);
            await approvalTx.wait();
            this._log(`✅ USDC approved (${sweepAmt.toFixed(4)} USDC)`);

            this._log(`🔗 Step 3/4: Bridging USDC via Stargate Arbitrum → BSC`);
            const stgRouter  = new ethers.Contract(STARGATE_ROUTER, STARGATE_ABI, arbSigner);
            const bscWallet  = new ethers.Wallet(process.env.BOT_WALLET_PRIVATE_KEY);
            const dstAddr    = ethers.zeroPadValue(bscWallet.address, 32);
            const minOut     = BigInt(Math.floor(sweepAmt * (1 - SWEEP_SLIPPAGE) * 10 ** 6));
            const lzParams   = { dstGasForCall: 0n, dstNativeAmount: 0n, dstNativeAddr: '0x' };

            // Quote LayerZero fee
            const [lzFee] = await stgRouter.quoteLayerZeroFee(
                STG_CHAIN_BSC, 1, dstAddr, '0x', lzParams
            );

            const bridgeTx = await stgRouter.swap(
                STG_CHAIN_BSC,
                STG_POOL_USDC_ARB,
                STG_POOL_USDC_BSC,
                arbSigner.address,
                sweepWei,
                minOut,
                lzParams,
                dstAddr,
                '0x',
                { value: lzFee }
            );
            const bridgeReceipt = await bridgeTx.wait();
            this._log(`✅ Bridge TX: ${bridgeReceipt.hash} — USDC in transit to BSC`);

            this._sendTg(
                `🌉 <b>GMX AutoBurn — Bridge Initiated</b>\n\n` +
                `$${sweepAmt.toFixed(4)} USDC bridged from Arbitrum → BSC via Stargate\n` +
                `📋 TX: <code>${bridgeReceipt.hash}</code>\n` +
                `⏱ Funds arrive on BSC in ~5 minutes\n` +
                `Next: BSC relay will swap USDC → BNB → KENOAutoBurn`
            );

            // Give Stargate ~5 minutes to deliver, then trigger BSC burn
            await this._scheduleBSCBurn(sweepAmt);
            this.pendingBurnUSD -= sweepAmt;
            this.totalBridged   += sweepAmt;
            this.sweepCount++;

        } catch (e) {
            this._log(`🔴 Sweep error: ${e.message}`, 'error');
            this._sendTg(
                `⚠️ <b>GMX AutoBurn — Sweep Error</b>\n\n` +
                `Error: ${e.message.slice(0, 200)}\n` +
                `Pending burn: $${amountUSD.toFixed(4)} USDC\n` +
                `Manual intervention may be needed.`
            );
        }
    }

    // ── BSC Burn Step: USDC → BNB → KENOAutoBurn ──────────────────────────────
    async _scheduleBSCBurn(amountUSD) {
        // Wait 6 minutes for Stargate delivery, then trigger the BSC-side burn
        this._log(`⏱ Waiting 6 min for Stargate delivery, then triggering BSC burn...`);
        await new Promise(r => setTimeout(r, 6 * 60 * 1000));
        await this._triggerBSCBurn(amountUSD);
    }

    async _triggerBSCBurn(estimatedUSD) {
        try {
            this._log(`🔗 Step 4/4: Swapping USDC → BNB and triggering KENOAutoBurn on BSC`);
            const bscProvider = new ethers.JsonRpcProvider(BSC_RPC);
            const bscSigner   = new ethers.Wallet(process.env.BOT_WALLET_PRIVATE_KEY, bscProvider);

            // Check BSC USDC balance
            const usdcBSC  = new ethers.Contract(BSC_USDC, ERC20_ABI, bscSigner);
            const usdcBal  = await usdcBSC.balanceOf(bscSigner.address);
            const usdcDec  = await usdcBSC.decimals();

            if (usdcBal === 0n) {
                this._log(`⚠ No USDC received on BSC yet — bridge may still be pending`, 'warn');
                return;
            }

            // Approve PancakeSwap to spend USDC
            const pcRouter = new ethers.Contract(PC_ROUTER, PC_ROUTER_ABI, bscSigner);
            await (await usdcBSC.approve(PC_ROUTER, usdcBal)).wait();

            // Swap USDC → BNB via PancakeSwap (USDC → WBNB → BNB)
            const path      = [BSC_USDC, BSC_WBNB];
            const amounts   = await pcRouter.getAmountsOut(usdcBal, path);
            const minBNB    = BigInt(Math.floor(Number(amounts[1]) * (1 - SWEEP_SLIPPAGE)));

            // Swap and send BNB directly to AutoBurn contract
            const swapTx = await pcRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
                usdcBal, minBNB, path,
                AUTOBURN,  // recipient = AutoBurn contract receives the BNB directly
                Math.floor(Date.now() / 1000) + 300
            );
            const swapReceipt = await swapTx.wait();
            this._log(`✅ USDC → BNB swap: ${swapReceipt.hash}`);

            // Trigger executeBurn on AutoBurn contract (owner/relayer call)
            const autoBurn  = new ethers.Contract(AUTOBURN, AUTOBURN_ABI, bscSigner);
            const burnQuote = await autoBurn.getBurnQuote().catch(() => 0n);
            const minKeno   = burnQuote > 0n ? burnQuote * 95n / 100n : 0n; // 5% slippage

            const burnTx = await autoBurn.executeBurn(minKeno);
            const burnReceipt = await burnTx.wait();
            this._log(`🔥 executeBurn TX: ${burnReceipt.hash}`);

            // Read updated stats
            const [totalBurned,,burnCount] = await autoBurn.stats();
            const kenoAmount = parseFloat(ethers.formatEther(totalBurned));
            this.totalBurned = kenoAmount;
            this.sweepCount++;

            this._sendTg(
                `🔥 <b>GMX → KENOAutoBurn — Complete!</b>\n\n` +
                `💰 USDC bridged: $${estimatedUSD.toFixed(4)}\n` +
                `🔥 KENO burned: <b>${parseFloat(ethers.formatEther(burnQuote)).toFixed(4)} KENO</b>\n` +
                `📊 Total burned ever: ${kenoAmount.toFixed(4)} KENO (${burnCount} events)\n` +
                `🔗 Burn TX: <code>${burnReceipt.hash}</code>\n` +
                `🎯 AutoBurn: <code>${AUTOBURN}</code> (BSC)\n\n` +
                `<i>GMX volume → our income → KENO burned. Law VII: we receive.</i>`
            );

        } catch (e) {
            this._log(`🔴 BSC burn error: ${e.message}`, 'error');
            this._sendTg(
                `⚠️ <b>BSC Burn Step Failed</b>\n\nError: ${e.message.slice(0, 200)}\n` +
                `USDC should be on BSC — check ${process.env.GMX_WALLET_ADDRESS || 'bot wallet'}`
            );
        }
    }

    // ── Scan-Only Alert ───────────────────────────────────────────────────────
    async _sendSweepAlert(amountUSD, executed, note = '') {
        // ── Law V: Euler projection ────────────────────────────────────────────
        let eulerLine = '';
        try {
            if (Euler.continuousEarnings) {
                const p30 = Euler.continuousEarnings(amountUSD, 0.15, 30/365);
                eulerLine = `\n📐 Euler 30d projection on burn capital: $${p30.toFixed(4)}`;
            }
        } catch(_) {}

        this._sendTg(
            `🔥 <b>GMX AutoBurn — Sweep Ready</b>\n\n` +
            `💰 Burn allocation: <b>$${amountUSD.toFixed(4)} USDC</b>\n` +
            `📍 Source: Arbitrum (GMX funding + referrals)\n` +
            `🎯 Destination: KENOAutoBurn on BSC\n` +
            (note ? `⚠️ Note: ${note}\n` : '') + '\n' +
            `<b>Manual steps to complete burn:</b>\n` +
            `1. Bridge $${amountUSD.toFixed(2)} USDC Arbitrum → BSC via Stargate\n` +
            `   https://stargate.finance/transfer\n` +
            `2. Swap USDC → BNB on PancakeSwap\n` +
            `3. Send BNB to AutoBurn: <code>${AUTOBURN}</code>\n` +
            `4. Call executeBurn() — or it will trigger when BNB arrives\n\n` +
            `⚡ <b>Set GMX_PRIVATE_KEY + BOT_WALLET_PRIVATE_KEY to automate this</b>` +
            eulerLine
        );
    }

    // ── Manual trigger from API ───────────────────────────────────────────────
    async triggerManualSweep() {
        if (this.pendingBurnUSD < 0.01) {
            return { ok: false, msg: `Nothing to sweep — pending: $${this.pendingBurnUSD.toFixed(4)}` };
        }
        await this._executeSweep();
        return { ok: true, msg: `Sweep triggered for $${this.pendingBurnUSD.toFixed(4)} USDC` };
    }

    async triggerManualBSCBurn() {
        await this._triggerBSCBurn(0);
        return { ok: true, msg: 'BSC burn step triggered' };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    _log(msg, level = 'info') {
        const entry = { time: new Date().toISOString(), msg, level };
        this.logs.unshift(entry);
        if (this.logs.length > 200) this.logs.pop();
        console.log(`[GMXAutoBurn] ${level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🔥'} ${msg}`);
    }

    getStatus() {
        return {
            running:          this.running,
            pendingBurnUSD:   this.pendingBurnUSD,
            totalBridged:     this.totalBridged,
            totalBurned:      this.totalBurned,
            sweepCount:       this.sweepCount,
            referralCode:     this.referralCode,
            referralEarned:   this.referralEarned,
            referralTraders:  this.referralTraders,
            autoBurnContract: AUTOBURN,
            autoBurnStats:    this.autoBurnStats,
            lastAutoBurnCheck:this.lastAutoBurnCheck,
            liveMode:         !!(process.env.GMX_PRIVATE_KEY && process.env.BOT_WALLET_PRIVATE_KEY),
            threshold:        BURN_THRESHOLD_USD,
            burnShare:        KAPREKAR_BURN_SHARE,
            recentLogs:       this.logs.slice(0, 40),
        };
    }
}

module.exports = GMXAutoBurnService;

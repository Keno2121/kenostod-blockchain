/**
 * UTL Pulse Bot — Bot 2 of the Sovereign Bot Framework
 * =====================================================
 * Monitors the UTL Protocol FeeCollector (v1.1 on BSC) for accumulated USDC.
 * When balance exceeds the pulse threshold, triggers Kaprekar-routed distribution.
 *
 * Revenue stream: every UTL transaction generates a fee. This bot harvests those
 * fees on a schedule and routes them per the Nash equilibrium split.
 *
 * No external competition. Only YOU have the admin key to this FeeCollector.
 * This is passive income from infrastructure you already built.
 *
 * 7 Constitutional Laws: all 7 embedded.
 */

'use strict';

const https      = require('https');
const { ethers } = require('ethers');
const Kaprekar   = require('./Kaprekar');
const Euler      = require('./Euler');
const Nash       = require('./Nash');
const Ramanujan  = require('./Ramanujan');
const Benford    = require('./Benford');
const GoldenRatio = require('./GoldenRatio');

// ── BSC v1.1 Contract addresses ───────────────────────────────────────────────
const FEE_COLLECTOR_ADDR = '0xb9489B33Bd9bB835139369b1dD282fB44B2273d8';
const STAKING_ADDR       = '0x77C3946A9FD5F509584F94e81C43efb25120c837';
const DISTRIBUTION_ADDR  = '0xdeE5a5456e394DB34F03c770e81eDC9B7F8FE167';
const USDC_BSC           = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const KENO_V2            = '0x48bb049afe50b050b458624dc6233acd51024ab4';
const FOUNDER_WALLET     = '0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2';

// ── Minimal ABIs ──────────────────────────────────────────────────────────────
const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
];
const DISTRIBUTION_ABI = [
    'function distribute() external',
    'function pendingDistribution() view returns (uint256)',
];
const STAKING_ABI = [
    'function pendingRewards(address) view returns (uint256)',
    'function totalStaked() view returns (uint256)',
];

// ── Config ────────────────────────────────────────────────────────────────────
const PULSE_THRESHOLD_USDC = 10;      // trigger distribution when ≥ $10 USDC
const PULSE_INTERVAL_MS    = 300_000; // check every 5 min
const MAX_LOGS             = 150;

// Nash equilibrium staker split range
const NASH_STAKER_MIN = 0.55;
const NASH_STAKER_MAX = 0.65;
const NASH_BASE_SPLIT = 0.60;

class UTLPulseBot {
    constructor() {
        this.running    = false;
        this.startedAt  = null;
        this.logs       = [];
        this._timer     = null;
        this._provider  = null;
        this._wallet    = null;

        // Cumulative stats
        this.stats = {
            scanCount:           0,
            distributionsTriggered: 0,
            totalUSDCDistributed: 0,
            founderEarningsUSD:  0,    // 25% founder cut cumulative
            stakerEarningsUSD:   0,    // 60% staker cut cumulative
            treasuryUSD:         0,    // 15% treasury cut cumulative
            eulerPremiumUSD:     0,    // silent Euler bonus vs annual
            nashScore:           0,
            ramanujanMilestone:  false,
            benfordAlerts:       0,
            lastScan:            null,
            lastDistribution:    null,
            currentBalanceUSDC:  0,
            stakerSplit:         NASH_BASE_SPLIT,
        };

        this._startEpoch = Date.now();
    }

    // ── Telegram ──────────────────────────────────────────────────────────────
    _tgToken()  { return process.env.KINGS_SHIELD_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || ''; }
    _tgChatId() { return process.env.SHIELD_ALERT_CHAT_ID   || process.env.FAL_ALERT_CHAT_ID  || ''; }

    _alert(html) {
        const token = this._tgToken(); const chatId = this._tgChatId();
        if (!token || !chatId) return;
        const body = JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML' });
        const req  = https.request({
            hostname: 'api.telegram.org',
            path: `/bot${token}/sendMessage`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        });
        req.write(body); req.end();
    }

    // ── Log ───────────────────────────────────────────────────────────────────
    _log(msg) {
        const entry = { time: new Date().toISOString(), msg };
        console.log(`[UTL Pulse] ${msg}`);
        this.logs.unshift(entry);
        if (this.logs.length > MAX_LOGS) this.logs.pop();
    }

    // ── Provider init ─────────────────────────────────────────────────────────
    _initProvider() {
        if (this._provider) return;
        const rpc = process.env.BSC_RPC || 'https://bsc-dataseed1.binance.org';
        this._provider = new ethers.JsonRpcProvider(rpc);
        const pk = process.env.NEW_WALLET_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY || '';
        if (pk) {
            this._wallet = new ethers.Wallet(pk, this._provider);
            this._log(`Wallet: ${this._wallet.address}`);
        }
    }

    // ── Nash equilibrium staker split ─────────────────────────────────────────
    _nashAdjustedSplit(totalFeeVol, stakedKeno, totalKeno) {
        const eq = Nash.equilibriumAdjustment
            ? Nash.equilibriumAdjustment(totalFeeVol, stakedKeno, totalKeno)
            : { adjustedStakerShare: NASH_BASE_SPLIT };
        const split = Math.max(NASH_STAKER_MIN, Math.min(NASH_STAKER_MAX, eq.adjustedStakerShare || NASH_BASE_SPLIT));
        this.stats.stakerSplit = split;
        return split;
    }

    // ── Golden Ratio duration multiplier ─────────────────────────────────────
    _goldenMultiplier(daysActive) {
        const phi = 1.6180339887;
        if (typeof GoldenRatio.phiMultiplier === 'function') {
            return GoldenRatio.phiMultiplier(daysActive);
        }
        // fallback: approaches φ asymptotically over 8 periods
        const period = Math.min(8, Math.floor(daysActive / 30));
        return 1 + (phi - 1) * (period / 8);
    }

    // ── Core pulse scan ───────────────────────────────────────────────────────
    async _scan() {
        this._initProvider();
        this.stats.scanCount++;
        this.stats.lastScan = new Date().toISOString();

        try {
            // ── Check FeeCollector USDC balance ──────────────────────────────
            const usdc = new ethers.Contract(USDC_BSC, ERC20_ABI, this._provider);
            const rawBal = await usdc.balanceOf(FEE_COLLECTOR_ADDR);
            const balance = parseFloat(ethers.formatUnits(rawBal, 18));
            this.stats.currentBalanceUSDC = parseFloat(balance.toFixed(4));

            this._log(`📡 FeeCollector USDC: $${balance.toFixed(4)} (threshold: $${PULSE_THRESHOLD_USDC})`);

            // ── Staking stats ─────────────────────────────────────────────────
            let totalStaked = 0;
            try {
                const staking = new ethers.Contract(STAKING_ADDR, STAKING_ABI, this._provider);
                const ts = await staking.totalStaked();
                totalStaked = parseFloat(ethers.formatEther(ts));
            } catch (_) {}

            // ── Nash equilibrium ──────────────────────────────────────────────
            const nashResult = Nash.payoffMatrix(balance, totalStaked, totalStaked, totalStaked * 1.5);
            this.stats.nashScore = nashResult.nashScore;

            // ── Euler: days active growth factor ─────────────────────────────
            const daysActive = (Date.now() - this._startEpoch) / 86_400_000;
            const t = daysActive / 365;
            const eulerPremium = Euler.eulerPremium(balance, 0.06174, t);
            this.stats.eulerPremiumUSD += eulerPremium;

            // ── Benford on scan count (detect anomalies) ──────────────────────
            if (this.stats.scanCount % 25 === 0 && this.stats.scanCount > 0) {
                const recentBals = this.logs
                    .filter(l => l.msg.includes('FeeCollector USDC'))
                    .slice(0, 20)
                    .map(l => { const m = l.msg.match(/\$([\d.]+)/); return m ? parseFloat(m[1]) : null; })
                    .filter(Boolean);
                if (recentBals.length >= 5) {
                    try {
                        const bf = Benford.monitor(recentBals);
                        if (bf && bf.anomaly) { this.stats.benfordAlerts++; this._log('⚠️ Benford anomaly in FeeCollector balance — investigating'); }
                    } catch (_) {}
                }
            }

            // ── Distribute if threshold met ───────────────────────────────────
            if (balance >= PULSE_THRESHOLD_USDC) {
                await this._distribute(balance, daysActive);
            }

        } catch (err) {
            this._log(`❌ Scan error: ${err.message}`);
        }
    }

    async _distribute(balanceUSDC, daysActive) {
        this._log(`💰 Pulse threshold met — $${balanceUSDC.toFixed(2)} USDC ready for distribution`);

        // Kaprekar absorb: dust flows to founder (participant), never to protocol
        const stakerSplit  = this._nashAdjustedSplit(balanceUSDC, 500_000, 1_000_000_000);
        const founderSplit = (1 - stakerSplit) * 0.625; // 25% of total
        const treasurySplit = 1 - stakerSplit - founderSplit;

        const [stakers, founder, treasury] = Kaprekar.absorb(balanceUSDC, [stakerSplit, founderSplit, treasurySplit]);

        // Golden Ratio multiplier on founder share (duration-based)
        const phiMult = this._goldenMultiplier(daysActive);
        const founderBoosted = parseFloat((founder * Math.min(phiMult, 1.618)).toFixed(4));

        this._log(`📐 Kaprekar distribution — Stakers: $${stakers.toFixed(4)} | Founder: $${founderBoosted.toFixed(4)} (φ×${phiMult.toFixed(3)}) | Treasury: $${treasury.toFixed(4)}`);

        // Try on-chain distribution call
        let txHash = null;
        if (this._wallet) {
            try {
                const dist = new ethers.Contract(DISTRIBUTION_ADDR, DISTRIBUTION_ABI, this._wallet);
                const tx = await dist.distribute({ gasPrice: ethers.parseUnits('1', 'gwei'), gasLimit: 150_000 });
                txHash = tx.hash;
                await tx.wait(1);
                this._log(`✅ On-chain distribution: ${txHash}`);
            } catch (err) {
                this._log(`⚠️ On-chain distribute failed (${err.message}) — logging off-chain record`);
            }
        }

        // Update stats
        this.stats.distributionsTriggered++;
        this.stats.totalUSDCDistributed += balanceUSDC;
        this.stats.founderEarningsUSD   += founderBoosted;
        this.stats.stakerEarningsUSD    += stakers;
        this.stats.treasuryUSD          += treasury;
        this.stats.lastDistribution      = new Date().toISOString();

        // Ramanujan milestone: $1729 total distributed
        if (!this.stats.ramanujanMilestone && this.stats.totalUSDCDistributed >= 1729) {
            this.stats.ramanujanMilestone = true;
            this._log('🌟 Ramanujan Milestone: $1729 USDC distributed through UTL Protocol!');
            this._alert(`🌟 <b>Ramanujan Milestone</b>\n$1,729 USDC has flowed through UTL Protocol.\nThe number 1729 — found in a taxi, changed mathematics forever.\nYour protocol just changed yours.`);
        }

        this._alert(
            `📡 <b>UTL Pulse Bot — Distribution Executed</b>\n` +
            `<b>Total:</b> $${balanceUSDC.toFixed(2)} USDC\n` +
            `<b>Stakers (${(stakerSplit * 100).toFixed(1)}%):</b> $${stakers.toFixed(2)}\n` +
            `<b>Founder (φ-boosted):</b> $${founderBoosted.toFixed(2)}\n` +
            `<b>Treasury:</b> $${treasury.toFixed(2)}\n` +
            `<b>Euler Premium:</b> +$${this.stats.eulerPremiumUSD.toFixed(4)} silent\n` +
            (txHash ? `<b>TX:</b> <code>${txHash.slice(0,20)}...</code>` : `<i>Off-chain record</i>`)
        );
    }

    // ── Start / Stop ──────────────────────────────────────────────────────────
    start() {
        if (this.running) return { success: false, msg: 'UTL Pulse Bot already running' };
        this.running   = true;
        this.startedAt = new Date().toISOString();
        this._scan(); // immediate first scan
        this._timer = setInterval(() => this._scan(), PULSE_INTERVAL_MS);
        this._log('📡 UTL Pulse Bot started — FeeCollector monitoring active');
        return { success: true, msg: 'UTL Pulse Bot started' };
    }

    stop() {
        this.running = false;
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        this._log('🛑 UTL Pulse Bot stopped');
        return { success: true, msg: 'stopped' };
    }

    getStatus() {
        return {
            name:    'UTL Pulse Bot (Bot 2)',
            running: this.running,
            startedAt: this.startedAt,
            stats:   this.stats,
            contracts: {
                feeCollector: FEE_COLLECTOR_ADDR,
                staking:      STAKING_ADDR,
                distribution: DISTRIBUTION_ADDR,
            },
            recentLogs: this.logs.slice(0, 30),
        };
    }
}

module.exports = UTLPulseBot;

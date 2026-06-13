/**
 * PoRV Mining Optimizer — Bot 4 of the Sovereign Bot Framework
 * =============================================================
 * Monitors Proof-of-Residual-Value (PoRV) staking positions on BSC.
 * Auto-compounds rewards via Euler continuous compounding.
 * Checks Ramanujan 1729 KENO milestone.
 * Golden Ratio multiplier on staking duration.
 *
 * PoRV is YOUR invention. Nobody else has it.
 * Every reward cycle is YOUR ecosystem paying YOU.
 *
 * Revenue mechanic:
 *   Stake KENO → earn PoRV rewards → auto-compound → Euler premium → more KENO
 *   The compounding is continuous — interest accrues every SECOND, not monthly.
 *
 * 7 Constitutional Laws: all 7 embedded.
 */

'use strict';

const https       = require('https');
const { ethers }  = require('ethers');
const Kaprekar    = require('./Kaprekar');
const Euler       = require('./Euler');
const Nash        = require('./Nash');
const Ramanujan   = require('./Ramanujan');
const Benford     = require('./Benford');
const GoldenRatio = require('./GoldenRatio');

// ── BSC v1.1 Contracts ────────────────────────────────────────────────────────
const STAKING_ADDR   = '0x77C3946A9FD5F509584F94e81C43efb25120c837';
const KENO_V2        = '0x48bb049afe50b050b458624dc6233acd51024ab4';
const BOT_WALLET     = '0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2';

// ── ABIs ──────────────────────────────────────────────────────────────────────
const STAKING_ABI = [
    'function pendingRewards(address) view returns (uint256)',
    'function totalStaked() view returns (uint256)',
    'function stakedBalance(address) view returns (uint256)',
    'function claimRewards() external',
    'function stake(uint256 amount) external',
    'function getAPR() view returns (uint256)',
];
const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
];

// ── Config ────────────────────────────────────────────────────────────────────
const SCAN_INTERVAL_MS    = 600_000; // 10 min — compounding is time-based, not fast-paced
const COMPOUND_THRESHOLD  = ethers.parseEther('100'); // claim + restake when ≥ 100 KENO pending
const PORV_APR            = 0.20;   // estimated 20% APR baseline (adjusted by GoldenRatio over time)
const RAMANUJAN_TARGET    = 1729;   // KENO milestone
const MAX_LOGS            = 150;
const PHI                 = 1.6180339887;

class PoRVOptimizer {
    constructor(autoCompound = false) {
        this.autoCompound = autoCompound;
        this.running      = false;
        this.startedAt    = null;
        this.logs         = [];
        this._timer       = null;
        this._provider    = null;
        this._wallet      = null;

        this.stats = {
            scanCount:           0,
            stakedKENO:          0,
            pendingRewards:      0,
            totalClaimed:        0,
            totalCompounded:     0,
            eulerPremium:        0,       // cumulative Euler bonus vs simple interest
            goldenMultiplier:    1,       // φ-based duration multiplier
            nashScore:           0,
            ramanujanMilestone:  false,
            benfordAlerts:       0,
            currentAPR:          PORV_APR,
            effectiveAPR:        PORV_APR, // boosted by φ multiplier
            projectedMonthly:    0,        // USD/month at current stake size
            lastScan:            null,
            lastCompound:        null,
            daysStaked:          0,
        };

        this._stakeStartEpoch = Date.now();
        this._kenoPrice       = 0.001; // fallback price, refreshed from DEX
    }

    // ── Providers ─────────────────────────────────────────────────────────────
    _initProvider() {
        if (this._provider) return;
        const rpc = process.env.BSC_RPC || 'https://bsc-dataseed1.binance.org';
        this._provider = new ethers.JsonRpcProvider(rpc);
        const pk = process.env.NEW_WALLET_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY || '';
        if (pk) this._wallet = new ethers.Wallet(pk, this._provider);
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

    _log(msg) {
        const entry = { time: new Date().toISOString(), msg };
        console.log(`[PoRV Optimizer] ${msg}`);
        this.logs.unshift(entry);
        if (this.logs.length > MAX_LOGS) this.logs.pop();
    }

    // ── Fetch KENO price from BSC DEX ─────────────────────────────────────────
    async _fetchKenoPrice() {
        try {
            const res = await new Promise((resolve, reject) => {
                https.get({
                    hostname: 'api.coingecko.com',
                    path: `/api/v3/simple/token_price/binance-smart-chain?contract_addresses=${KENO_V2}&vs_currencies=usd`,
                    headers: { 'Accept': 'application/json', 'User-Agent': 'kenostod-porv' }
                }, r => {
                    let d = '';
                    r.on('data', c => d += c);
                    r.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(); } });
                }).on('error', reject);
            });
            const key = KENO_V2.toLowerCase();
            if (res[key] && res[key].usd) this._kenoPrice = res[key].usd;
        } catch (_) { /* keep last price */ }
    }

    // ── Golden Ratio staking duration multiplier ──────────────────────────────
    _computeGoldenMultiplier(daysStaked) {
        // Multiplier approaches φ over 8 staking periods (30 days each)
        // Period 1: ×1.077 | Period 4: ×1.309 | Period 8: ×1.618 (φ)
        if (typeof GoldenRatio.phiMultiplier === 'function') {
            return GoldenRatio.phiMultiplier(daysStaked);
        }
        const period = Math.min(8, Math.floor(daysStaked / 30));
        return 1 + (PHI - 1) * (period / 8);
    }

    // ── Constitutional Laws update ────────────────────────────────────────────
    _updateLaws(stakedKENO, pendingKENO) {
        const days = this.stats.daysStaked;
        const t    = days / 365;

        // Euler: continuous compound earnings vs simple interest
        const annualEarnings = stakedKENO * this.stats.effectiveAPR;
        const eulerGain   = Euler.continuousEarnings(stakedKENO, this.stats.effectiveAPR, t);
        const simpleGain  = annualEarnings * t;
        const eulerPrem   = Math.max(0, eulerGain - simpleGain);
        this.stats.eulerPremium = parseFloat((eulerPrem * this._kenoPrice).toFixed(4)); // in USD

        // Golden Ratio multiplier
        const phi = this._computeGoldenMultiplier(days);
        this.stats.goldenMultiplier = parseFloat(phi.toFixed(4));
        this.stats.effectiveAPR     = parseFloat((PORV_APR * phi).toFixed(4));

        // Nash: staking is dominant strategy when staker pool > defection opportunity
        const nash = Nash.payoffMatrix(stakedKENO * this._kenoPrice, 1, stakedKENO, stakedKENO * 2);
        this.stats.nashScore = nash.nashScore;

        // Ramanujan milestone: 1729 KENO compounded
        if (!this.stats.ramanujanMilestone && this.stats.totalCompounded >= RAMANUJAN_TARGET) {
            this.stats.ramanujanMilestone = true;
            this._log(`🌟 Ramanujan Milestone: ${RAMANUJAN_TARGET} KENO auto-compounded!`);
            this._alert(`🌟 <b>Ramanujan Milestone — PoRV Optimizer</b>\n${RAMANUJAN_TARGET} KENO has been auto-compounded!\nThe 1729 milestone — the smallest number expressible as the sum of two cubes in two different ways.\nYour stack is compounding in ways most people never see.`);
        }

        // Projected monthly income
        const monthlyKENO = stakedKENO * (this.stats.effectiveAPR / 12);
        this.stats.projectedMonthly = parseFloat((monthlyKENO * this._kenoPrice).toFixed(4));
    }

    // ── Core scan ─────────────────────────────────────────────────────────────
    async _scan() {
        this._initProvider();
        this.stats.scanCount++;
        this.stats.lastScan    = new Date().toISOString();
        this.stats.daysStaked  = (Date.now() - this._stakeStartEpoch) / 86_400_000;

        try {
            // Refresh KENO price every 5 scans
            if (this.stats.scanCount % 5 === 1) await this._fetchKenoPrice();

            const staking = new ethers.Contract(STAKING_ADDR, STAKING_ABI, this._provider);

            // Read staked balance + pending rewards
            let stakedKENO = 0, pendingKENO = 0, totalStaked = 0;
            try {
                const [staked, pending, ts] = await Promise.all([
                    staking.stakedBalance(BOT_WALLET),
                    staking.pendingRewards(BOT_WALLET),
                    staking.totalStaked(),
                ]);
                stakedKENO  = parseFloat(ethers.formatEther(staked));
                pendingKENO = parseFloat(ethers.formatEther(pending));
                totalStaked = parseFloat(ethers.formatEther(ts));
            } catch (err) {
                this._log(`⚠️ Staking contract read failed: ${err.message} — monitoring continues`);
                // Continue with zero balances — contract may not be live yet
            }

            this.stats.stakedKENO     = parseFloat(stakedKENO.toFixed(2));
            this.stats.pendingRewards = parseFloat(pendingKENO.toFixed(4));

            this._updateLaws(stakedKENO, pendingKENO);

            // Benford monitoring on pending rewards
            if (this.stats.scanCount % 15 === 0 && this.stats.scanCount > 0) {
                const recentPending = this.logs
                    .filter(l => l.msg.includes('pending'))
                    .slice(0, 15)
                    .map(l => { const m = l.msg.match(/([\d.]+)\s*KENO pending/i); return m ? parseFloat(m[1]) : null; })
                    .filter(Boolean);
                if (recentPending.length >= 5) {
                    try {
                        const bf = Benford.monitor(recentPending);
                        if (bf && bf.anomaly) { this.stats.benfordAlerts++; this._log('⚠️ Benford: unusual reward pattern — contract may be manipulated'); }
                    } catch (_) {}
                }
            }

            this._log(
                `⛏ Staked: ${stakedKENO.toFixed(0)} KENO | Pending: ${pendingKENO.toFixed(4)} KENO | ` +
                `φ×${this.stats.goldenMultiplier} | APR: ${(this.stats.effectiveAPR * 100).toFixed(2)}% | ` +
                `Monthly: $${this.stats.projectedMonthly.toFixed(2)}`
            );

            // Auto-compound if threshold met
            if (this.autoCompound && pendingKENO >= parseFloat(ethers.formatEther(COMPOUND_THRESHOLD))) {
                await this._compound(staking, pendingKENO, stakedKENO);
            } else if (pendingKENO > 0) {
                this._log(`💤 ${pendingKENO.toFixed(4)} KENO pending (threshold: ${ethers.formatEther(COMPOUND_THRESHOLD)} KENO) — waiting to compound`);
            }

        } catch (err) {
            this._log(`❌ Scan error: ${err.message}`);
        }
    }

    async _compound(staking, pendingKENO, stakedKENO) {
        if (!this._wallet) { this._log('⚠️ No wallet key — cannot auto-compound'); return; }
        this._log(`🔄 Auto-compounding ${pendingKENO.toFixed(4)} KENO...`);

        try {
            // Kaprekar absorb: dust flows to participant (first bucket = staker = you)
            const [restake, burn, fee] = Kaprekar.absorb(pendingKENO, [0.60, 0.25, 0.15]);
            this._log(`📐 Kaprekar split — Restake: ${restake.toFixed(4)} | Burn: ${burn.toFixed(4)} | Protocol: ${fee.toFixed(4)}`);

            // Claim rewards
            const stakingW = staking.connect(this._wallet);
            const claimTx  = await stakingW.claimRewards({ gasPrice: ethers.parseUnits('1', 'gwei'), gasLimit: 100_000 });
            await claimTx.wait(1);
            this._log(`✅ Claimed ${pendingKENO.toFixed(4)} KENO — TX: ${claimTx.hash}`);

            // Approve + restake the 60% portion
            const kenoContract = new ethers.Contract(KENO_V2, ERC20_ABI, this._wallet);
            const restakeAmt   = ethers.parseEther(restake.toFixed(18));
            const approveTx    = await kenoContract.approve(STAKING_ADDR, restakeAmt, { gasPrice: ethers.parseUnits('1', 'gwei'), gasLimit: 60_000 });
            await approveTx.wait(1);

            const stakeTx = await stakingW.stake(restakeAmt, { gasPrice: ethers.parseUnits('1', 'gwei'), gasLimit: 120_000 });
            await stakeTx.wait(1);
            this._log(`✅ Restaked ${restake.toFixed(4)} KENO — TX: ${stakeTx.hash}`);

            // Update cumulative stats
            this.stats.totalClaimed    += pendingKENO;
            this.stats.totalCompounded += restake;
            this.stats.lastCompound     = new Date().toISOString();

            // Euler premium on this compound
            const eulerBonus = Euler.eulerPremium(restake, this.stats.effectiveAPR, 1 / 365) * this._kenoPrice;

            this._alert(
                `⛏ <b>PoRV Optimizer — Auto-Compounded!</b>\n` +
                `<b>Claimed:</b> ${pendingKENO.toFixed(4)} KENO\n` +
                `<b>Restaked (60%):</b> ${restake.toFixed(4)} KENO\n` +
                `<b>New Total Staked:</b> ${(stakedKENO + restake).toFixed(0)} KENO\n` +
                `<b>φ Multiplier:</b> ×${this.stats.goldenMultiplier}\n` +
                `<b>Effective APR:</b> ${(this.stats.effectiveAPR * 100).toFixed(2)}%\n` +
                `<b>Euler Bonus (today):</b> +$${eulerBonus.toFixed(4)}\n` +
                `<b>Projected Monthly:</b> $${this.stats.projectedMonthly.toFixed(2)}`
            );

        } catch (err) {
            this._log(`❌ Compound failed: ${err.message}`);
        }
    }

    // ── Manual trigger ────────────────────────────────────────────────────────
    async triggerCompound() {
        this._initProvider();
        const staking = new ethers.Contract(STAKING_ADDR, STAKING_ABI, this._provider);
        const pending = await staking.pendingRewards(BOT_WALLET);
        const pendingKENO = parseFloat(ethers.formatEther(pending));
        const staked  = await staking.stakedBalance(BOT_WALLET);
        const stakedKENO  = parseFloat(ethers.formatEther(staked));
        await this._compound(staking, pendingKENO, stakedKENO);
        return { success: true, pendingKENO, stakedKENO };
    }

    // ── Start / Stop / Config ─────────────────────────────────────────────────
    start(autoCompound = false) {
        if (this.running) return { success: false, msg: 'PoRV Optimizer already running' };
        this.autoCompound = autoCompound;
        this.running      = true;
        this.startedAt    = new Date().toISOString();
        this._scan();
        this._timer = setInterval(() => this._scan(), SCAN_INTERVAL_MS);
        this._log(`⛏ PoRV Optimizer started (auto-compound: ${autoCompound})`);
        return { success: true, msg: 'PoRV Optimizer started' };
    }

    stop() {
        this.running = false;
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        this._log('🛑 PoRV Optimizer stopped');
        return { success: true, msg: 'stopped' };
    }

    getStatus() {
        return {
            name:         'PoRV Mining Optimizer (Bot 4)',
            running:      this.running,
            autoCompound: this.autoCompound,
            startedAt:    this.startedAt,
            contracts:    { staking: STAKING_ADDR, keno: KENO_V2, wallet: BOT_WALLET },
            stats:        this.stats,
            recentLogs:   this.logs.slice(0, 30),
        };
    }
}

module.exports = PoRVOptimizer;

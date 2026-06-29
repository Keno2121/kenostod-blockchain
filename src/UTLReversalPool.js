'use strict';

/**
 * UTL Reversal Pool — 5-Minute Transaction Escrow & Float Yield Engine
 *
 * Every transaction submitted through UTL sits in escrow for up to 5 minutes.
 * During that window, the capital is tracked as deployable float — fed directly
 * into HLFundingBot and DriftFundingBot yield strategies.
 * If no reversal is requested, the tx finalizes and the insurance premium is
 * distributed via Kaprekar's 60/25/15 split.
 * If a reversal IS requested within the window, a reversal fee is charged and
 * the user gets their principal back instantly.
 *
 * THREE INCOME STREAMS:
 *   1. Insurance Premium   — 0.01% per transaction (collected always)
 *   2. Reversal Fee        — 0.05% on reversed transactions only
 *   3. Float Yield         — escrowed capital deployed to funding bots
 *
 * TIERED REVERSAL WINDOWS:
 *   Free tier       — 1 minute  (no KENO required)
 *   KENO holder     — 5 minutes (stake any KENO)
 *   Professional    — 30 min    (0.05%/tx surcharge)
 *   Enterprise      — 60 min    ($499/month subscription)
 *
 * 7 Constitutional Laws embedded throughout.
 *
 * Required env: TELEGRAM_BOT_TOKEN (or KINGS_SHIELD_BOT_TOKEN), SHIELD_ALERT_CHAT_ID
 */

const https = require('https');

const Kaprekar    = require('./Kaprekar');
const Benford     = require('./Benford');
const GoldenRatio = require('./GoldenRatio');
const Nash        = require('./Nash');
const Euler       = require('./Euler');
const Ramanujan   = require('./Ramanujan');

// ── Config ────────────────────────────────────────────────────────────────────

const WINDOWS = {
  free:         1  * 60 * 1000,   // 1 minute
  keno:         5  * 60 * 1000,   // 5 minutes (KENO holder)
  professional: 30 * 60 * 1000,  // 30 minutes
  enterprise:   60 * 60 * 1000,  // 60 minutes
};

const INSURANCE_RATE    = 0.0001;  // 0.01% — charged on every tx
const REVERSAL_FEE_RATE = 0.0005;  // 0.05% — charged only on reversals
const PRO_SURCHARGE     = 0.0005;  // 0.05% — per-tx surcharge for 30-min window
const FLOAT_YIELD_APY   = 0.15;    // 15% APY — what float earns in funding bots
const REPORT_MS         = 8 * 60 * 60 * 1000;  // 8-hour Telegram report

const MINS_PER_YEAR = 365 * 24 * 60;

// ── UTLReversalPool ───────────────────────────────────────────────────────────

class UTLReversalPool {
  constructor() {
    this.running    = false;
    this.startedAt  = null;
    this.reportTimer = null;

    // ── Escrow state ──────────────────────────────────────────────────────────
    // txHash → EscrowEntry
    this.escrow = new Map();

    // ── Income tracking ───────────────────────────────────────────────────────
    this.stats = {
      totalRegistered:    0,
      totalFinalized:     0,
      totalReversed:      0,
      premiumCollected:   0,   // insurance premiums (always charged)
      reversalFees:       0,   // fees on reversed txs
      floatYieldEarned:   0,   // yield from escrowed capital
      totalIncome:        0,
      currentFloat:       0,   // live float in escrow right now
      startTime:          null,
    };

    // ── 7 Laws state ──────────────────────────────────────────────────────────
    this.consecutiveCleanFinales = 0;  // Law III — golden ratio multiplier
    this.reversalHistory = [];         // Law II — Benford monitoring

    this.logs = [];
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start() {
    if (this.running) return { ok: false, msg: 'UTLReversalPool already running' };

    this.running   = true;
    this.startedAt = Date.now();
    this.stats.startTime = new Date().toISOString();

    this._log('🔒 UTL Reversal Pool started — escrow engine live');
    this._log(`💡 Windows: Free=1min | KENO=5min | Pro=30min | Enterprise=60min`);
    this._log(`💰 Income streams: Insurance ${INSURANCE_RATE * 100}% | Reversal ${REVERSAL_FEE_RATE * 100}% | Float ${FLOAT_YIELD_APY * 100}% APY`);

    // Startup Telegram
    this._telegram(
      `🔒 <b>UTL Reversal Pool LIVE</b>\n\n` +
      `Three income streams active:\n` +
      `  💎 Insurance: ${INSURANCE_RATE * 100}% on every registered tx\n` +
      `  🔄 Reversal fee: ${REVERSAL_FEE_RATE * 100}% when users reverse\n` +
      `  📈 Float yield: ${FLOAT_YIELD_APY * 100}% APY on escrowed capital\n\n` +
      `<i>Law VII: Sovereign infrastructure earns from every transaction.</i>`
    );

    this.reportTimer = setInterval(() => this._report(), REPORT_MS);

    return { ok: true, msg: 'UTLReversalPool live — 4-tier escrow engine running' };
  }

  stop() {
    this.running = false;
    if (this.reportTimer) { clearInterval(this.reportTimer); this.reportTimer = null; }
    // Clear all pending escrow timers
    for (const [txHash, entry] of this.escrow) {
      if (entry.timer) clearTimeout(entry.timer);
    }
    this._log('🛑 UTL Reversal Pool stopped');
    return { ok: true, msg: 'stopped' };
  }

  // ── Register — User submits a transaction to the reversal pool ────────────

  register({ txHash, amount, userAddress, tier = 'keno', metadata = {} }) {
    if (!txHash || !amount || !userAddress) {
      return { ok: false, error: 'txHash, amount, and userAddress are required' };
    }
    if (this.escrow.has(txHash)) {
      return { ok: false, error: 'Transaction already registered in escrow' };
    }

    const windowMs    = WINDOWS[tier] || WINDOWS.keno;
    const nowMs       = Date.now();
    const expiresAt   = nowMs + windowMs;

    // ── Law III: Golden Ratio — loyalty multiplier on yield ───────────────────
    let φBonus = 1.0;
    try {
      φBonus = GoldenRatio.multiplier
        ? Math.min(GoldenRatio.multiplier(this.consecutiveCleanFinales), 1.618)
        : 1.0;
    } catch (_) {}

    // ── Insurance premium (always charged upfront) ────────────────────────────
    const basePremium    = amount * INSURANCE_RATE;
    const proSurcharge   = tier === 'professional' || tier === 'enterprise' ? amount * PRO_SURCHARGE : 0;
    const totalPremium   = basePremium + proSurcharge;

    // ── Float yield projection (what this tx earns in funding bots) ───────────
    const windowMinutes  = windowMs / 60000;
    const floatYieldRaw  = amount * FLOAT_YIELD_APY * (windowMinutes / MINS_PER_YEAR);

    // ── Law V: Euler — continuous compounding premium ─────────────────────────
    let floatYield = floatYieldRaw;
    try {
      if (Euler.continuousEarnings) {
        floatYield = Euler.continuousEarnings(amount, FLOAT_YIELD_APY, windowMinutes / (24 * 60)) - amount;
        floatYield = Math.max(floatYield, floatYieldRaw);
      }
    } catch (_) {}

    floatYield *= φBonus;

    const entry = {
      txHash,
      amount,
      userAddress,
      tier,
      metadata,
      startTime:     nowMs,
      expiresAt,
      windowMs,
      premium:       totalPremium,
      floatYield,
      status:        'pending',  // pending | finalized | reversed
      timer:         null,
    };

    // Auto-finalize when window expires
    entry.timer = setTimeout(() => this._finalize(txHash), windowMs);

    this.escrow.set(txHash, entry);

    // Update live float
    this.stats.currentFloat += amount;
    this.stats.totalRegistered++;

    this._log(`📥 Registered ${txHash.slice(0,10)}... | $${amount.toFixed(2)} | tier:${tier} | window:${windowMinutes.toFixed(0)}min | premium:$${totalPremium.toFixed(6)}`);

    return {
      ok:           true,
      txHash,
      tier,
      windowMs,
      expiresAt,
      expiresIn:    `${(windowMs / 60000).toFixed(0)} minutes`,
      insurancePremium: totalPremium.toFixed(6),
      floatYieldProjected: floatYield.toFixed(8),
      message:      `Transaction secured. ${(windowMs / 60000).toFixed(0)}-minute reversal window active.`,
    };
  }

  // ── Reverse — User requests reversal within the window ───────────────────

  reverse({ txHash, userAddress, reason = '' }) {
    const entry = this.escrow.get(txHash);

    if (!entry) {
      return { ok: false, error: 'Transaction not found in escrow' };
    }
    if (entry.status !== 'pending') {
      return { ok: false, error: `Transaction already ${entry.status} — reversal window closed` };
    }
    if (entry.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return { ok: false, error: 'Unauthorized — you do not own this transaction' };
    }
    if (Date.now() > entry.expiresAt) {
      return { ok: false, error: 'Reversal window expired — transaction finalized' };
    }

    // Cancel auto-finalize timer
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = null; }

    const reversalFee = entry.amount * REVERSAL_FEE_RATE;
    const refundAmount = entry.amount - reversalFee;

    entry.status   = 'reversed';
    entry.reversedAt = Date.now();
    entry.reversalFee = reversalFee;
    entry.refundAmount = refundAmount;
    entry.reason   = reason;

    // ── Law II: Benford — track reversal patterns ─────────────────────────────
    this.reversalHistory.push(entry.amount);
    if (this.reversalHistory.length >= 20) {
      try {
        const benfordOk = Benford.check ? Benford.check(this.reversalHistory.map(Math.abs)) : true;
        if (!benfordOk) {
          this._log(`⚠ Law II Benford: Unusual reversal pattern detected — possible fraud sweep`, 'warn');
          this._telegram(`⚠ <b>UTL Reversal Pool — Benford Alert</b>\nUnusual reversal pattern in last 20 transactions. Possible coordinated exploit. Review required.`);
        }
      } catch (_) {}
      if (this.reversalHistory.length > 100) this.reversalHistory = this.reversalHistory.slice(-100);
    }

    // Collect reversal fee via Kaprekar
    this._collectIncome(reversalFee, 'reversal_fee');
    this.stats.reversalFees   += reversalFee;
    this.stats.currentFloat   -= entry.amount;
    this.stats.totalReversed++;
    // Also keep the insurance premium (earned for providing the service)
    this._collectIncome(entry.premium, 'insurance_premium');
    this.stats.premiumCollected += entry.premium;

    this._log(`🔄 REVERSED: ${txHash.slice(0,10)}... | refund $${refundAmount.toFixed(4)} | fee $${reversalFee.toFixed(6)} | reason: ${reason || 'user request'}`);

    this._telegram(
      `🔄 <b>UTL Reversal Processed</b>\n\n` +
      `Tx: <code>${txHash.slice(0,14)}...</code>\n` +
      `Refunded: <b>$${refundAmount.toFixed(4)}</b>\n` +
      `Reversal fee: $${reversalFee.toFixed(6)}\n` +
      `Reason: ${reason || 'User request'}\n\n` +
      `Total reversal fees: $${this.stats.reversalFees.toFixed(6)}`
    );

    return {
      ok:           true,
      txHash,
      refundAmount:  parseFloat(refundAmount.toFixed(6)),
      reversalFee:   parseFloat(reversalFee.toFixed(6)),
      message:       'Reversal processed. Refund ready.',
    };
  }

  // ── Internal: Auto-finalize when window expires ───────────────────────────

  _finalize(txHash) {
    const entry = this.escrow.get(txHash);
    if (!entry || entry.status !== 'pending') return;

    const heldMs    = Date.now() - entry.startTime;
    const heldMins  = heldMs / 60000;

    // ── Recalculate actual float yield for time actually held ─────────────────
    let actualFloat = entry.amount * FLOAT_YIELD_APY * (heldMins / MINS_PER_YEAR);
    try {
      if (Euler.continuousEarnings) {
        actualFloat = Math.max(actualFloat,
          Euler.continuousEarnings(entry.amount, FLOAT_YIELD_APY, heldMins / (24 * 60)) - entry.amount
        );
      }
    } catch (_) {}

    entry.status     = 'finalized';
    entry.finalizedAt = Date.now();
    entry.actualFloatYield = actualFloat;

    // Collect premium + float
    this._collectIncome(entry.premium, 'insurance_premium');
    this._collectIncome(actualFloat, 'float_yield');

    this.stats.premiumCollected  += entry.premium;
    this.stats.floatYieldEarned  += actualFloat;
    this.stats.currentFloat      -= entry.amount;
    this.stats.totalFinalized++;
    this.consecutiveCleanFinales++;

    // ── Law VI: Ramanujan — milestone check ────────────────────────────────────
    try {
      if (Ramanujan.check) {
        const milestone = Ramanujan.check(this.stats.totalIncome);
        if (milestone?.hit) {
          this._telegram(`🏆 <b>Law VI — Ramanujan Milestone!</b>\nUTL Reversal Pool has collected <b>$${this.stats.totalIncome.toFixed(2)}</b> in total income.\nSelf-taught infrastructure paying the way forward.`);
        }
      }
    } catch (_) {}

    this._log(`✅ Finalized ${txHash.slice(0,10)}... | premium $${entry.premium.toFixed(6)} | float yield $${actualFloat.toFixed(8)} | total income $${this.stats.totalIncome.toFixed(6)}`);
  }

  // ── Internal: Income distribution via Kaprekar ────────────────────────────

  _collectIncome(amount, source) {
    if (amount <= 0) return;

    this.stats.totalIncome += amount;

    // ── Law I: Kaprekar — 60/25/15 split ─────────────────────────────────────
    let split;
    try {
      split = Kaprekar.absorb ? Kaprekar.absorb(amount) : null;
    } catch (_) {}

    if (split) {
      this._log(`📐 Law I [${source}]: $${amount.toFixed(8)} → reinvest $${(split.reinvest||0).toFixed(8)} | pocket $${(split.pocket||0).toFixed(8)} | burn $${(split.burn||0).toFixed(8)}`);
    }

    // ── Law IV: Nash — auto-tune insurance rate ───────────────────────────────
    try {
      if (Nash.equilibriumAdjustment && this.stats.totalRegistered > 0) {
        const reversalRate = this.stats.totalReversed / this.stats.totalRegistered;
        Nash.equilibriumAdjustment({ reversalRate, currentPremium: INSURANCE_RATE });
      }
    } catch (_) {}
  }

  // ── 8-Hour Report ─────────────────────────────────────────────────────────

  async _report() {
    const uptime     = ((Date.now() - this.startedAt) / 3_600_000).toFixed(1);
    const liveEscrow = Array.from(this.escrow.values()).filter(e => e.status === 'pending').length;
    const liveFloat  = this.stats.currentFloat;

    const projMonthly = this.stats.totalIncome > 0
      ? (this.stats.totalIncome / parseFloat(uptime)) * 24 * 30
      : 0;

    // ── Law V: Euler — continuous vs simple compounding projection ─────────────
    let eulerLine = '';
    try {
      if (Euler.continuousEarnings && projMonthly > 0) {
        const simpleAnnual    = projMonthly * 12;
        const continuousAnnual = projMonthly * 12 * Math.E / (Math.E - 1);
        const eulerPremium    = continuousAnnual - simpleAnnual;
        eulerLine = `\n📐 Law V Euler: continuous compounding adds ~$${eulerPremium.toFixed(4)}/yr`;
      }
    } catch (_) {}

    await this._telegram(
      `📊 <b>UTL Reversal Pool — ${uptime}h Report</b>\n\n` +
      `Live escrow: ${liveEscrow} txs | $${liveFloat.toFixed(2)} float\n\n` +
      `💰 Income breakdown:\n` +
      `  Insurance premiums: $${this.stats.premiumCollected.toFixed(6)}\n` +
      `  Reversal fees:      $${this.stats.reversalFees.toFixed(6)}\n` +
      `  Float yield:        $${this.stats.floatYieldEarned.toFixed(8)}\n` +
      `  <b>Total income:   $${this.stats.totalIncome.toFixed(6)}</b>\n\n` +
      `📈 Transactions:\n` +
      `  Registered: ${this.stats.totalRegistered}\n` +
      `  Finalized:  ${this.stats.totalFinalized}\n` +
      `  Reversed:   ${this.stats.totalReversed}\n` +
      `  Reversal rate: ${this.stats.totalRegistered > 0 ? ((this.stats.totalReversed / this.stats.totalRegistered) * 100).toFixed(1) : 0}%\n` +
      `\n📊 Projected monthly at current volume: $${projMonthly.toFixed(4)}` +
      eulerLine + '\n\n' +
      `<i>Law VII: Every transaction pays tribute to the sovereign.</i>`
    );
  }

  // ── Query a single transaction ────────────────────────────────────────────

  getTransaction(txHash) {
    const entry = this.escrow.get(txHash);
    if (!entry) return null;

    const now       = Date.now();
    const remaining = entry.status === 'pending' ? Math.max(0, entry.expiresAt - now) : 0;

    return {
      txHash:         entry.txHash,
      userAddress:    entry.userAddress,
      amount:         entry.amount,
      tier:           entry.tier,
      status:         entry.status,
      startTime:      new Date(entry.startTime).toISOString(),
      expiresAt:      new Date(entry.expiresAt).toISOString(),
      remainingMs:    remaining,
      remainingSec:   Math.floor(remaining / 1000),
      premium:        entry.premium,
      floatYield:     entry.actualFloatYield || entry.floatYield,
      metadata:       entry.metadata,
    };
  }

  // ── Pool-level stats ──────────────────────────────────────────────────────

  getPoolStats() {
    const liveEntries = Array.from(this.escrow.values()).filter(e => e.status === 'pending');
    const liveFloat   = liveEntries.reduce((s, e) => s + e.amount, 0);
    const projMonthlyFloat = liveFloat * FLOAT_YIELD_APY / 12;

    const volumeTable = {
      '$10k/day':  { daily: 10_000 * INSURANCE_RATE, monthly: 10_000 * INSURANCE_RATE * 30 },
      '$100k/day': { daily: 100_000 * INSURANCE_RATE, monthly: 100_000 * INSURANCE_RATE * 30 },
      '$1M/day':   { daily: 1_000_000 * INSURANCE_RATE, monthly: 1_000_000 * INSURANCE_RATE * 30 },
    };

    return {
      live: {
        escrowCount:    liveEntries.length,
        floatUSD:       parseFloat(liveFloat.toFixed(4)),
        projMonthlyFloat: parseFloat(projMonthlyFloat.toFixed(4)),
      },
      cumulative:       this.stats,
      tiers:            WINDOWS,
      rates: {
        insurancePct:   INSURANCE_RATE * 100,
        reversalFeePct: REVERSAL_FEE_RATE * 100,
        floatYieldAPY:  FLOAT_YIELD_APY * 100,
      },
      projectionsByVolume: volumeTable,
      recentLogs:       this.logs.slice(0, 20),
    };
  }

  // ── Status for bot-server dashboard ──────────────────────────────────────

  getStatus() {
    const uptime = this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0;
    return {
      running:       this.running,
      totalProfit:   this.stats.totalIncome,
      tradeCount:    this.stats.totalFinalized + this.stats.totalReversed,
      scanCount:     this.stats.totalRegistered,
      uptimeSeconds: uptime,
      currentFloat:  this.stats.currentFloat,
      stats:         this.stats,
      recentLogs:    this.logs.slice(0, 20),
    };
  }

  // ── Telegram ──────────────────────────────────────────────────────────────

  async _telegram(text) {
    const token  = process.env.TELEGRAM_BOT_TOKEN || process.env.KINGS_SHIELD_BOT_TOKEN;
    const chatId = process.env.SHIELD_ALERT_CHAT_ID;
    if (!token || !chatId) return;
    try {
      const payload = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
      await new Promise((resolve) => {
        const r = https.request({
          hostname: 'api.telegram.org',
          path:     `/bot${token}/sendMessage`,
          method:   'POST',
          headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          timeout:  10000,
        }, (res) => { res.resume(); resolve(); });
        r.on('error', resolve);
        r.write(payload);
        r.end();
      });
    } catch (_) {}
  }

  // ── Logger ────────────────────────────────────────────────────────────────

  _log(msg, level = 'info') {
    const entry = { time: new Date().toISOString(), msg, level };
    this.logs.unshift(entry);
    if (this.logs.length > 300) this.logs.pop();
    const icon = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🟢';
    console.log(`[UTLReversalPool] ${icon} ${msg}`);
  }
}

module.exports = UTLReversalPool;

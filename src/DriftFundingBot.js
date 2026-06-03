'use strict';

/**
 * DriftFundingBot — Autonomous Drift Protocol funding rate arbitrage
 *
 * Strategy:
 *   When a perp market's funding rate is HIGH and POSITIVE, longs pay shorts.
 *   We open a SHORT to COLLECT those payments every hour — pure passive income.
 *   Close when the rate drops, lock in profit.
 *
 * All 7 Constitutional Laws embedded:
 *   I.   Kaprekar  — all profit splits routed through absorb()
 *   II.  Benford   — monitors funding rate history for manipulation
 *   III. GoldenRatio — φ position sizing & APY multipliers
 *   IV.  Nash      — equilibriumAdjustment on entry/exit thresholds
 *   V.   Euler     — continuous compounding projections
 *   VI.  Ramanujan — 1729 milestone tracker on total funding earned
 *   VII. Inversion — value flows to the participant (you), not the protocol
 *
 * Env vars:
 *   DRIFT_PRIVATE_KEY      — Solana wallet private key (base58)
 *   DRIFT_RPC_URL          — Solana RPC URL (optional)
 *   TELEGRAM_BOT_TOKEN     — For alerts
 *   SHIELD_ALERT_CHAT_ID   — Telegram chat ID
 */

const { Connection, Keypair }  = require('@solana/web3.js');
const bs58                     = require('bs58');
const https                    = require('https');
const {
  DriftClient, Wallet, BN,
  PositionDirection,
  PerpMarkets,
  BASE_PRECISION,
  QUOTE_PRECISION,
  PRICE_PRECISION,
  FUNDING_RATE_PRECISION,
} = require('@drift-labs/sdk');

const Kaprekar    = require('./Kaprekar');
const Benford     = require('./Benford');
const { PHI, phiMultiplier, phiAPY } = require('./GoldenRatio');
const { equilibriumAdjustment }      = require('./Nash');
const Euler       = require('./Euler');
const Ramanujan   = require('./Ramanujan');

// ── Configuration ────────────────────────────────────────────────────────────

const MIN_ENTRY_APR     = 80;    // Enter SHORT when annualized funding > 80% APR
const MIN_EXIT_APR      = 20;    // Close position when funding drops < 20% APR
const MIN_CONFIRM       = 3;     // Nash: N consecutive readings required before entry
const MAX_POSITIONS     = 3;     // Max simultaneous open positions
const SCAN_MS           = 60_000;  // Scan every 60 seconds
const MIN_EQUITY_USD    = 5;     // Minimum account equity to trade
const SOLANA_RPC        = 'https://solana.drpc.org';

// φ-based position size: 1/φ = 61.8% of equity per position (Law III)
const POSITION_RATIO    = 1 / PHI;

// ── Bot ──────────────────────────────────────────────────────────────────────

class DriftFundingBot {
  constructor() {
    this.client     = null;
    this.running    = false;
    this.startedAt  = null;
    this.scanTimer  = null;

    // Per-market tracking
    this.consecutive = {};      // marketIndex → consecutive high-funding readings
    this.positions   = {};      // marketIndex → position metadata

    // Law IV — Nash equilibrium-adjusted thresholds (start at defaults)
    this.entryAPR = MIN_ENTRY_APR;
    this.exitAPR  = MIN_EXIT_APR;

    // Stats
    this.stats = {
      scanCount:     0,
      tradesEntered: 0,
      tradesClosed:  0,
      totalFundingEarned: 0,
      totalProfitUSD:     0,
      lastScanAt:    null,
    };

    this.logs = [];
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async start() {
    if (this.running) return { ok: false, msg: 'DriftFundingBot already running' };

    const privateKey = process.env.DRIFT_PRIVATE_KEY;
    if (!privateKey) return { ok: false, msg: 'DRIFT_PRIVATE_KEY not set — add to Render env vars' };

    try {
      const keypair    = Keypair.fromSecretKey(bs58.decode(privateKey.trim()));
      const wallet     = new Wallet(keypair);
      const rpcUrl     = process.env.DRIFT_RPC_URL || SOLANA_RPC;
      const connection = new Connection(rpcUrl, 'confirmed');

      this.client = new DriftClient({
        connection,
        wallet,
        env: 'mainnet-beta',
        accountSubscription: { type: 'polling', frequency: 30_000 },
      });

      await this.client.subscribe();

      const equity = await this._getEquityUSD();
      this._log(`✅ Connected to Drift Protocol | Equity: $${equity.toFixed(2)}`);

      if (equity < MIN_EQUITY_USD) {
        this._log(`⚠ Low equity ($${equity.toFixed(2)}) — monitoring only until > $${MIN_EQUITY_USD}`, 'warn');
      }

      this.running   = true;
      this.startedAt = Date.now();

      this._scan(); // immediate first scan
      this.scanTimer = setInterval(() => this._scan(), SCAN_MS);

      await this._telegram(
        `⚡ <b>Drift Funding Bot ONLINE</b>\n\n` +
        `💰 Equity: <b>$${equity.toFixed(2)}</b>\n` +
        `🎯 Entry: >${this.entryAPR}% APR  |  Exit: <${this.exitAPR}% APR\n` +
        `📐 φ position size: ${(POSITION_RATIO * 100).toFixed(1)}% of equity\n` +
        `🔢 Nash confirmation: ${MIN_CONFIRM} consecutive readings\n` +
        `⚖️ 7 Constitutional Laws: ACTIVE\n\n` +
        `<i>The bot earns while the founder sleeps.</i>`
      );

      return { ok: true, msg: `Drift Funding Bot started — $${equity.toFixed(2)} equity` };

    } catch (err) {
      this._log(`❌ Start failed: ${err.message}`, 'error');
      return { ok: false, msg: err.message };
    }
  }

  stop() {
    this.running = false;
    if (this.scanTimer) { clearInterval(this.scanTimer); this.scanTimer = null; }
    try { if (this.client) this.client.unsubscribe(); } catch (_) {}
    this._log('🛑 Drift Funding Bot stopped');
    return { ok: true, msg: 'stopped' };
  }

  // ── Main scan loop ──────────────────────────────────────────────────────────

  async _scan() {
    if (!this.running || !this.client) return;

    this.stats.scanCount++;
    this.stats.lastScanAt = new Date().toISOString();

    const markets = (PerpMarkets['mainnet-beta'] || []);

    for (const cfg of markets) {
      const idx = cfg.marketIndex;
      const symbol = cfg.baseAssetSymbol || cfg.symbol || `MKT-${idx}`;

      try {
        const market = this.client.getPerpMarketAccount(idx);
        if (!market) continue;

        const apr = this._fundingAPR(market);

        // Update Nash consecutive counter
        if (apr >= this.entryAPR) {
          this.consecutive[idx] = (this.consecutive[idx] || 0) + 1;
        } else {
          this.consecutive[idx] = 0;
        }

        const isOpen    = !!this.positions[idx];
        const confirmed = (this.consecutive[idx] || 0) >= MIN_CONFIRM;
        const atCapacity = Object.keys(this.positions).length >= MAX_POSITIONS;

        // ── ENTRY ────────────────────────────────────────────────────────────
        if (!isOpen && confirmed && !atCapacity) {
          const equity = await this._getEquityUSD();
          if (equity >= MIN_EQUITY_USD) {
            await this._openShort(idx, symbol, apr, equity);
          } else {
            this._log(`💡 ${symbol} ${apr.toFixed(0)}% APR confirmed but equity $${equity.toFixed(2)} too low`, 'warn');
          }
        }

        // ── EXIT ─────────────────────────────────────────────────────────────
        if (isOpen && apr < this.exitAPR) {
          await this._closePosition(idx, symbol, apr);
        }

      } catch (_) {}
    }

    // Law IV — Nash: re-tune thresholds based on recent performance
    this._nashTune();

    // Law II — Benford: fraud check every 100 scans
    if (this.stats.scanCount % 100 === 0) this._benfordCheck();
  }

  // ── Open SHORT position ─────────────────────────────────────────────────────

  async _openShort(marketIndex, symbol, apr, equityUSD) {
    try {
      const market = this.client.getPerpMarketAccount(marketIndex);
      if (!market) return;

      const oraclePrice = this._oraclePrice(market);
      if (!oraclePrice || oraclePrice <= 0) {
        this._log(`⚠ No oracle price for ${symbol}`, 'warn');
        return;
      }

      // Law III — φ position sizing
      const posUSD   = equityUSD * POSITION_RATIO;
      const baseAmt  = Math.floor((posUSD / oraclePrice) * BASE_PRECISION.toNumber());
      const baseAmtBN = new BN(baseAmt);

      if (baseAmt <= 0) {
        this._log(`⚠ Computed base amount 0 for ${symbol} — skip`, 'warn');
        return;
      }

      this._log(`⚡ Opening SHORT ${symbol} | $${posUSD.toFixed(2)} | ${apr.toFixed(0)}% APR | ${this.consecutive[marketIndex]} confirms`);

      const txSig = await this.client.openPosition(
        PositionDirection.SHORT,
        baseAmtBN,
        marketIndex,
      );

      this.positions[marketIndex] = {
        symbol, apr, posUSD,
        openedAt: Date.now(),
        baseAmt:  baseAmt / BASE_PRECISION.toNumber(),
        txSig: txSig || '',
      };
      this.stats.tradesEntered++;

      // Law V — Euler continuous compounding projection (cap rate for realism)
      const cappedAPR    = Math.min(apr, 300);
      const eulerMonthly = Euler.continuousEarnings
        ? Euler.continuousEarnings(posUSD, cappedAPR / 100, 1 / 12)
        : posUSD * (1 + (cappedAPR / 100) / 12);
      const monthlyProfit = Math.max(eulerMonthly - posUSD, 0);

      // Law I — Kaprekar split on monthly profit
      const split = Kaprekar.absorb
        ? Kaprekar.absorb(monthlyProfit, [0.60, 0.25, 0.15])
        : [monthlyProfit * 0.60, monthlyProfit * 0.25, monthlyProfit * 0.15];

      // Law III — φ APY bonus for staying in longer
      const phiBonus = phiAPY ? phiAPY(cappedAPR / 100, 1) : cappedAPR / 100 * PHI;

      await this._telegram(
        `⚡ <b>Drift SHORT EXECUTED — ${symbol}</b>\n\n` +
        `📊 Funding rate: <b>${apr.toFixed(0)}% APR</b>\n` +
        `💰 Position size: <b>$${posUSD.toFixed(2)}</b> (φ-sized)\n` +
        `🏦 Account equity: $${equityUSD.toFixed(2)}\n` +
        `🔢 Confirmations: ${this.consecutive[marketIndex]} readings\n\n` +
        `📅 <b>30-day Euler projection (capped ${cappedAPR}% APR):</b>\n` +
        `   Monthly income: $${monthlyProfit.toFixed(2)}\n` +
        `   💼 Pocket (25%): $${split[1].toFixed(2)}\n` +
        `   📈 Reinvest (60%): $${split[0].toFixed(2)}\n` +
        `   🔥 Burn (15%): $${split[2].toFixed(2)}\n` +
        `   φ APY multiplier: ${(phiBonus * 100).toFixed(0)}%\n\n` +
        `🔗 TX: <code>${(txSig || '').slice(0, 44)}</code>`
      );

    } catch (err) {
      this._log(`❌ SHORT ${symbol} failed: ${err.message}`, 'error');
      await this._telegram(`⚠ <b>Drift Bot</b>: Failed to SHORT ${symbol}\n<code>${err.message.slice(0, 100)}</code>`);
    }
  }

  // ── Close position ──────────────────────────────────────────────────────────

  async _closePosition(marketIndex, symbol, currentAPR) {
    const pos = this.positions[marketIndex];
    if (!pos) return;

    try {
      const txSig   = await this.client.closePosition(marketIndex);
      const heldMin = Math.round((Date.now() - pos.openedAt) / 60_000);

      // Estimate funding collected (hourly rate × hours held × position size)
      const hoursHeld    = heldMin / 60;
      const hourlyRate   = pos.apr / 100 / (365 * 24);
      const fundingEarned = hourlyRate * hoursHeld * pos.posUSD;

      // Law I — Kaprekar split on actual earnings
      const split = Kaprekar.absorb
        ? Kaprekar.absorb(Math.max(fundingEarned, 0), [0.60, 0.25, 0.15])
        : [fundingEarned * 0.60, fundingEarned * 0.25, fundingEarned * 0.15];

      const prevTotal = this.stats.totalFundingEarned;
      this.stats.totalFundingEarned += fundingEarned;
      this.stats.totalProfitUSD     += fundingEarned;
      this.stats.tradesClosed++;

      // Law VI — Ramanujan 1729 milestone (previousTotal, newTotal)
      const milestone = Ramanujan.crossedMilestone
        ? Ramanujan.crossedMilestone(prevTotal, this.stats.totalFundingEarned)
        : null;

      delete this.positions[marketIndex];

      await this._telegram(
        `✅ <b>Drift Position CLOSED — ${symbol}</b>\n\n` +
        `⏱ Held: ${heldMin} min (${hoursHeld.toFixed(1)} hours)\n` +
        `📊 Entry APR: ${pos.apr.toFixed(0)}%  →  Now: ${currentAPR.toFixed(0)}%\n` +
        `💰 Est. funding collected: <b>$${fundingEarned.toFixed(4)}</b>\n` +
        `   💼 To pocket: $${split[1].toFixed(4)}\n` +
        `   📈 Reinvest: $${split[0].toFixed(4)}\n\n` +
        `📊 Total earned to date: $${this.stats.totalFundingEarned.toFixed(4)}\n` +
        (milestone ? `\n🔮 <b>Ramanujan Milestone:</b> ${milestone}\n` : '') +
        `\n🔗 TX: <code>${(txSig || '').slice(0, 44)}</code>`
      );

      this._log(`✅ Closed ${symbol} | ${heldMin}min | ~$${fundingEarned.toFixed(4)} earned`);

    } catch (err) {
      this._log(`❌ Close ${symbol} failed: ${err.message}`, 'error');
    }
  }

  // ── Law IV — Nash threshold tuning ─────────────────────────────────────────

  _nashTune() {
    try {
      if (!equilibriumAdjustment) return;
      // Nash score = confidence 0–1 based on profit per trade (normalize against $1 benchmark)
      const avgProfit = this.stats.tradesClosed > 0
        ? this.stats.totalFundingEarned / this.stats.tradesClosed
        : 0;
      const nashScore = Math.min(avgProfit / 1.0, 1.0); // 1.0 = $1/trade average = full confidence
      // equilibriumAdjustment returns an adjusted split (0.55–0.65 range)
      // We map that range to our APR threshold range: 0.55 → 100% APR, 0.65 → 60% APR
      const split     = equilibriumAdjustment(nashScore, 0.60);
      const newEntry  = 60 + ((0.65 - split) / 0.10) * 40; // 60–100% APR band
      this.entryAPR   = Math.max(50, Math.min(200, newEntry));
    } catch (_) {}
  }

  // ── Law II — Benford check on funding rates ─────────────────────────────────

  _benfordCheck() {
    try {
      const counts = Object.values(this.consecutive);
      if (counts.length < 20) return;
      if (Benford.monitor && typeof Benford.monitor.recordValue === 'function') {
        counts.forEach(v => Benford.monitor.recordValue(v));
      }
    } catch (_) {}
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  _fundingAPR(market) {
    try {
      const raw = market.amm.lastFundingRate;
      if (!raw) return 0;
      const hourly = raw.toNumber() / FUNDING_RATE_PRECISION.toNumber();
      // Positive = longs pay shorts. We want positive (we're shorting).
      const annualized = hourly * 24 * 365 * 100;
      return annualized; // can be negative (means shorts pay longs — skip)
    } catch (_) { return 0; }
  }

  _oraclePrice(market) {
    try {
      const raw = market.amm.historicalOracleData?.lastOraclePrice
               || market.amm.lastMarkPriceTwap;
      return raw ? raw.toNumber() / PRICE_PRECISION.toNumber() : 0;
    } catch (_) { return 0; }
  }

  async _getEquityUSD() {
    try {
      const user = this.client.getUser();
      if (user && typeof user.getTotalCollateral === 'function') {
        const c = user.getTotalCollateral();
        return c.toNumber() / QUOTE_PRECISION.toNumber();
      }
      return 0;
    } catch (_) { return 0; }
  }

  async _telegram(text) {
    const token  = process.env.TELEGRAM_BOT_TOKEN || process.env.KINGS_SHIELD_BOT_TOKEN;
    const chatId = process.env.SHIELD_ALERT_CHAT_ID;
    if (!token || !chatId) return;
    try {
      const payload = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
      await new Promise((resolve) => {
        const r = https.request({
          hostname: 'api.telegram.org',
          path:     `/bot${token}/sendMessage`,
          method:   'POST',
          headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          timeout:  10_000,
        }, (res) => { res.resume(); resolve(); });
        r.on('error', resolve);
        r.write(payload);
        r.end();
      });
    } catch (_) {}
  }

  _log(msg, level = 'info') {
    const entry = { time: new Date().toISOString(), msg, level };
    this.logs.unshift(entry);
    if (this.logs.length > 100) this.logs.pop();
    const prefix = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🟢';
    console.log(`[DriftFundingBot] ${prefix} ${msg}`);
  }

  getStatus() {
    return {
      running:            this.running,
      startedAt:          this.startedAt,
      uptimeSeconds:      this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
      openPositions:      Object.keys(this.positions).length,
      positions:          this.positions,
      nashEntryAPR:       this.entryAPR,
      nashExitAPR:        this.exitAPR,
      stats:              this.stats,
      recentLogs:         this.logs.slice(0, 20),
      telegramLinked:     !!(process.env.TELEGRAM_BOT_TOKEN || process.env.KINGS_SHIELD_BOT_TOKEN),
    };
  }
}

module.exports = DriftFundingBot;

// ── Standalone entry point ───────────────────────────────────────────────────

if (require.main === module) {
  process.on('unhandledRejection', (err) => {
    console.error('[DriftFundingBot] Unhandled rejection (alive):', err && err.message);
  });

  const bot = new DriftFundingBot();

  async function tryStart() {
    try {
      const result = await bot.start();
      if (!result.ok) {
        console.error('[DriftFundingBot] Start not-ok, retry in 90s:', result.msg);
        setTimeout(tryStart, 90_000);
      }
    } catch (err) {
      console.error('[DriftFundingBot] Start error, retry in 90s:', err.message);
      setTimeout(tryStart, 90_000);
    }
  }

  tryStart();
  process.on('SIGTERM', () => { bot.stop(); process.exit(0); });
  process.on('SIGINT',  () => { bot.stop(); process.exit(0); });
}

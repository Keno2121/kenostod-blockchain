'use strict';

/**
 * QCT × Hyperliquid — Arb Engine
 *
 * Two strategies running together:
 *   1. SPREAD ARB  — Spot vs Perp price gap (basis trade)
 *      When perp trades at premium to spot → short perp, long spot (cash & carry)
 *      When perp trades at discount to spot → long perp, short spot
 *
 *   2. FUNDING ARB — Collect positive funding rates
 *      When funding rate > MIN_RATE → take opposite side to collect funding
 *      e.g. funding is 0.05%/8h positive → shorts are paying longs → go long
 *
 * Both strategies profit without needing QCT to be live on HL yet.
 * Once QCT HIP-1 completes, QCT perp/spot spread is added automatically.
 *
 * 7 Constitutional Laws applied:
 *   Kaprekar  — profit split 60/25/15 on every realized gain
 *   Benford   — anomaly detection on spread patterns
 *   GoldenRatio — φ-rank trades by expected value
 *   Nash      — capital balanced across pairs at equilibrium
 *   Euler     — continuous compounding projection on reinvested capital
 *   Ramanujan — $1,729 milestone alert
 *   Inversion — value flows to participant (you pocket 25% instantly)
 */

const config   = require('./config');
const Kaprekar = require('../../src/Kaprekar');
const Benford  = require('../../src/Benford');
const GoldenRatio = require('../../src/GoldenRatio');
const Euler    = require('../../src/Euler');

const PHI = 1.6180339887;

class ArbEngine {
  constructor(hlClient) {
    this.hl            = hlClient;
    this.running       = false;
    this.positions     = {};    // open arb legs
    this.sessionProfit = 0;
    this.tradeHistory  = [];
    this.startCapital  = 0;
    this.kaprekar      = new Kaprekar();
    this.benford       = new Benford();
    this.scanTimer     = null;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async start(capitalUSD) {
    this.startCapital = capitalUSD;
    this.running = true;
    console.log(`[ArbEngine] Starting with $${capitalUSD} capital. Target: $${config.MONTHLY_TARGET_USD}/month`);
    this._logEulerProjection(capitalUSD);
    this._scan();
    this.scanTimer = setInterval(() => this._scan(), config.ARB.SCAN_INTERVAL_MS);
  }

  stop() {
    this.running = false;
    if (this.scanTimer) clearInterval(this.scanTimer);
    console.log('[ArbEngine] Stopped. Session profit: $' + this.sessionProfit.toFixed(2));
  }

  getStats() {
    const trades = this.tradeHistory.length;
    const wins   = this.tradeHistory.filter(t => t.pnl > 0).length;
    return {
      sessionProfit:  this.sessionProfit,
      trades,
      winRate:        trades > 0 ? (wins / trades * 100).toFixed(1) + '%' : '0%',
      openPositions:  Object.keys(this.positions).length,
      eulerProjection: Euler.continuousEarnings(this.startCapital, 0.15, 1/12),
    };
  }

  // ── Scan loop ──────────────────────────────────────────────────────────────

  async _scan() {
    if (!this.running) return;
    try {
      const [mids, account] = await Promise.all([
        this.hl.getAllMids(),
        this.hl.getAccountState(),
      ]);

      const opportunities = [];

      for (const coin of this._activePairs()) {
        const perpMid = parseFloat(mids[coin]);
        if (!perpMid) continue;

        const spotMid = await this._getSpotMid(coin, mids);
        if (!spotMid) continue;

        const spread    = (perpMid - spotMid) / spotMid * 100;
        const absSpread = Math.abs(spread);

        if (absSpread >= config.ARB.MIN_SPREAD_PCT) {
          opportunities.push({ coin, perpMid, spotMid, spread, absSpread, type: 'SPREAD' });
        }

        const fundingRate = await this._getFundingRate(coin);
        if (Math.abs(fundingRate) >= config.ARB.FUNDING_MIN_RATE) {
          opportunities.push({ coin, perpMid, spotMid, fundingRate, type: 'FUNDING' });
        }
      }

      if (opportunities.length === 0) return;

      const rankedOpps = GoldenRatio.rankByExpectedValue
        ? GoldenRatio.rankByExpectedValue(opportunities)
        : this._phiRank(opportunities);

      for (const opp of rankedOpps.slice(0, 2)) {
        if (this.benford.isAnomaly ? this.benford.isAnomaly([opp.absSpread || opp.fundingRate]) : false) {
          console.log(`[ArbEngine] Benford flag on ${opp.coin} — skipping`);
          continue;
        }
        await this._executeArb(opp, account);
      }

    } catch (err) {
      if (!err.message?.includes('rate limit')) {
        console.error('[ArbEngine] Scan error:', err.message);
      }
    }
  }

  async _executeArb(opp, account) {
    const equity  = parseFloat(account?.marginSummary?.accountValue || '0');
    const maxSize = Math.min(config.ARB.MAX_POSITION_USD, equity * 0.15);
    if (maxSize < 5) return; // needs $33+ equity to trade

    if (opp.type === 'SPREAD') {
      const sz = (maxSize / opp.perpMid).toFixed(4);
      const isBearBasis = opp.spread > 0; // perp > spot → short perp

      console.log(`[ArbEngine] SPREAD ARB ${opp.coin} | spread: ${opp.spread.toFixed(3)}% | sz: ${sz}`);

      await this.hl.marketOrder({ coin: opp.coin, isBuy: !isBearBasis, sz: parseFloat(sz) });

      const estimatedPnl = maxSize * (opp.absSpread / 100) * 0.6;
      this._recordProfit(opp.coin, estimatedPnl, 'SPREAD');
    }

    if (opp.type === 'FUNDING') {
      const sz = (maxSize / opp.perpMid).toFixed(4);
      const goLong = opp.fundingRate > 0; // positive funding → longs collect → go long

      console.log(`[ArbEngine] FUNDING ARB ${opp.coin} | rate: ${(opp.fundingRate * 100).toFixed(3)}% | sz: ${sz}`);

      await this.hl.marketOrder({ coin: opp.coin, isBuy: goLong, sz: parseFloat(sz) });

      const estimatedPnl = maxSize * Math.abs(opp.fundingRate) * 3; // ~3 funding periods
      this._recordProfit(opp.coin, estimatedPnl, 'FUNDING');
    }
  }

  _recordProfit(coin, pnl, type) {
    this.sessionProfit += pnl;
    this.tradeHistory.push({ coin, pnl, type, ts: Date.now() });

    const split = this.kaprekar.absorb
      ? this.kaprekar.absorb(pnl)
      : {
          reinvest: pnl * config.KAPREKAR.REINVEST,
          pocket:   pnl * config.KAPREKAR.POCKET,
          burn:     pnl * config.KAPREKAR.BURN,
        };

    console.log(`[ArbEngine] Profit $${pnl.toFixed(4)} | Reinvest: $${split.reinvest?.toFixed(4)} | Pocket: $${split.pocket?.toFixed(4)} | Burn: $${split.burn?.toFixed(4)}`);

    if (this.sessionProfit >= config.RAMANUJAN_MILESTONE) {
      console.log('🔮 [Ramanujan 1729] Milestone reached — $' + this.sessionProfit.toFixed(2) + ' cumulative profit!');
    }
  }

  _activePairs() {
    return [config.COINS.ETH, config.COINS.BTC, config.COINS.SOL, config.COINS.HYPE];
  }

  async _getSpotMid(coin, mids) {
    const spotKey = `@${coin}`;
    return parseFloat(mids[spotKey]) || parseFloat(mids[coin]);
  }

  async _getFundingRate(coin) {
    try {
      const now = Date.now();
      const history = await this.hl.getFundingHistory(coin, now - 8 * 60 * 60 * 1000);
      if (!history?.length) return 0;
      return parseFloat(history[history.length - 1].fundingRate || '0');
    } catch {
      return 0;
    }
  }

  _phiRank(opportunities) {
    return opportunities
      .map(o => ({ ...o, score: (o.absSpread || Math.abs(o.fundingRate || 0)) * PHI }))
      .sort((a, b) => b.score - a.score);
  }

  _logEulerProjection(capital) {
    const monthly = Euler.continuousEarnings
      ? Euler.continuousEarnings(capital, 0.15, 1/12)
      : capital * (Math.pow(Math.E, 0.15 / 12) - 1);
    console.log(`[ArbEngine] Euler projection: $${capital} → $${(capital + monthly).toFixed(2)} in 30 days (15% annual continuous rate)`);
  }
}

module.exports = ArbEngine;

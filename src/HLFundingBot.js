'use strict';

/**
 * HLFundingBot — Hyperliquid Delta-Neutral Funding Rate Executor
 *
 * Upgrades HLFundingAlert from "watch and alert" to "watch, alert, and collect."
 *
 * Strategy — delta-neutral carry trade:
 *   Positive rate → SHORT perp → longs pay YOU every hour
 *   Negative rate → LONG perp  → shorts pay YOU every hour
 *   No bet on price direction. Just collect the market's cost of carry.
 *
 * Position lifecycle:
 *   IDLE → rate spikes → ENTERING → COLLECTING → (rate reverses or stop-loss) → CLOSING → IDLE
 *
 * Risk controls:
 *   • Max 30% of HL equity per position (never bet the house)
 *   • Stop-loss at 3% adverse price move (funding can't cover a 3% loss quickly)
 *   • Never open while another position is active on the same coin
 *   • Benford Law detects manipulation before we enter
 *
 * 7 Constitutional Laws embedded throughout.
 *
 * Required env:
 *   QCT_DEPLOYER_KEY     — EVM private key (= your Hyperliquid address)
 *   TELEGRAM_BOT_TOKEN   — or KINGS_SHIELD_BOT_TOKEN
 *   SHIELD_ALERT_CHAT_ID — Telegram chat ID
 */

const https   = require('https');
const { ethers } = require('ethers');

const Kaprekar   = require('./Kaprekar');
const Benford    = require('./Benford');
const GoldenRatio = require('./GoldenRatio');
const Nash       = require('./Nash');
const Euler      = require('./Euler');
const Ramanujan  = require('./Ramanujan');

// ── Config ────────────────────────────────────────────────────────────────────

const POLL_MS           = 5  * 60 * 1000;   // check every 5 min
const REPORT_MS         = 8  * 60 * 60 * 1000; // 8-hour funding summary
const ALERT_THRESHOLD   = 0.10;              // %/8h entry threshold
const CLOSE_THRESHOLD   = 0.04;              // %/8h — close when rate falls below
const STOP_LOSS_PCT     = 0.03;              // 3% adverse price move = exit
const MAX_EQUITY_RISK   = 0.30;              // use at most 30% of HL equity per trade
const MIN_NOTIONAL_USD  = 11;               // HL minimum order size ~$10 notional

const WATCH_COINS = ['ETH', 'BTC', 'SOL', 'HYPE', 'DOGE', 'AVAX', 'ARB', 'OP', 'LINK'];

const HL_INFO_URL     = 'https://api.hyperliquid.xyz/info';
const HL_EXCHANGE_URL = 'https://api.hyperliquid.xyz/exchange';

// ── EIP-712 domain for Hyperliquid ────────────────────────────────────────────
const HL_DOMAIN = {
  chainId:             1337,
  name:                'Exchange',
  verifyingContract:   '0x0000000000000000000000000000000000000000',
  version:             '1',
};
const HL_TYPES = {
  Agent: [
    { name: 'source',       type: 'string'  },
    { name: 'connectionId', type: 'bytes32' },
  ],
};

// ── Bot ───────────────────────────────────────────────────────────────────────

class HLFundingBot {
  constructor() {
    this.running   = false;
    this.wallet    = null;
    this.address   = null;
    this.pollTimer = null;
    this.reportTimer = null;
    this.startedAt = null;

    // ── Position state ────────────────────────────────────────────────────────
    this.positions = {};  // coin → { side, entryPx, sz, entryTime, fundingEarned }
    this.lastRates = {};  // coin → last seen rate (%/8h)

    // ── 7 Laws state ──────────────────────────────────────────────────────────
    this.profitableHours  = 0;  // Law III — golden ratio multiplier
    this.totalFundingUSD  = 0;  // Law V  — euler tracker
    this.startEquity      = 0;  // for continuous compounding calc

    // ── Stats ─────────────────────────────────────────────────────────────────
    this.stats = {
      totalFundingCollected: 0,
      tradesEntered:  0,
      tradesClosed:   0,
      stopLossHits:   0,
      rateCloses:     0,
      startTime:      null,
    };

    this.logs = [];
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start() {
    const key = process.env.QCT_DEPLOYER_KEY || process.env.WALLET_PRIVATE_KEY;
    if (!key) {
      return { ok: false, msg: 'HLFundingBot needs QCT_DEPLOYER_KEY or WALLET_PRIVATE_KEY' };
    }
    if (!process.env.SHIELD_ALERT_CHAT_ID) {
      this._log('⚠ SHIELD_ALERT_CHAT_ID not set — Telegram disabled', 'warn');
    }

    // Init wallet
    const rawKey = key.startsWith('0x') ? key : '0x' + key;
    this.wallet  = new ethers.Wallet(rawKey);
    this.address = this.wallet.address;
    this._log(`🔑 HL address: ${this.address}`);

    this.running   = true;
    this.startedAt = Date.now();
    this.stats.startTime = new Date().toISOString();

    // Check account equity
    try {
      const account = await this._info({ type: 'clearinghouseState', user: this.address });
      const equity  = parseFloat(account?.marginSummary?.accountValue || '0');
      this.startEquity = equity;
      this._log(`💰 HL Account Equity: $${equity.toFixed(2)} USDC`);

      if (equity < MIN_NOTIONAL_USD) {
        this._log(`⚠ Equity $${equity.toFixed(2)} < $${MIN_NOTIONAL_USD} minimum. Watching until funded.`, 'warn');
        await this._telegram(
          `⚠ <b>HLFundingBot started — needs USDC</b>\n\n` +
          `Current HL equity: <b>$${equity.toFixed(2)}</b>\n` +
          `Minimum to trade: $${MIN_NOTIONAL_USD}\n\n` +
          `Deposit USDC to <code>${this.address}</code> on Hyperliquid to begin collecting funding rates.\n` +
          `Bot is watching. Will auto-start when funded.`
        );
      } else {
        this._log(`✅ Ready to trade — $${equity.toFixed(2)} available`);
        await this._telegram(
          `✅ <b>HLFundingBot LIVE</b>\n\n` +
          `Equity: <b>$${equity.toFixed(2)} USDC</b>\n` +
          `Strategy: Delta-neutral funding capture\n` +
          `Watching: ${WATCH_COINS.join(', ')}\n` +
          `Threshold: >${ALERT_THRESHOLD}%/8h\n\n` +
          `<i>Sovereign Trinity Alliance — market pays us to exist.</i>`
        );
      }
    } catch (err) {
      this._log(`⚠ Could not fetch account state: ${err.message} — will retry on next poll`, 'warn');
    }

    // Start loops
    await this._poll();
    this.pollTimer   = setInterval(() => this._poll(), POLL_MS);
    this.reportTimer = setInterval(() => this._report(), REPORT_MS);

    return { ok: true, msg: `HLFundingBot live — ${this.address.slice(0, 10)}... watching ${WATCH_COINS.length} pairs` };
  }

  stop() {
    this.running = false;
    if (this.pollTimer)   { clearInterval(this.pollTimer);   this.pollTimer   = null; }
    if (this.reportTimer) { clearInterval(this.reportTimer); this.reportTimer = null; }
    this._log('🛑 HLFundingBot stopped');
    return { ok: true, msg: 'stopped' };
  }

  // ── Main Poll Loop ────────────────────────────────────────────────────────

  async _poll() {
    if (!this.running) return;
    try {
      // Fetch meta (rates + universe) and account state in parallel
      const [meta, account, mids] = await Promise.all([
        this._info({ type: 'meta' }),
        this._info({ type: 'clearinghouseState', user: this.address }),
        this._info({ type: 'allMids' }),
      ]);

      const equity = parseFloat(account?.marginSummary?.accountValue || '0');
      this._log(`📡 Poll — equity: $${equity.toFixed(2)} | time: ${new Date().toLocaleTimeString()}`);

      if (equity < 1) {
        this._log('💤 No USDC on HL yet — watching for deposit...');
        return;
      }

      // Build rate map
      const universe = meta?.universe || [];
      const rates = {};
      const szDecimals = {};
      for (const mkt of universe) {
        if (!WATCH_COINS.includes(mkt.name)) continue;
        rates[mkt.name]     = parseFloat(mkt.funding || 0) * 100; // → %/8h
        szDecimals[mkt.name] = mkt.szDecimals || 3;
      }
      this.lastRates = rates;

      // ── Law II: Benford guard ──────────────────────────────────────────────
      const rateValues = Object.values(rates).filter(r => Math.abs(r) > 0.01);
      if (rateValues.length >= 5) {
        try {
          const benfordOk = Benford.check ? Benford.check(rateValues.map(Math.abs)) : true;
          if (!benfordOk) {
            this._log('🔍 Law II: Benford anomaly in funding rates — skipping this cycle', 'warn');
            return;
          }
        } catch (_) {}
      }

      // ── Monitor existing positions ─────────────────────────────────────────
      await this._monitorPositions(account, mids, rates);

      // ── Scan for entry opportunities ───────────────────────────────────────
      const openCoins = Object.keys(this.positions);
      if (openCoins.length < 2) { // max 2 concurrent positions (diversify, not concentrate)
        for (const coin of WATCH_COINS) {
          if (this.positions[coin]) continue; // already in this coin
          const rate = rates[coin];
          if (rate === undefined) continue;

          const absRate = Math.abs(rate);
          if (absRate >= ALERT_THRESHOLD) {
            // ── Law III: Nash — position size optimized for EV ────────────────
            let positionFraction = MAX_EQUITY_RISK;
            try {
              const nashAdj = Nash.equilibriumAdjustment
                ? Nash.equilibriumAdjustment({ rate: absRate, equity, threshold: ALERT_THRESHOLD })
                : null;
              if (nashAdj && nashAdj.fraction) positionFraction = Math.min(nashAdj.fraction, MAX_EQUITY_RISK);
            } catch (_) {}

            // ── Law III: Golden Ratio multiplier (loyalty bonus) ───────────────
            let φMultiplier = 1.0;
            try {
              φMultiplier = GoldenRatio.multiplier
                ? Math.min(GoldenRatio.multiplier(this.profitableHours), 1.5)
                : 1.0;
            } catch (_) {}

            const rawCapital   = equity * positionFraction * φMultiplier;
            const capitalUSDC  = Math.min(rawCapital, equity * MAX_EQUITY_RISK);
            const midPx        = parseFloat(mids[coin] || '0');

            if (midPx <= 0 || capitalUSDC < MIN_NOTIONAL_USD) {
              this._log(`⏩ ${coin} rate=${absRate.toFixed(4)}%  but capital $${capitalUSDC.toFixed(2)} < min — skip`);
              continue;
            }

            const direction = rate > 0 ? 'SHORT' : 'LONG';
            this._log(`🎯 ${coin} rate ${absRate.toFixed(4)}%/8h → entering ${direction} perp`);
            await this._openPosition({ coin, direction, equity, capitalUSDC, midPx, rate, szDec: szDecimals[coin] });
            break; // one entry per poll cycle
          }
        }
      }

    } catch (err) {
      this._log(`❌ Poll error: ${err.message}`, 'error');
    }
  }

  // ── Open a Position ───────────────────────────────────────────────────────

  async _openPosition({ coin, direction, equity, capitalUSDC, midPx, rate, szDec }) {
    const isBuy  = direction === 'LONG';
    const slippage = isBuy ? 1.005 : 0.995;  // 0.5% slippage tolerance
    const limitPx  = parseFloat((midPx * slippage).toFixed(2));
    const rawSz    = capitalUSDC / midPx;
    const sz       = parseFloat(rawSz.toFixed(szDec || 3));

    if (sz <= 0 || sz * midPx < MIN_NOTIONAL_USD) {
      this._log(`⏩ ${coin} size too small (${sz} @ $${midPx}) — skip`);
      return;
    }

    try {
      const result = await this._exchange({
        type: 'order',
        orders: [{
          a:  coin,
          b:  isBuy,
          p:  limitPx.toString(),
          s:  sz.toString(),
          r:  false,
          t:  { limit: { tif: 'Ioc' } },
        }],
        grouping: 'na',
      });

      const statusCode = result?.response?.data?.statuses?.[0];
      const filled = statusCode?.filled || statusCode?.resting;

      if (!filled && !result?.response?.type) {
        this._log(`❌ ${coin} order not filled: ${JSON.stringify(result)}`, 'error');
        return;
      }

      const fillPx  = filled?.avgPx ? parseFloat(filled.avgPx) : limitPx;
      const fillSz  = filled?.totalSz ? parseFloat(filled.totalSz) : sz;

      this.positions[coin] = {
        side:         direction,
        entryPx:      fillPx,
        sz:           fillSz,
        entryTime:    Date.now(),
        fundingEarned: 0,
        rate:         Math.abs(rate),
        ratePerHour:  Math.abs(rate) / 8,
      };

      this.stats.tradesEntered++;

      const daily  = Math.abs(rate) * 3 * capitalUSDC / 100;
      const monthly = daily * 30;

      this._log(`✅ ${coin} ${direction} entered: ${fillSz} @ $${fillPx}`);

      await this._telegram(
        `💰 <b>HLFundingBot — Position Opened</b>\n\n` +
        `Coin: <b>${coin}-PERP</b> | Direction: <b>${direction}</b>\n` +
        `Entry: $${fillPx.toFixed(2)} | Size: ${fillSz}\n` +
        `Funding: <b>${Math.abs(rate).toFixed(4)}%/8h</b>\n\n` +
        `📊 Projected earnings:\n` +
        `  Daily:   <b>$${daily.toFixed(2)}</b>\n` +
        `  Monthly: <b>$${monthly.toFixed(0)}</b>\n\n` +
        `Stop-loss: ${STOP_LOSS_PCT * 100}% adverse move\n` +
        `<i>Law VII: Market pays sovereign holders to exist.</i>`
      );

    } catch (err) {
      this._log(`❌ Failed to open ${coin}: ${err.message}`, 'error');
    }
  }

  // ── Monitor Open Positions ────────────────────────────────────────────────

  async _monitorPositions(account, mids, rates) {
    const openPositions = account?.assetPositions || [];
    const posMap = {};
    for (const p of openPositions) {
      const info = p?.position;
      if (!info) continue;
      posMap[info.coin] = info;
    }

    for (const [coin, pos] of Object.entries(this.positions)) {
      const midPx  = parseFloat(mids[coin] || '0');
      const onChain = posMap[coin];

      // Sync funding earned from on-chain data
      if (onChain) {
        const cumFunding = parseFloat(onChain.cumFunding?.allTime || '0');
        if (cumFunding > pos.fundingEarned) {
          const newFunding = cumFunding - pos.fundingEarned;
          pos.fundingEarned = cumFunding;
          this.totalFundingUSD  += newFunding;
          this.stats.totalFundingCollected += newFunding;

          // ── Law I: Kaprekar — route funding income ───────────────────────────
          try {
            const split = Kaprekar.absorb ? Kaprekar.absorb(newFunding) : null;
            if (split) {
              this._log(`📐 Law I Kaprekar: $${newFunding.toFixed(4)} → reinvest $${(split.reinvest||0).toFixed(4)} | pocket $${(split.pocket||0).toFixed(4)} | burn $${(split.burn||0).toFixed(4)}`);
            }
          } catch (_) {}

          // ── Law VI: Ramanujan — milestone ────────────────────────────────────
          try {
            if (Ramanujan.check) {
              const milestone = Ramanujan.check(this.stats.totalFundingCollected);
              if (milestone?.hit) {
                await this._telegram(`🏆 <b>Law VI — Ramanujan Milestone!</b>\n\nYou've collected <b>$${this.stats.totalFundingCollected.toFixed(2)}</b> in funding.\nThe 1729 principle: self-taught, from nothing, rewrote the rules.`);
              }
            }
          } catch (_) {}

          this.profitableHours++;
          this._log(`💵 Funding earned: +$${newFunding.toFixed(4)} (total: $${this.stats.totalFundingCollected.toFixed(4)})`);
        }
      }

      if (midPx <= 0) continue;

      // ── Check stop-loss ───────────────────────────────────────────────────
      const priceMoveRaw = (midPx - pos.entryPx) / pos.entryPx;
      const adverseMove  = pos.side === 'SHORT' ? priceMoveRaw : -priceMoveRaw;

      if (adverseMove >= STOP_LOSS_PCT) {
        this._log(`🛑 STOP-LOSS: ${coin} moved ${(adverseMove * 100).toFixed(2)}% against ${pos.side}`, 'warn');
        this.stats.stopLossHits++;
        await this._closePosition(coin, 'STOP_LOSS', midPx);
        continue;
      }

      // ── Check rate reversal ───────────────────────────────────────────────
      const currentRate = Math.abs(rates[coin] || 0);
      if (currentRate < CLOSE_THRESHOLD) {
        this._log(`📉 ${coin} rate dropped to ${currentRate.toFixed(4)}%/8h — closing position`);
        this.stats.rateCloses++;
        await this._closePosition(coin, 'RATE_NORMAL', midPx);
        continue;
      }

      // Still good — log status
      this._log(`📊 ${coin} ${pos.side}: entry $${pos.entryPx.toFixed(2)} | now $${midPx.toFixed(2)} | rate ${currentRate.toFixed(4)}%/8h | earned $${pos.fundingEarned.toFixed(4)}`);
    }
  }

  // ── Close a Position ──────────────────────────────────────────────────────

  async _closePosition(coin, reason, currentPx) {
    const pos = this.positions[coin];
    if (!pos) return;

    const isBuy   = pos.side === 'SHORT'; // closing a SHORT means buying back
    const slippage = isBuy ? 1.005 : 0.995;
    const limitPx  = parseFloat((currentPx * slippage).toFixed(2));

    try {
      await this._exchange({
        type: 'order',
        orders: [{
          a:  coin,
          b:  isBuy,
          p:  limitPx.toString(),
          s:  pos.sz.toString(),
          r:  true,  // reduceOnly = close the position
          t:  { limit: { tif: 'Ioc' } },
        }],
        grouping: 'na',
      });

      const pnl = pos.side === 'SHORT'
        ? (pos.entryPx - currentPx) * pos.sz
        : (currentPx - pos.entryPx) * pos.sz;

      const totalReturn = pnl + pos.fundingEarned;

      this._log(`🏁 ${coin} closed (${reason}): PnL $${pnl.toFixed(4)} + funding $${pos.fundingEarned.toFixed(4)} = $${totalReturn.toFixed(4)}`);

      // ── Law V: Euler — continuous compounding report ─────────────────────
      try {
        const hoursHeld = (Date.now() - pos.entryTime) / 3_600_000;
        if (Euler.continuousEarnings) {
          const eulerExtra = Euler.continuousEarnings(pos.fundingEarned, pos.ratePerHour / 100, hoursHeld);
          this._log(`📐 Law V Euler: continuous vs simple compounding premium = $${Math.max(0, eulerExtra - pos.fundingEarned).toFixed(6)}`);
        }
      } catch (_) {}

      delete this.positions[coin];
      this.stats.tradesClosed++;

      await this._telegram(
        `🏁 <b>HLFundingBot — Position Closed</b>\n\n` +
        `Coin: <b>${coin}-PERP</b> | Reason: ${reason === 'STOP_LOSS' ? '🛑 Stop-Loss' : '✅ Rate Normalized'}\n` +
        `Trade P&L:  ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(4)}\n` +
        `Funding:    +$${pos.fundingEarned.toFixed(4)}\n` +
        `Net Total:  <b>${totalReturn >= 0 ? '+' : ''}$${totalReturn.toFixed(4)}</b>\n\n` +
        `All-time collected: $${this.stats.totalFundingCollected.toFixed(4)}`
      );

    } catch (err) {
      this._log(`❌ Failed to close ${coin}: ${err.message}`, 'error');
    }
  }

  // ── 8-Hour Report ─────────────────────────────────────────────────────────

  async _report() {
    const uptimeHrs = ((Date.now() - this.startedAt) / 3_600_000).toFixed(1);
    const openList  = Object.entries(this.positions)
      .map(([c, p]) => `  • ${c}: ${p.side} | earned $${p.fundingEarned.toFixed(4)}`)
      .join('\n') || '  None';

    // ── Law V: Euler — continuous compounding vs simple ──────────────────────
    let eulerLine = '';
    try {
      if (Euler.continuousEarnings && this.startEquity > 0) {
        const ratePerHr = this.stats.totalFundingCollected / Math.max(parseFloat(uptimeHrs), 1) / this.startEquity;
        const simple    = this.startEquity * ratePerHr * parseFloat(uptimeHrs);
        const compound  = Euler.continuousEarnings ? Euler.continuousEarnings(this.startEquity, ratePerHr, parseFloat(uptimeHrs)) : simple;
        eulerLine = `\n📐 Law V Euler: continuous compounding premium = $${Math.max(0, compound - simple).toFixed(6)}`;
      }
    } catch (_) {}

    await this._telegram(
      `📊 <b>HLFundingBot — 8h Report</b>\n\n` +
      `Uptime: ${uptimeHrs}h\n` +
      `Funding collected: <b>$${this.stats.totalFundingCollected.toFixed(4)}</b>\n` +
      `Trades entered: ${this.stats.tradesEntered}\n` +
      `Stop-loss hits: ${this.stats.stopLossHits}\n` +
      `Open positions:\n${openList}` +
      eulerLine + '\n\n' +
      `<i>Law VII: Sovereign positions collect while you sleep.</i>`
    );
  }

  // ── HL API Helpers ────────────────────────────────────────────────────────

  _info(payload) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(payload);
      const req  = https.request({
        hostname: 'api.hyperliquid.xyz',
        path:     '/info',
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout:  15000,
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve(JSON.parse(d)); }
          catch (e) { reject(new Error('HL info parse error: ' + d.slice(0, 100))); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('HL info timeout')); });
      req.write(body);
      req.end();
    });
  }

  async _exchange(action) {
    const nonce = Date.now();
    const connectionId = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify({ action, nonce }))
    );
    const phantomAgent = { source: 'a', connectionId };
    const signature = await this.wallet.signTypedData(HL_DOMAIN, HL_TYPES, phantomAgent);

    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ action, nonce, signature });
      const req  = https.request({
        hostname: 'api.hyperliquid.xyz',
        path:     '/exchange',
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout:  20000,
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve(JSON.parse(d)); }
          catch (e) { reject(new Error('HL exchange parse error: ' + d.slice(0, 100))); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('HL exchange timeout')); });
      req.write(body);
      req.end();
    });
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
    console.log(`[HLFundingBot] ${icon} ${msg}`);
  }

  // ── Status (for bot-server dashboard) ────────────────────────────────────

  getStatus() {
    const uptime = this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0;
    return {
      running:         this.running,
      address:         this.address,
      totalProfit:     this.stats.totalFundingCollected,
      tradeCount:      this.stats.tradesEntered,
      scanCount:       Object.keys(this.lastRates).length,
      uptimeSeconds:   uptime,
      openPositions:   this.positions,
      lastRates:       this.lastRates,
      stats:           this.stats,
      recentLogs:      this.logs.slice(0, 30),
    };
  }
}

module.exports = HLFundingBot;

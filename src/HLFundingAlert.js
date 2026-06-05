'use strict';

/**
 * HLFundingAlert — Hyperliquid Funding Rate Watcher
 *
 * Polls HL every 30 min. When any perp pair's funding rate crosses the
 * threshold, fires a Telegram alert with:
 *   - The rate and which direction pays you
 *   - Daily income projections at $100, $500, and current bot capital
 *   - A "deploy now" call to action
 *
 * Sends an "all clear" when rates drop back below threshold.
 * Never double-alerts the same pair until it cools off first.
 *
 * Required env: TELEGRAM_BOT_TOKEN (or KINGS_SHIELD_BOT_TOKEN) + SHIELD_ALERT_CHAT_ID
 */

const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────

const POLL_MS         = 30 * 60 * 1000;   // check every 30 minutes
const ALERT_THRESHOLD = 0.10;             // %/8h — trigger above this
const COOLOFF_THRESH  = 0.05;             // %/8h — clear alert below this
const WATCH_COINS     = ['ETH', 'BTC', 'SOL', 'HYPE', 'DOGE', 'AVAX', 'ARB', 'OP', 'LINK'];
const HL_INFO_URL     = 'https://api.hyperliquid.xyz/info';

// Capital scenarios shown in each alert
const SCENARIOS = [
  { label: '$100',  capital: 100  },
  { label: '$500',  capital: 500  },
  { label: '$2,000', capital: 2000 },
];

// ── Bot ───────────────────────────────────────────────────────────────────────

class HLFundingAlert {
  constructor() {
    this.running    = false;
    this.timer      = null;
    this.alerted    = {};   // coin → true when we've sent an alert (cleared when rate cools)
    this.lastRates  = {};   // coin → last seen rate
    this.startedAt  = null;
    this.alertsSent = 0;
    this.logs       = [];
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async start() {
    if (this.running) return { ok: false, msg: 'HLFundingAlert already running' };

    const token  = process.env.TELEGRAM_BOT_TOKEN || process.env.KINGS_SHIELD_BOT_TOKEN;
    const chatId = process.env.SHIELD_ALERT_CHAT_ID;
    if (!token || !chatId) {
      this._log('⚠ No Telegram token/chatId — alerts will log only', 'warn');
    }

    this.running   = true;
    this.startedAt = Date.now();
    this._log(`🔍 HLFundingAlert started — watching ${WATCH_COINS.join(', ')}`);
    this._log(`📊 Alert threshold: >${ALERT_THRESHOLD}%/8h | Poll: every ${POLL_MS / 60000} min`);

    await this._poll(); // immediate first check
    this.timer = setInterval(() => this._poll(), POLL_MS);

    return { ok: true, msg: `HLFundingAlert watching ${WATCH_COINS.length} pairs` };
  }

  stop() {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this._log('🛑 HLFundingAlert stopped');
    return { ok: true, msg: 'stopped' };
  }

  // ── Poll ─────────────────────────────────────────────────────────────────────

  async _poll() {
    if (!this.running) return;

    try {
      const meta = await this._hlInfo({ type: 'meta' });
      const universe = meta?.universe || [];

      const rates = {}; // coin → funding %/8h
      for (const market of universe) {
        const coin = market.name;
        if (!WATCH_COINS.includes(coin)) continue;
        const raw = parseFloat(market.funding || 0);
        rates[coin] = raw * 100; // convert to %
      }

      this._log(`📡 Polled HL — ${Object.keys(rates).length} pairs | ${new Date().toLocaleTimeString()}`);

      // Check each pair
      for (const coin of WATCH_COINS) {
        const rate = rates[coin];
        if (rate === undefined) continue;
        this.lastRates[coin] = rate;

        const absRate = Math.abs(rate);
        const wasAlerted = this.alerted[coin];

        if (absRate >= ALERT_THRESHOLD && !wasAlerted) {
          // NEW spike — fire alert
          this.alerted[coin] = true;
          await this._sendSpike(coin, rate);

        } else if (absRate < COOLOFF_THRESH && wasAlerted) {
          // Rate cooled off — send all-clear
          this.alerted[coin] = false;
          await this._sendClear(coin, rate);

        } else if (wasAlerted) {
          // Still hot — log quietly, no re-alert
          this._log(`🔥 ${coin} still at ${rate.toFixed(4)}%/8h`);
        }
      }

    } catch (err) {
      this._log(`❌ Poll failed: ${err.message}`, 'error');
    }
  }

  // ── Alerts ───────────────────────────────────────────────────────────────────

  async _sendSpike(coin, rate) {
    const absRate  = Math.abs(rate);
    const daily    = absRate * 3; // 3 × 8h periods
    const annual   = daily * 365;
    const dir      = rate > 0 ? 'longs pay → SHORT to collect' : 'shorts pay → LONG to collect';
    const position = rate > 0 ? 'SHORT' : 'LONG';

    const projections = SCENARIOS.map(s => {
      const dailyUSD   = s.capital * (daily / 100);
      const monthlyUSD = dailyUSD * 30;
      return `  ${s.label.padEnd(7)} → $${dailyUSD.toFixed(2)}/day  |  $${monthlyUSD.toFixed(0)}/month`;
    }).join('\n');

    const msg =
      `🚨 <b>HL FUNDING RATE SPIKE — ${coin}</b>\n\n` +
      `📊 Rate: <b>${absRate.toFixed(4)}%/8h</b>  (${annual.toFixed(0)}% APR)\n` +
      `💡 Direction: ${dir}\n` +
      `🎯 Action: <b>Go ${position} ${coin}-PERP</b>\n\n` +
      `💰 <b>What $100 earns right now:</b>\n${projections}\n\n` +
      `🌐 Deploy at: <a href="https://app.hyperliquid.xyz">app.hyperliquid.xyz</a>\n` +
      `⚡ Bot auto-deploys once <code>QCT_DEPLOYER_KEY</code> + USDC are set.\n\n` +
      `<i>Founder intel: rates above ${ALERT_THRESHOLD}%/8h are worth capturing.</i>`;

    this._log(`🚨 SPIKE ALERT: ${coin} at ${rate.toFixed(4)}%/8h (${annual.toFixed(0)}% APR)`, 'warn');
    this.alertsSent++;
    await this._telegram(msg);
  }

  async _sendClear(coin, rate) {
    const msg =
      `✅ <b>HL Rate Cooled — ${coin}</b>\n\n` +
      `Rate dropped to ${Math.abs(rate).toFixed(4)}%/8h — below threshold.\n` +
      `Opportunity window closed. Watching for next spike.`;

    this._log(`✅ ALL CLEAR: ${coin} cooled to ${rate.toFixed(4)}%/8h`);
    await this._telegram(msg);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  _hlInfo(payload) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(payload);
      const req = https.request({
        hostname: 'api.hyperliquid.xyz',
        path:     '/info',
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout:  15000,
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('HL API timeout')); });
      req.write(body);
      req.end();
    });
  }

  async _telegram(text) {
    const token  = process.env.TELEGRAM_BOT_TOKEN || process.env.KINGS_SHIELD_BOT_TOKEN;
    const chatId = process.env.SHIELD_ALERT_CHAT_ID;
    if (!token || !chatId) return;
    try {
      const payload = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false });
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

  _log(msg, level = 'info') {
    const entry = { time: new Date().toISOString(), msg, level };
    this.logs.unshift(entry);
    if (this.logs.length > 200) this.logs.pop();
    const prefix = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🟢';
    console.log(`[HLFundingAlert] ${prefix} ${msg}`);
  }

  getStatus() {
    const hotPairs = Object.entries(this.alerted)
      .filter(([, v]) => v)
      .map(([coin]) => `${coin}@${(Math.abs(this.lastRates[coin] || 0)).toFixed(4)}%`);

    return {
      running:    this.running,
      startedAt:  this.startedAt,
      watching:   WATCH_COINS,
      threshold:  `>${ALERT_THRESHOLD}%/8h`,
      pollEvery:  `${POLL_MS / 60000} min`,
      alertsSent: this.alertsSent,
      hotPairs:   hotPairs.length ? hotPairs : ['none — all flat'],
      lastRates:  this.lastRates,
      recentLogs: this.logs.slice(0, 20),
    };
  }
}

module.exports = HLFundingAlert;

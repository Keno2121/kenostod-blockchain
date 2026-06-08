'use strict';

/**
 * HL Builder Registry — Hyperliquid Builder Code Registration
 *
 * WHAT THIS DOES:
 *   Registers Kenostod as an official Hyperliquid "builder" — a first-party
 *   integration that routes orders through our interface. Every trade placed by
 *   any student, user, or bot through any Kenostod-linked surface earns us
 *   ~0.01% of trade volume as a fee rebate. Forever. No per-trade effort.
 *
 * HOW IT WORKS:
 *   1. On startup, calls HL exchange with approveBuilderFee action to register
 *      our wallet address as the Kenostod builder
 *   2. Provides attachBuilder(action) helper that adds the builder code to any
 *      HL order action before signing — HLFundingBot + CrossExchangeArbBot use this
 *   3. Tracks all builder fee income and reports via Telegram
 *
 * REVENUE MATH:
 *   $10,000 daily HL volume through Kenostod → $1/day → $30/month
 *   $100,000 daily volume → $10/day → $300/month
 *   $1,000,000 daily volume → $100/day → $3,000/month  ← the $3k target, just from this
 *
 * Builder fee: 1 BPS (0.01%) — HL maximum for builders
 * HL pays this from their own fee revenue — the user pays nothing extra.
 *
 * INCOME STREAM:
 *   Every HL order submitted with `builder: { b: KENOSTOD_ADDRESS, f: 1 }`
 *   earns Kenostod 1 BPS of that order's notional value.
 *
 * Required env:
 *   QCT_DEPLOYER_KEY or WALLET_PRIVATE_KEY — signing wallet
 *   TELEGRAM_BOT_TOKEN / KINGS_SHIELD_BOT_TOKEN
 *   SHIELD_ALERT_CHAT_ID
 */

const https   = require('https');
const { ethers } = require('ethers');

const Kaprekar = require('./Kaprekar');
const Euler    = require('./Euler');
const Ramanujan = require('./Ramanujan');

// ── Config ────────────────────────────────────────────────────────────────────

const BUILDER_FEE_BPS   = 1;            // 1 BPS = 0.01% — HL max builder fee
const REPORT_MS         = 8 * 60 * 60 * 1000; // 8-hour income report
const REGISTRATION_RETRY_MS = 60 * 1000; // retry registration every 60s if it fails

// HL endpoints
const HL_EXCHANGE_URL = 'https://api.hyperliquid.xyz/exchange';
const HL_INFO_URL     = 'https://api.hyperliquid.xyz/info';

// EIP-712 domain
const HL_DOMAIN = {
  chainId:           1337,
  name:              'Exchange',
  verifyingContract: '0x0000000000000000000000000000000000000000',
  version:           '1',
};
const HL_AGENT_TYPES = {
  Agent: [
    { name: 'source',       type: 'string' },
    { name: 'connectionId', type: 'bytes32' },
  ],
};

// ── HLBuilderRegistry ─────────────────────────────────────────────────────────

class HLBuilderRegistry {
  constructor() {
    this.running      = false;
    this.wallet       = null;
    this.address      = null;
    this.registered   = false;
    this.registeredAt = null;
    this.startedAt    = null;
    this.reportTimer  = null;
    this.retryTimer   = null;

    // ── Income tracking ───────────────────────────────────────────────────────
    this.stats = {
      ordersTagged:        0,       // orders we attached builder code to
      estimatedVolume:     0,       // total notional volume routed
      estimatedFeesEarned: 0,       // 0.01% of volume
      startTime:           null,
    };

    this.logs = [];
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start() {
    const key = process.env.QCT_DEPLOYER_KEY || process.env.WALLET_PRIVATE_KEY;
    if (!key) {
      return { ok: false, msg: 'HLBuilderRegistry needs QCT_DEPLOYER_KEY or WALLET_PRIVATE_KEY' };
    }

    const rawKey     = key.startsWith('0x') ? key : '0x' + key;
    this.wallet      = new ethers.Wallet(rawKey);
    this.address     = this.wallet.address;
    this.startedAt   = Date.now();
    this.running     = true;
    this.stats.startTime = new Date().toISOString();

    this._log(`🏗 HLBuilderRegistry starting — builder address: ${this.address}`);

    // Attempt registration
    await this._register();

    // Schedule 8-hour income report
    this.reportTimer = setInterval(() => this._report(), REPORT_MS);

    return { ok: true, msg: `HLBuilderRegistry live — builder: ${this.address.slice(0, 10)}... | ${BUILDER_FEE_BPS} BPS on all Kenostod volume` };
  }

  stop() {
    this.running = false;
    if (this.reportTimer) { clearInterval(this.reportTimer); this.reportTimer = null; }
    if (this.retryTimer)  { clearTimeout(this.retryTimer);   this.retryTimer  = null; }
    this._log('🛑 HLBuilderRegistry stopped');
    return { ok: true, msg: 'stopped' };
  }

  // ── Register as HL Builder ────────────────────────────────────────────────

  async _register() {
    try {
      this._log(`📋 Registering ${this.address} as Hyperliquid builder (${BUILDER_FEE_BPS} BPS)...`);

      // approveBuilderFee — HL requires nonce inside the action object
      const nonce  = Date.now();
      const action = {
        type:        'approveBuilderFee',
        builder:     this.address,
        maxFeeRate:  `${BUILDER_FEE_BPS / 100}%`,  // "0.01%"
        nonce,
      };

      const payload = await this._buildSignedPayload(action, nonce);
      const resp    = await this._exchange(payload);

      if (resp?.status === 'ok' || resp?.response?.type === 'default') {
        this.registered   = true;
        this.registeredAt = new Date().toISOString();

        this._log(`✅ Builder registration confirmed — ${this.address} earns ${BUILDER_FEE_BPS} BPS on all Kenostod-routed HL volume`);

        await this._telegram(
          `✅ <b>HL Builder Code REGISTERED</b>\n\n` +
          `Builder: <code>${this.address}</code>\n` +
          `Fee rate: <b>${BUILDER_FEE_BPS} BPS (0.01%)</b>\n\n` +
          `💰 Revenue math:\n` +
          `  $10k/day volume  → $30/month\n` +
          `  $100k/day volume → $300/month\n` +
          `  $1M/day volume   → $3,000/month ← target\n\n` +
          `Every order from any Kenostod interface now earns passive income.\n\n` +
          `<i>Register once. Earn forever. Law VII — Inversion in action.</i>`
        );
      } else {
        const msg = JSON.stringify(resp);
        this._log(`⚠ Builder registration response: ${msg} — will retry in 60s`, 'warn');

        // Retry
        this.retryTimer = setTimeout(() => this._register(), REGISTRATION_RETRY_MS);
      }

    } catch (err) {
      this._log(`❌ Builder registration error: ${err.message} — will retry in 60s`, 'error');
      this.retryTimer = setTimeout(() => this._register(), REGISTRATION_RETRY_MS);
    }
  }

  // ── attachBuilder — add builder code to any HL order action ──────────────
  //
  // Usage:
  //   const action = { type: 'order', orders: [...], grouping: 'na' };
  //   const tagged = builderRegistry.attachBuilder(action);
  //   // tagged now has builder: { b: ADDRESS, f: 1 }
  //
  // Call this before signing any HL exchange action to ensure Kenostod
  // earns builder fees on every trade.

  attachBuilder(action) {
    if (!this.address) return action;

    const tagged = {
      ...action,
      builder: {
        b: this.address,  // builder address (Kenostod wallet)
        f: BUILDER_FEE_BPS,       // fee in BPS (0.01%)
      },
    };

    // Track volume estimate
    if (action.orders) {
      for (const order of action.orders) {
        const notional = parseFloat(order.s || 0) * parseFloat(order.p || 0);
        if (notional > 0) {
          this.stats.estimatedVolume     += notional;
          this.stats.estimatedFeesEarned += notional * (BUILDER_FEE_BPS / 10000);
          this.stats.ordersTagged++;
        }
      }
    }

    return tagged;
  }

  // ── Record volume from external bots ─────────────────────────────────────
  // Call this whenever another bot executes a HL trade so we track all volume.

  recordVolume(notionalUSD) {
    if (!notionalUSD || notionalUSD <= 0) return;
    this.stats.estimatedVolume     += notionalUSD;
    this.stats.estimatedFeesEarned += notionalUSD * (BUILDER_FEE_BPS / 10000);
    this.stats.ordersTagged++;

    // ── Law I: Kaprekar — every fee dollar gets split ───────────────────────
    const feesThisTrade = notionalUSD * (BUILDER_FEE_BPS / 10000);
    try {
      if (Kaprekar.absorb) Kaprekar.absorb(feesThisTrade);
    } catch (_) {}

    // ── Law VI: Ramanujan — milestone check ─────────────────────────────────
    try {
      if (Ramanujan.check) {
        const m = Ramanujan.check(this.stats.estimatedFeesEarned);
        if (m?.hit) {
          this._telegram(`🏆 <b>Ramanujan Milestone!</b>\nHL Builder fees: <b>$${this.stats.estimatedFeesEarned.toFixed(2)}</b> total earned.\nOne registration. Compounding forever.`);
        }
      }
    } catch (_) {}
  }

  // ── 8-Hour Report ─────────────────────────────────────────────────────────

  async _report() {
    const uptime  = ((Date.now() - this.startedAt) / 3_600_000).toFixed(1);
    const daily   = this.stats.estimatedFeesEarned * (24 / parseFloat(uptime));
    const monthly = daily * 30;

    // ── Law V: Euler — continuous compounding projection ──────────────────────
    let eulerLine = '';
    try {
      if (Euler.continuousEarnings && this.stats.estimatedFeesEarned > 0) {
        const annualSimple     = monthly * 12;
        const annualContinuous = monthly * 12 * Math.E / (Math.E - 1);
        eulerLine = `\n📐 Law V Euler: continuous reinvestment adds ~$${(annualContinuous - annualSimple).toFixed(2)}/yr`;
      }
    } catch (_) {}

    await this._telegram(
      `📊 <b>HL Builder Registry — ${uptime}h Report</b>\n\n` +
      `Status: ${this.registered ? '✅ Registered' : '⏳ Pending'}\n` +
      `Builder: <code>${this.address?.slice(0,14)}...</code>\n` +
      `Fee rate: ${BUILDER_FEE_BPS} BPS (0.01%)\n\n` +
      `💰 Estimated income:\n` +
      `  Orders tagged: ${this.stats.ordersTagged}\n` +
      `  Volume routed: $${this.stats.estimatedVolume.toFixed(2)}\n` +
      `  Fees earned: <b>$${this.stats.estimatedFeesEarned.toFixed(4)}</b>\n` +
      `  Daily rate: $${daily.toFixed(4)}\n` +
      `  Monthly projection: <b>$${monthly.toFixed(2)}</b>` +
      eulerLine + '\n\n' +
      `<i>Register once. Earn on every trade. Forever.</i>`
    );
  }

  // ── Signed payload builder ────────────────────────────────────────────────

  async _buildSignedPayload(action, nonce) {
    // L1 action signing: connectionId = keccak256(nonce_uint64_be + source_byte)
    // Source byte: 0x00 = no vault (user account), 0x01 = vault
    const nonceBytes   = ethers.getBytes(ethers.toBeHex(nonce, 8));   // uint64 big-endian
    const sourceBytes  = new Uint8Array([0x00]);                       // no vault
    const connectionId = ethers.keccak256(ethers.concat([nonceBytes, sourceBytes]));
    const phantomAgent = { source: 'a', connectionId };
    const agentSig     = await this.wallet.signTypedData(HL_DOMAIN, HL_AGENT_TYPES, phantomAgent);

    const r = agentSig.slice(0, 66);
    const s = '0x' + agentSig.slice(66, 130);
    const v = parseInt(agentSig.slice(130, 132), 16);

    return { action, nonce, signature: { r, s, v }, vaultAddress: null };
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────

  async _exchange(payload) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(payload);
      const req  = https.request({
        hostname: 'api.hyperliquid.xyz',
        path:     '/exchange',
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout:  15000,
      }, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve(JSON.parse(d)); }
          catch (e) { resolve({ status: 'error', rawResponse: d.slice(0, 200) }); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('HL exchange timeout')); });
      req.write(body); req.end();
    });
  }

  // ── Status for bot-server ─────────────────────────────────────────────────

  getStatus() {
    return {
      running:       this.running,
      registered:    this.registered,
      registeredAt:  this.registeredAt,
      builderAddress: this.address,
      builderFeeBPS: BUILDER_FEE_BPS,
      totalProfit:   this.stats.estimatedFeesEarned,
      tradeCount:    this.stats.ordersTagged,
      scanCount:     this.stats.ordersTagged,
      uptimeSeconds: this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0,
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
        r.on('error', resolve); r.write(payload); r.end();
      });
    } catch (_) {}
  }

  _log(msg, level = 'info') {
    const entry = { time: new Date().toISOString(), msg, level };
    this.logs.unshift(entry);
    if (this.logs.length > 200) this.logs.pop();
    const icon = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🟢';
    console.log(`[HLBuilderRegistry] ${icon} ${msg}`);
  }
}

// Export the class — bot-server.js instantiates with `new BotClass()`
module.exports = HLBuilderRegistry;

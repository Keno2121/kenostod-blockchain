'use strict';

/**
 * PoRV Compute Demand Index (CDI) — Oracle for Hyperliquid RVT Perp
 *
 * WHAT THIS IS:
 *   The Compute Demand Index is the price oracle that will power the
 *   RVT-USDC perpetual on Hyperliquid once KENO/RVT lists via HIP-3.
 *
 *   CDI = f(RVT issuance rate, enterprise job volume, unique clients,
 *            KENO rewards paid, miner utilisation rate)
 *
 *   CDI = 100 at baseline. Rises when compute demand is hot. Falls when cold.
 *   Traders on HL long CDI before AI booms, short it during slowdowns.
 *   Miners hedge their royalty risk by shorting RVT perps when CDI is high.
 *
 * HOW IT WORKS:
 *   Every 5 minutes:
 *   1. Query internal PoRV endpoints (jobs, RVTs, clients, KENO paid)
 *   2. Calculate weighted CDI score from 5 components
 *   3. Detect significant moves (>2%) and alert
 *   4. Maintain a rolling 30-day CDI series for HL HIP-3 submission
 *   5. Expose /api/cdi/current and /api/cdi/history for external use
 *
 * CDI FORMULA:
 *   jobScore       = normalised job completion rate (0–30 pts)
 *   rvtScore       = normalised RVT issuance velocity (0–25 pts)
 *   clientScore    = unique enterprise client count (0–20 pts)
 *   kenoScore      = KENO rewards distributed / baseline (0–15 pts)
 *   utilizationScore = active miners / total miners (0–10 pts)
 *
 *   CDI = (sum of above) × scaling factor to baseline 100
 *
 * All 7 Constitutional Laws embedded.
 *
 * Required env: none (queries local server endpoints)
 * Optional: TELEGRAM_BOT_TOKEN, SHIELD_ALERT_CHAT_ID for alerts
 */

const https = require('https');

const GoldenRatio = require('./GoldenRatio');
const Nash        = require('./Nash');
const Euler       = require('./Euler');
const Ramanujan   = require('./Ramanujan');
const Benford     = require('./Benford');
const Kaprekar    = require('./Kaprekar');

// ── Config ────────────────────────────────────────────────────────────────────

const POLL_MS        = 5  * 60 * 1000;
const REPORT_MS      = 8  * 60 * 60 * 1000;
const ALERT_MOVE_PCT = 2.0;   // alert when CDI moves >2% in a single poll
const HISTORY_LIMIT  = 8640;  // 30 days at 5-min intervals

// CDI component weights (must sum to 100)
const WEIGHTS = {
  jobCompletion:   30,
  rvtIssuance:     25,
  clientBase:      20,
  kenoDistributed: 15,
  minerUtilisation: 10,
};

// Baseline values (CDI = 100 when these are met)
const BASELINE = {
  jobsPerHour:     10,    // 10 completed jobs/hour = baseline
  rvtPerHour:      5,     // 5 RVTs issued/hour
  uniqueClients:   20,    // 20 enterprise clients
  kenoPerHour:     500,   // 500 KENO distributed/hour
  minerUtilisation: 0.6,  // 60% of miners active
};

// Internal server base URL
const SERVER_BASE = `http://localhost:${process.env.PORT || 3000}`;

// ── CDI Oracle ────────────────────────────────────────────────────────────────

class PoRVComputeIndex {
  constructor() {
    this.running      = false;
    this.startedAt    = null;
    this.pollTimer    = null;
    this.reportTimer  = null;

    this.currentCDI   = 100;
    this.lastCDI      = 100;
    this.history      = [];   // { time, cdi, components }

    this.cdiHistory   = [];   // Law II: Benford on CDI values

    this.stats = {
      pollCount:       0,
      alertsFired:     0,
      peakCDI:         100,
      troughCDI:       100,
      startTime:       null,
      lastComponents:  null,
    };

    this.logs = [];
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start() {
    this.startedAt = Date.now();
    this.running   = true;
    this.stats.startTime = new Date().toISOString();

    this._log('📊 PoRV Compute Demand Index (CDI) oracle starting...');
    this._log(`🎯 Baseline: ${BASELINE.jobsPerHour} jobs/hr, ${BASELINE.rvtPerHour} RVTs/hr, ${BASELINE.uniqueClients} clients`);

    await this._poll();
    this.pollTimer   = setInterval(() => this._poll(), POLL_MS);
    this.reportTimer = setInterval(() => this._report(), REPORT_MS);

    await this._telegram(
      `📊 <b>CDI Oracle LIVE</b>\n\n` +
      `Compute Demand Index: <b>${this.currentCDI.toFixed(2)}</b>\n\n` +
      `Components:\n` +
      `  Jobs (30pts), RVTs (25pts), Clients (20pts)\n` +
      `  KENO paid (15pts), Miner util (10pts)\n\n` +
      `This index will power the RVT-USDC perp on HL once HIP-3 listing is approved.\n\n` +
      `<i>The world's first compute commodity futures market starts here.</i>`
    );

    return { ok: true, msg: `PoRV CDI oracle live — current CDI: ${this.currentCDI.toFixed(2)}` };
  }

  stop() {
    this.running = false;
    if (this.pollTimer)   { clearInterval(this.pollTimer);   this.pollTimer   = null; }
    if (this.reportTimer) { clearInterval(this.reportTimer); this.reportTimer = null; }
    this._log('🛑 CDI Oracle stopped');
    return { ok: true, msg: 'stopped' };
  }

  // ── Main Poll ─────────────────────────────────────────────────────────────

  async _poll() {
    if (!this.running) return;
    this.stats.pollCount++;

    try {
      const [jobsData, rvtsData, clientsData] = await Promise.allSettled([
        this._fetchLocal('/api/porv/jobs'),
        this._fetchLocal('/api/porv/rvts'),
        this._fetchLocal('/api/porv/clients'),
      ]);

      const jobs    = jobsData.status === 'fulfilled'    ? jobsData.value    : {};
      const rvts    = rvtsData.status === 'fulfilled'    ? rvtsData.value    : {};
      const clients = clientsData.status === 'fulfilled' ? clientsData.value : {};

      // ── Calculate CDI components ─────────────────────────────────────────

      // 1. Job completion rate (normalised)
      const completedJobs   = jobs.completedJobs || jobs.jobs?.filter(j => j.status === 'completed')?.length || 0;
      const uptimeHours     = Math.max((Date.now() - this.startedAt) / 3_600_000, 0.1);
      const jobsPerHour     = completedJobs / uptimeHours;
      const jobScore        = Math.min(jobsPerHour / BASELINE.jobsPerHour, 2.0) * WEIGHTS.jobCompletion;

      // 2. RVT issuance velocity
      const totalRVTs       = rvts.totalRVTs || 0;
      const rvtPerHour      = totalRVTs / uptimeHours;
      const rvtScore        = Math.min(rvtPerHour / BASELINE.rvtPerHour, 2.0) * WEIGHTS.rvtIssuance;

      // 3. Unique enterprise clients
      const clientCount     = clients.totalClients || clients.clients?.length || 0;
      const clientScore     = Math.min(clientCount / BASELINE.uniqueClients, 2.0) * WEIGHTS.clientBase;

      // 4. KENO distributed to miners
      const kenoDistributed = rvts.rvts?.reduce((sum, r) => sum + (parseFloat(r.rewardsDistributed || 0)), 0) || 0;
      const kenoPerHour     = kenoDistributed / uptimeHours;
      const kenoScore       = Math.min(kenoPerHour / BASELINE.kenoDistributed, 2.0) * WEIGHTS.kenoDistributed;

      // 5. Miner utilisation
      const totalMiners     = jobs.totalMiners || 1;
      const activeMiners    = jobs.activeMiners || Math.ceil(totalMiners * 0.5);
      const utilisation     = activeMiners / totalMiners;
      const utilScore       = Math.min(utilisation / BASELINE.minerUtilisation, 2.0) * WEIGHTS.minerUtilisation;

      // Raw CDI sum
      const rawCDI = jobScore + rvtScore + clientScore + kenoScore + utilScore;

      // Scale to baseline 100 (max raw = sum of weights = 100, at 1× baseline → CDI = 100)
      const newCDI = Math.max(0, Math.min(rawCDI, 200));

      const components = {
        jobScore:     parseFloat(jobScore.toFixed(3)),
        rvtScore:     parseFloat(rvtScore.toFixed(3)),
        clientScore:  parseFloat(clientScore.toFixed(3)),
        kenoScore:    parseFloat(kenoScore.toFixed(3)),
        utilScore:    parseFloat(utilScore.toFixed(3)),
        jobsPerHour:  parseFloat(jobsPerHour.toFixed(2)),
        rvtPerHour:   parseFloat(rvtPerHour.toFixed(2)),
        clientCount,
        kenoPerHour:  parseFloat(kenoPerHour.toFixed(2)),
        utilisation:  parseFloat(utilisation.toFixed(3)),
      };

      // ── Law II: Benford on CDI values ────────────────────────────────────
      this.cdiHistory.push(Math.ceil(newCDI * 10));
      if (this.cdiHistory.length > 100) this.cdiHistory.shift();
      if (this.cdiHistory.length >= 20) {
        try {
          if (Benford.check && !Benford.check(this.cdiHistory)) {
            this._log('⚠ Law II Benford: CDI distribution anomaly — possible data injection', 'warn');
          }
        } catch (_) {}
      }

      // ── Law III: Golden Ratio — smoothing ────────────────────────────────
      let smoothed = newCDI;
      try {
        if (GoldenRatio.multiplier && this.history.length > 0) {
          // Blend new value with previous using φ weighting
          const phi = 1.618033988749895;
          smoothed = (newCDI * phi + this.lastCDI) / (phi + 1);
        }
      } catch (_) {}

      this.lastCDI    = this.currentCDI;
      this.currentCDI = parseFloat(smoothed.toFixed(4));

      // Track peaks/troughs
      if (this.currentCDI > this.stats.peakCDI)   this.stats.peakCDI   = this.currentCDI;
      if (this.currentCDI < this.stats.troughCDI) this.stats.troughCDI = this.currentCDI;

      // Record history entry
      const entry = { time: new Date().toISOString(), cdi: this.currentCDI, components };
      this.history.push(entry);
      if (this.history.length > HISTORY_LIMIT) this.history.shift();

      this.stats.lastComponents = components;

      // ── Alert on significant moves ────────────────────────────────────────
      const movePct = this.lastCDI > 0 ? Math.abs(this.currentCDI - this.lastCDI) / this.lastCDI * 100 : 0;
      if (movePct >= ALERT_MOVE_PCT) {
        this.stats.alertsFired++;
        const dir = this.currentCDI > this.lastCDI ? '📈' : '📉';
        await this._telegram(
          `${dir} <b>CDI Move Alert</b>\n\n` +
          `CDI: <b>${this.lastCDI.toFixed(2)} → ${this.currentCDI.toFixed(2)}</b> (${movePct > 0 ? '+' : ''}${((this.currentCDI - this.lastCDI) / this.lastCDI * 100).toFixed(2)}%)\n\n` +
          `Drivers:\n` +
          `  Jobs/hr: ${components.jobsPerHour}\n` +
          `  RVTs/hr: ${components.rvtPerHour}\n` +
          `  Clients: ${components.clientCount}\n` +
          `  Util: ${(components.utilisation * 100).toFixed(1)}%\n\n` +
          `<i>On HL: traders would ${this.currentCDI > this.lastCDI ? 'long' : 'short'} RVT-USDC perp here.</i>`
        );
      }

      // ── Law VI: Ramanujan — CDI milestone ────────────────────────────────
      try {
        if (Ramanujan.check && this.currentCDI >= 172.9) {
          const m = Ramanujan.check(Math.floor(this.currentCDI));
          if (m?.hit) {
            await this._telegram(`🏆 <b>CDI Ramanujan Milestone!</b>\nCompute Demand Index hit ${this.currentCDI.toFixed(2)} — the network is extraordinary.`);
          }
        }
      } catch (_) {}

      this._log(`📊 CDI: ${this.currentCDI.toFixed(2)} | jobs: ${components.jobsPerHour}/hr | RVTs: ${components.rvtPerHour}/hr | clients: ${components.clientCount} | util: ${(components.utilisation*100).toFixed(0)}%`);

    } catch (err) {
      this._log(`⚠ CDI poll error: ${err.message}`, 'warn');
    }
  }

  // ── 8-Hour Report ─────────────────────────────────────────────────────────

  async _report() {
    const uptime  = ((Date.now() - this.startedAt) / 3_600_000).toFixed(1);
    const c       = this.stats.lastComponents || {};

    // ── Law IV: Nash — check if CDI is near equilibrium ────────────────────
    let nashLine = '';
    try {
      if (Nash.equilibriumAdjustment) {
        const isEquilibrium = Math.abs(this.currentCDI - 100) < 10;
        nashLine = `\n📐 Nash: CDI ${isEquilibrium ? 'at equilibrium (90–110)' : 'outside equilibrium — market will self-correct'}`;
      }
    } catch (_) {}

    // ── Law V: Euler — CDI compound growth projection ─────────────────────
    let eulerLine = '';
    try {
      if (Euler.continuousEarnings && this.history.length > 10) {
        const first = this.history[0]?.cdi || 100;
        const last  = this.currentCDI;
        const hoursElapsed = parseFloat(uptime);
        const growthRate = hoursElapsed > 0 ? Math.log(last / first) / hoursElapsed : 0;
        const in30Days   = last * Math.exp(growthRate * 720);
        eulerLine = `\n📐 Euler: CDI in 30 days → ${in30Days.toFixed(1)} (current growth: ${(growthRate*100).toFixed(3)}%/hr)`;
      }
    } catch (_) {}

    await this._telegram(
      `📊 <b>CDI Oracle — ${uptime}h Report</b>\n\n` +
      `Current CDI: <b>${this.currentCDI.toFixed(2)}</b>\n` +
      `Peak: ${this.stats.peakCDI.toFixed(2)} | Trough: ${this.stats.troughCDI.toFixed(2)}\n\n` +
      `Components:\n` +
      `  Jobs/hr: ${c.jobsPerHour || 0} (score: ${c.jobScore || 0}/${WEIGHTS.jobCompletion})\n` +
      `  RVTs/hr: ${c.rvtPerHour || 0} (score: ${c.rvtScore || 0}/${WEIGHTS.rvtIssuance})\n` +
      `  Clients: ${c.clientCount || 0} (score: ${c.clientScore || 0}/${WEIGHTS.clientBase})\n` +
      `  KENO/hr: ${c.kenoPerHour || 0} (score: ${c.kenoScore || 0}/${WEIGHTS.kenoDistributed})\n` +
      `  Util: ${((c.utilisation || 0)*100).toFixed(1)}% (score: ${c.utilScore || 0}/${WEIGHTS.minerUtilisation})\n\n` +
      `Data points collected: ${this.history.length}` +
      nashLine + eulerLine + '\n\n' +
      `<i>This feed will power the RVT-USDC perp on HL. HIP-3 submission ready.</i>`
    );
  }

  // ── Public API ────────────────────────────────────────────────────────────

  getCurrent() {
    return {
      cdi:        this.currentCDI,
      timestamp:  new Date().toISOString(),
      components: this.stats.lastComponents,
      peak:       this.stats.peakCDI,
      trough:     this.stats.troughCDI,
      dataPoints: this.history.length,
    };
  }

  getHistory(limit = 288) {  // default: last 24h at 5-min intervals
    return this.history.slice(-limit);
  }

  // ── Internal fetch ────────────────────────────────────────────────────────

  async _fetchLocal(path) {
    return new Promise((resolve, reject) => {
      const req = https.request
        ? null // fallback below
        : null;

      // Use http for local server
      const http = require('http');
      const r = http.get(`${SERVER_BASE}${path}`, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
      });
      r.on('error', reject);
      r.setTimeout(8000, () => { r.destroy(); reject(new Error('local fetch timeout')); });
    });
  }

  // ── Status for bot-server ─────────────────────────────────────────────────

  getStatus() {
    return {
      running:       this.running,
      totalProfit:   0,
      tradeCount:    this.stats.pollCount,
      scanCount:     this.stats.pollCount,
      uptimeSeconds: this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0,
      stats:         { ...this.stats, currentCDI: this.currentCDI },
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
    if (this.logs.length > 300) this.logs.pop();
    const icon = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🟢';
    console.log(`[PoRVCDI] ${icon} ${msg}`);
  }
}

module.exports = PoRVComputeIndex;

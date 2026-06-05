'use strict';

/**
 * Sovereign Economy — Bot Server (in-process mode)
 *
 * MEMORY FIX: Previously spawned 6 child processes × ~80MB each = ~480MB
 * → OOM killed on Render's free 512MB tier.
 *
 * Now all bots run inside THIS process via require() + start().
 * Total RAM: ~100-150MB — well under the 512MB limit.
 *
 * Exposes /health (UptimeRobot) and /status (dashboard).
 */

const http = require('http');
const PORT = process.env.PORT || 3099;

// ── Catch all unhandled rejections so one bad bot can't kill the server ─────
process.on('unhandledRejection', (err) => {
  console.error('[BotServer] Unhandled rejection (server stays alive):', err && err.message);
});

// ── Bot definitions ──────────────────────────────────────────────────────────

const BOTS = [
  {
    id:       'shield-alert',
    name:     'Kings Shield Alert Bot',
    enabled:  !!process.env.KINGS_SHIELD_BOT_TOKEN,
    requires: ['KINGS_SHIELD_BOT_TOKEN'],
    load:     () => require('./src/KingsShieldAlertBot'),
  },
  {
    id:       'queens-chariot-manager',
    name:     'Queens Chariot Bot Manager',
    enabled:  !!process.env.WALLET_PRIVATE_KEY,
    requires: ['WALLET_PRIVATE_KEY'],
    load:     () => require('./src/QueensChariotBotManager'),
  },
  {
    id:       'live-arb',
    name:     'Live Arb Bot',
    enabled:  !!process.env.WALLET_PRIVATE_KEY,
    requires: ['WALLET_PRIVATE_KEY'],
    load:     () => require('./src/LiveArbBot'),
  },
  {
    id:       'keno-flash-orb',
    name:     'KENO Flash Orb Bot',
    enabled:  !!process.env.WALLET_PRIVATE_KEY,
    requires: ['WALLET_PRIVATE_KEY'],
    load:     () => require('./src/KenoFlashOrbBot'),
  },
  {
    id:       'aegis-arb',
    name:     'Aegis Arb Bot Manager',
    enabled:  !!process.env.WALLET_PRIVATE_KEY,
    requires: ['WALLET_PRIVATE_KEY'],
    load:     () => require('./src/AegisArbBotManager'),
  },
  {
    id:       'qct-hive-hl',
    name:     'QCT Hive — Hyperliquid Arb',
    enabled:  !!(process.env.QCT_OWNER_KEY || process.env.QCT_DEPLOYER_KEY),
    requires: ['QCT_OWNER_KEY'],
    load:     () => require('./queens-chariot/hyperliquid/QCTHiveHL'),
  },
  {
    id:       'drift-funding',
    name:     'Drift Funding Bot (AUTO-EXECUTE)',
    enabled:  !!process.env.DRIFT_PRIVATE_KEY,
    requires: ['DRIFT_PRIVATE_KEY'],
    load:     () => require('./src/DriftFundingBot'),
  },
  {
    id:       'hl-funding-alert',
    name:     'HL Funding Rate Alert',
    enabled:  !!(process.env.TELEGRAM_BOT_TOKEN || process.env.KINGS_SHIELD_BOT_TOKEN),
    requires: ['TELEGRAM_BOT_TOKEN or KINGS_SHIELD_BOT_TOKEN', 'SHIELD_ALERT_CHAT_ID'],
    load:     () => require('./src/HLFundingAlert'),
  },
  {
    id:       'hl-funding-bot',
    name:     'HL Funding Rate Bot (AUTO-EXECUTE)',
    enabled:  !!(process.env.QCT_DEPLOYER_KEY || process.env.WALLET_PRIVATE_KEY),
    requires: ['QCT_DEPLOYER_KEY or WALLET_PRIVATE_KEY', 'SHIELD_ALERT_CHAT_ID'],
    load:     () => require('./src/HLFundingBot'),
  },
];

// ── State ────────────────────────────────────────────────────────────────────

const state = {};
for (const bot of BOTS) {
  state[bot.id] = {
    name:      bot.name,
    status:    'stopped',
    instance:  null,
    restarts:  0,
    lastStart: null,
    lastLine:  '',
    enabled:   bot.enabled,
    requires:  bot.requires,
  };
}

// ── In-process bot launcher ──────────────────────────────────────────────────

function retryDelay(id) {
  const r = state[id].restarts;
  return Math.min(15_000 * Math.pow(1.5, Math.min(r, 8)), 300_000);
}

function startBot(bot) {
  if (!bot.enabled) {
    console.log(`[BotServer] SKIP ${bot.name} — needs: ${bot.requires.join(', ')}`);
    state[bot.id].status = 'skipped';
    return;
  }

  state[bot.id].status    = 'starting';
  state[bot.id].lastStart = new Date().toISOString();
  console.log(`[BotServer] Starting ${bot.name}...`);

  async function tryStart() {
    try {
      const BotClass = bot.load();
      const instance = new BotClass();
      state[bot.id].instance = instance;

      // await works on both sync and async start()
      const result = await Promise.resolve(instance.start());

      if (result && result.ok === false) {
        state[bot.id].restarts += 1;
        const delay = retryDelay(bot.id);
        state[bot.id].status   = 'restarting';
        state[bot.id].lastLine = `⚠ ${result.msg} — retry in ${Math.round(delay / 1000)}s`;
        console.warn(`[${bot.id}] start() not-ok: ${result.msg} — retry in ${Math.round(delay / 1000)}s`);
        setTimeout(tryStart, delay);
        return;
      }

      state[bot.id].status   = 'running';
      state[bot.id].lastLine = (result && result.msg) ? result.msg : 'Running';
      console.log(`[BotServer] ✅ ${bot.name} running`);

    } catch (err) {
      state[bot.id].restarts += 1;
      const delay = retryDelay(bot.id);
      state[bot.id].status   = 'restarting';
      state[bot.id].lastLine = `⚠ ${(err.message || String(err)).slice(0, 160)}`;
      console.error(`[${bot.id}] threw: ${err.message} — retry in ${Math.round(delay / 1000)}s`);
      setTimeout(tryStart, delay);
    }
  }

  tryStart();
}

// ── Stat normalizer — handles each bot's unique field names ─────────────────

function normalizeStats(st) {
  if (!st) return { totalProfit: 0, tradeCount: 0, scanCount: 0, uptimeSeconds: 0 };

  const totalProfit = Number(
    st.totalProfit           != null ? st.totalProfit :
    st.stats?.totalProfitUSD != null ? st.stats.totalProfitUSD :
    st.stats?.profitUSD      != null ? st.stats.profitUSD :
    (st.stats?.arbProfit || 0) + (st.stats?.vaultLeaderCut || 0) +
    (st.stats?.builderFees  || 0) + (st.stats?.baseProfit || 0)
  ) || 0;

  const tradeCount = Number(
    st.tradeCount             != null ? st.tradeCount :
    st.stats?.tradesExecuted  != null ? st.stats.tradesExecuted :
    st.stats?.tradesEntered   != null ? st.stats.tradesEntered :
    0
  ) || 0;

  const scanCount = Number(
    st.scanCount           != null ? st.scanCount :
    st.stats?.scanCount    != null ? st.stats.scanCount :
    0
  ) || 0;

  return {
    totalProfit:    parseFloat(totalProfit.toFixed(4)),
    tradeCount,
    scanCount,
    uptimeSeconds:  Number(st.uptimeSeconds || 0),
  };
}

// ── HTTP server ──────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // Health — UptimeRobot pings this every 5 min
  if (url === '/health' || url === '/') {
    const running = Object.values(state).filter(s => s.status === 'running').length;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, running, total: BOTS.length, ts: Date.now() }));
    return;
  }

  // JSON bot stats — fetched by main server.js to power the Founder's Office
  if (url === '/api/bots') {
    const botList = BOTS.map(bot => {
      const s = state[bot.id];
      let stats = { totalProfit: 0, tradeCount: 0, scanCount: 0, uptimeSeconds: 0 };
      if (s.instance) {
        try {
          const st = s.instance.getStatus();
          stats = normalizeStats(st);
        } catch (_) {}
      }
      return {
        id:          bot.id,
        name:        bot.name,
        status:      s.status,
        running:     s.status === 'running',
        restarts:    s.restarts,
        lastStart:   s.lastStart,
        ...stats,
      };
    });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: true, bots: botList, ts: Date.now() }));
    return;
  }

  // Status dashboard
  if (url === '/status') {
    const rows = Object.entries(state).map(([id, s]) => {
      const icon = s.status === 'running' ? '🟢'
                 : s.status === 'skipped' ? '⚪'
                 : s.status === 'error'   ? '🔴'
                 : '🟡';

      // Show live log line from bot's getStatus() if available
      let detail = s.lastLine.slice(0, 180);
      if (s.instance && typeof s.instance.getStatus === 'function') {
        try {
          const st = s.instance.getStatus();
          if (st && st.recentLogs && st.recentLogs[0]) {
            detail = String(st.recentLogs[0].msg || '').slice(0, 180);
          }
        } catch (_) {}
      }

      return `${icon} ${s.name.padEnd(35)} ${s.status.padEnd(12)} restarts: ${s.restarts}  ${detail}`;
    }).join('\n');

    const uptime = Math.floor(process.uptime() / 60);
    const memMB  = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const html = `<pre style="font-family:monospace;background:#111;color:#0f0;padding:20px;font-size:14px">
SOVEREIGN ECONOMY — BOT SERVER  [in-process · low RAM]
Uptime: ${uptime} min | RAM: ${memMB} MB / 512 MB | ${new Date().toUTCString()}
${'─'.repeat(90)}
${rows}
${'─'.repeat(90)}
All bots share one Node process — ~100 MB instead of ~480 MB.
Ping /health every 5min via UptimeRobot to keep alive for free.
</pre>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ── Boot ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  const mem = Math.round(process.memoryUsage().rss / 1024 / 1024);
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  Sovereign Economy — Bot Server            ║`);
  console.log(`║  Mode: IN-PROCESS  (RAM at boot: ${mem} MB)   ║`);
  console.log(`║  Health: http://localhost:${PORT}/health      ║`);
  console.log(`║  Status: http://localhost:${PORT}/status      ║`);
  console.log(`╚═══════════════════════════════════════════╝\n`);

  // Stagger starts by 10s each — smooths RPC calls + memory allocation
  BOTS.forEach((bot, i) => setTimeout(() => startBot(bot), i * 10_000));
});

server.on('error', (err) => {
  console.error('[BotServer] HTTP error:', err.message);
});

process.on('SIGTERM', () => {
  console.log('[BotServer] SIGTERM — stopping all bots');
  for (const s of Object.values(state)) {
    if (s.instance && typeof s.instance.stop === 'function') {
      try { s.instance.stop(); } catch (_) {}
    }
  }
  server.close(() => process.exit(0));
});

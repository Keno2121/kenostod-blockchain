'use strict';

/**
 * Sovereign Economy — Bot Server
 *
 * Runs as a single Render free Web Service.
 * Starts all 6 bots as child processes with auto-restart.
 * Exposes /health for UptimeRobot pings (keeps the service awake 24/7 for free).
 * Exposes /status for a live dashboard of all bot states.
 *
 * Deploy on Render:
 *   - Type: Web Service (free tier)
 *   - Build: npm install
 *   - Start: node bot-server.js
 *   - Then add UptimeRobot to ping /health every 5 minutes → never sleeps
 */

const http    = require('http');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3099;

// ── Bot definitions ────────────────────────────────────────────────────────
// Each bot runs as an isolated child process.
// Add / remove bots here. Set enabled: false to skip without deleting.

const BOTS = [
  {
    id:       'qct-hive-hl',
    name:     'QCT Hive — Hyperliquid Arb',
    script:   'queens-chariot/hyperliquid/QCTHiveHL.js',
    enabled:  !!process.env.QCT_DEPLOYER_KEY,
    requires: ['QCT_DEPLOYER_KEY'],
  },
  {
    id:       'keno-flash-orb',
    name:     'KENO Flash Orb Bot',
    script:   'src/KenoFlashOrbBot.js',
    enabled:  !!process.env.WALLET_PRIVATE_KEY,
    requires: ['WALLET_PRIVATE_KEY'],
  },
  {
    id:       'live-arb',
    name:     'Live Arb Bot',
    script:   'src/LiveArbBot.js',
    enabled:  !!process.env.WALLET_PRIVATE_KEY,
    requires: ['WALLET_PRIVATE_KEY'],
  },
  {
    id:       'aegis-arb',
    name:     'Aegis Arb Bot Manager',
    script:   'src/AegisArbBotManager.js',
    enabled:  !!process.env.WALLET_PRIVATE_KEY,
    requires: ['WALLET_PRIVATE_KEY'],
  },
  {
    id:       'shield-alert',
    name:     'Kings Shield Alert Bot',
    script:   'src/KingsShieldAlertBot.js',
    enabled:  !!process.env.KINGS_SHIELD_BOT_TOKEN,
    requires: ['KINGS_SHIELD_BOT_TOKEN'],
  },
  {
    id:       'queens-chariot-manager',
    name:     'Queens Chariot Bot Manager',
    script:   'src/QueensChariotBotManager.js',
    enabled:  !!process.env.WALLET_PRIVATE_KEY,
    requires: ['WALLET_PRIVATE_KEY'],
  },
];

// ── Bot state tracking ─────────────────────────────────────────────────────

const state = {};

for (const bot of BOTS) {
  state[bot.id] = {
    name:       bot.name,
    status:     'stopped',
    pid:        null,
    restarts:   0,
    lastStart:  null,
    lastLine:   '',
    enabled:    bot.enabled,
    requires:   bot.requires,
  };
}

// ── Start a bot process ────────────────────────────────────────────────────

function startBot(bot) {
  if (!bot.enabled) {
    console.log(`[BotServer] SKIP ${bot.name} — missing env: ${bot.requires.join(', ')}`);
    state[bot.id].status = 'skipped';
    return;
  }

  console.log(`[BotServer] Starting ${bot.name}...`);
  state[bot.id].status  = 'starting';
  state[bot.id].lastStart = new Date().toISOString();

  const proc = spawn('node', [bot.script], {
    env:   { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  state[bot.id].pid    = proc.pid;
  state[bot.id].status = 'running';

  proc.stdout.on('data', (data) => {
    const line = data.toString().trim().split('\n').pop();
    state[bot.id].lastLine = line;
    console.log(`[${bot.id}] ${line}`);
  });

  proc.stderr.on('data', (data) => {
    const line = data.toString().trim().split('\n').pop();
    state[bot.id].lastLine = '⚠ ' + line;
    console.error(`[${bot.id}] ERR: ${line}`);
  });

  proc.on('close', (code) => {
    state[bot.id].status = 'restarting';
    state[bot.id].pid    = null;
    state[bot.id].restarts += 1;
    console.log(`[BotServer] ${bot.name} exited (code ${code}). Restart #${state[bot.id].restarts} in 10s...`);

    // Auto-restart after 10 seconds
    setTimeout(() => startBot(bot), 10_000);
  });

  proc.on('error', (err) => {
    state[bot.id].status  = 'error';
    state[bot.id].lastLine = err.message;
    console.error(`[BotServer] Failed to start ${bot.name}:`, err.message);
    setTimeout(() => startBot(bot), 30_000);
  });
}

// ── HTTP server (keeps Render free tier alive + status dashboard) ──────────

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // Health check — UptimeRobot pings this every 5 min
  if (url === '/health' || url === '/') {
    const running = Object.values(state).filter(s => s.status === 'running').length;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, running, total: BOTS.length, ts: Date.now() }));
    return;
  }

  // Status dashboard — human readable
  if (url === '/status') {
    const rows = Object.entries(state).map(([id, s]) => {
      const icon = s.status === 'running' ? '🟢' : s.status === 'skipped' ? '⚪' : s.status === 'error' ? '🔴' : '🟡';
      return `${icon} ${s.name.padEnd(35)} ${s.status.padEnd(12)} restarts: ${s.restarts}  ${s.lastLine.slice(0, 60)}`;
    }).join('\n');

    const uptime = Math.floor(process.uptime() / 60);
    const html = `<pre style="font-family:monospace;background:#111;color:#0f0;padding:20px;font-size:14px">
SOVEREIGN ECONOMY — BOT SERVER
Uptime: ${uptime} minutes | ${new Date().toUTCString()}
${'─'.repeat(80)}
${rows}
${'─'.repeat(80)}
Ping /health every 5min via UptimeRobot to keep this alive for free.
</pre>`;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ── Boot ───────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  Sovereign Economy — Bot Server       ║`);
  console.log(`║  Health: http://localhost:${PORT}/health  ║`);
  console.log(`║  Status: http://localhost:${PORT}/status  ║`);
  console.log(`╚══════════════════════════════════════╝\n`);

  // Stagger bot starts by 5 seconds each to avoid RPC hammering
  BOTS.forEach((bot, i) => {
    setTimeout(() => startBot(bot), i * 5_000);
  });
});

server.on('error', (err) => {
  console.error('[BotServer] HTTP error:', err.message);
});

process.on('SIGTERM', () => {
  console.log('[BotServer] SIGTERM — shutting down');
  server.close(() => process.exit(0));
});

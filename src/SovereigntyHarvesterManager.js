/**
 * Sovereignty Harvester — Bot 1 of the Sovereign Bot Framework
 * ============================================================
 * Manages the aegis_relay.py child process (King's Shield Aegis Tax flywheel).
 *
 * The flywheel:
 *   SHIELD transfers on Solana generate 6.174% Aegis Tax
 *   → Tax accumulates in the Solana treasury wallet
 *   → When threshold hit, relay bridges SOL to BSC
 *   → KENOAutoBurn buys KENO on PancakeSwap → burns to 0xdead
 *   → KENO supply ↓ → price ↑ → YOUR holdings appreciate
 *
 * No external competition. This is your protocol. Your flywheel. Your lane.
 *
 * 7 Constitutional Laws: all 7 embedded.
 */

const { spawn }  = require('child_process');
const path       = require('path');
const https      = require('https');
const fs         = require('fs');
const Kaprekar   = require('./Kaprekar');
const Euler      = require('./Euler');
const Ramanujan  = require('./Ramanujan');
const Nash       = require('./Nash');
const Benford    = require('./Benford');
const GoldenRatio = require('./GoldenRatio');

const RELAY_SCRIPT = path.join(__dirname, '..', 'kings-shield', 'relay', 'aegis_relay.py');

// Kaprekar constant rooted in 6174
const BURN_THRESHOLD_SOL     = 1.0;    // matches relay default
const MAX_LOGS               = 200;
const RAMANUJAN_KENO_MILESTONE = 1729; // KENO burned milestone
const KAPREKAR_CYCLE         = 6174;   // internal cycle marker

class SovereigntyHarvesterManager {
    constructor() {
        this.process    = null;
        this.running    = false;
        this.startedAt  = null;
        this.logs       = [];

        // Harvest stats
        this.stats = {
            taxEventsDetected: 0,
            solHarvested:      0,
            kenoBurned:        0,          // cumulative KENO burned (units)
            burnCycles:        0,
            lastHarvest:       null,
            lastBurnTx:        null,
            nashScore:         0,
            eulerGrowthFactor: 1,          // e^(rt) on KENO burn rate
            ramanujanMilestone: false,      // 1729 KENO burned
            benfordAlerts:     0,
        };

        this._burnStartTime = Date.now();
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

    // ── Log ───────────────────────────────────────────────────────────────────
    _log(msg) {
        const entry = { time: new Date().toISOString(), msg };
        console.log(`[Sovereignty Harvester] ${msg}`);
        this.logs.unshift(entry);
        if (this.logs.length > MAX_LOGS) this.logs.pop();
    }

    // ── Constitutional Laws update ────────────────────────────────────────────
    _updateLaws() {
        // Euler: growth factor on cumulative burn rate over time
        const t = (Date.now() - this._burnStartTime) / (365 * 24 * 3600 * 1000); // years
        const r = 0.06174; // annual burn rate proxy (Kaprekar-themed)
        this.stats.eulerGrowthFactor = parseFloat(Math.exp(r * t).toFixed(6));

        // Nash: participation score on SHIELD holders vs burners
        const nash = Nash.payoffMatrix(this.stats.solHarvested, this.stats.burnCycles + 1, 0.60, 1);
        this.stats.nashScore = nash.nashScore;

        // Ramanujan: 1729 KENO burned milestone
        if (!this.stats.ramanujanMilestone && this.stats.kenoBurned >= RAMANUJAN_KENO_MILESTONE) {
            this.stats.ramanujanMilestone = true;
            this._log(`🌟 Ramanujan Milestone: ${RAMANUJAN_KENO_MILESTONE} KENO burned — silent bonus achieved`);
            this._alert(`🌟 <b>Ramanujan Milestone</b>\n${RAMANUJAN_KENO_MILESTONE} KENO burned!\nThe number 1729 — self-taught, from poverty, rewrote everything.\nSo did you.`);
        }

        // Benford: flag if burn amounts are suspiciously uniform
        if (this.stats.burnCycles > 20) {
            const recent = this.logs.filter(l => l.msg.includes('burned')).slice(0, 20)
                .map(l => { const m = l.msg.match(/[\d.]+/); return m ? parseFloat(m[0]) : null; })
                .filter(Boolean);
            if (recent.length >= 5) {
                try {
                    const bf = Benford.monitor(recent);
                    if (bf && bf.anomaly) { this.stats.benfordAlerts++; this._log(`⚠️ Benford anomaly in burn amounts — possible manipulation`); }
                } catch (_) {}
            }
        }
    }

    // ── Parse relay stdout lines ──────────────────────────────────────────────
    _parseLine(line) {
        if (!line.trim()) return;
        this._log(line.trim());

        // Detect tax events
        if (line.toLowerCase().includes('treasury') && line.toLowerCase().includes('sol')) {
            this.stats.taxEventsDetected++;
        }
        // Detect harvest
        const solMatch = line.match(/harvesting\s+([\d.]+)\s*sol/i);
        if (solMatch) {
            const sol = parseFloat(solMatch[1]);
            // Kaprekar absorb: dust flows to founder
            const [founderShare, burnShare] = Kaprekar.absorb(sol, [0.25, 0.75]);
            this.stats.solHarvested += founderShare + burnShare;
            this._log(`🎯 Kaprekar absorb — Founder: ${founderShare.toFixed(4)} SOL | Burn: ${burnShare.toFixed(4)} SOL`);
            this.stats.lastHarvest = new Date().toISOString();
        }
        // Detect burn
        const burnMatch = line.match(/burned\s+([\d.]+)\s*keno/i);
        if (burnMatch) {
            const keno = parseFloat(burnMatch[1]);
            this.stats.kenoBurned += keno;
            this.stats.burnCycles++;
            this.stats.lastBurnTx  = new Date().toISOString();
            this._updateLaws();
            this._alert(`🔥 <b>Sovereignty Harvester — KENO Burned</b>\n<b>${keno.toLocaleString()} KENO</b> sent to 0xdead\nCumulative: ${this.stats.kenoBurned.toLocaleString()} KENO\nEuler Growth: ×${this.stats.eulerGrowthFactor}\n🛡️ Supply ↓ → Price ↑ → Your holdings grow`);
        }
        // Detect tx hash
        const txMatch = line.match(/0x[a-fA-F0-9]{64}/);
        if (txMatch) { this.stats.lastBurnTx = txMatch[0]; }
    }

    // ── Start ─────────────────────────────────────────────────────────────────
    start() {
        if (this.running) return { success: false, msg: 'Sovereignty Harvester already running' };
        if (!fs.existsSync(RELAY_SCRIPT)) return { success: false, msg: `relay script not found: ${RELAY_SCRIPT}` };

        const env = {
            ...process.env,
            AEGIS_BURN_THRESHOLD_SOL: String(BURN_THRESHOLD_SOL),
            AEGIS_POLL_INTERVAL: '300',
        };

        this.process = spawn('python3', [RELAY_SCRIPT], {
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        this.running   = true;
        this.startedAt = new Date().toISOString();
        this._burnStartTime = Date.now();

        this.process.stdout.on('data', d => d.toString().split('\n').forEach(l => this._parseLine(l)));
        this.process.stderr.on('data', d => this._log(`STDERR: ${d.toString().trim()}`));

        this.process.on('close', code => {
            this.running = false;
            this._log(`Aegis Relay exited (code ${code})`);
            if (code !== 0) {
                this._alert(`⚠️ <b>Sovereignty Harvester stopped</b> (exit ${code})`);
                setTimeout(() => { if (!this.running) this.start(); }, 30_000);
            }
        });

        this._log('🛡️ Sovereignty Harvester started — Aegis Tax flywheel active');
        this._alert(`🛡️ <b>Sovereignty Harvester LIVE</b>\nMonitoring SHIELD treasury on Solana\nBurn threshold: ${BURN_THRESHOLD_SOL} SOL\nFlywheel: SHIELD tax → SOL → KENO burn → price ↑`);
        return { success: true, msg: 'Sovereignty Harvester started' };
    }

    stop() {
        if (this.process) { this.process.kill('SIGTERM'); this.process = null; }
        this.running = false;
        this._log('🛑 Sovereignty Harvester stopped');
        return { success: true, msg: 'stopped' };
    }

    getStatus() {
        return {
            name:    'Sovereignty Harvester (Bot 1)',
            running: this.running,
            startedAt: this.startedAt,
            stats:   this.stats,
            recentLogs: this.logs.slice(0, 30),
        };
    }
}

module.exports = SovereigntyHarvesterManager;

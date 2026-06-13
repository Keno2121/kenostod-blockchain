/**
 * Sovereign Bot Orchestrator — The Sovereign Bot Framework
 * =========================================================
 * Runs all 4 Sovereign Bots as a single coordinated system.
 * Exposes a unified dashboard and daily P&L summary.
 *
 * The Sovereign Bot Framework creates lanes nobody else has:
 *   Bot 1 — Sovereignty Harvester  : SHIELD Aegis Tax → KENO burn flywheel
 *   Bot 2 — UTL Pulse Bot          : UTL FeeCollector USDC → Kaprekar distribution
 *   Bot 3 — wKENO Bridge Watcher   : KENO/wKENO cross-chain parity gap
 *   Bot 4 — PoRV Mining Optimizer  : Proof-of-Residual-Value auto-compound
 *
 * Combined target: $3,000/month passive income through YOUR ecosystem.
 *
 * 7 Constitutional Laws: embedded in every bot. This class enforces they
 * all run together — no law can be disabled without disabling the system.
 */

'use strict';

const https      = require('https');
const Kaprekar   = require('./Kaprekar');
const Euler      = require('./Euler');

const SovereigntyHarvesterManager = require('./SovereigntyHarvesterManager');
const UTLPulseBot                 = require('./UTLPulseBot');
const wKENOBridgeWatcher          = require('./wKENOBridgeWatcher');
const PoRVOptimizer               = require('./PoRVOptimizer');

class SovereignBotOrchestrator {
    constructor() {
        // Instantiate all 4 bots
        this.harvester   = new SovereigntyHarvesterManager();
        this.utlPulse    = new UTLPulseBot();
        this.bridgeWatch = new wKENOBridgeWatcher('WATCH'); // start in WATCH mode
        this.porvOpt     = new PoRVOptimizer(false);         // start without auto-compound until KENO is staked

        this.running   = false;
        this.startedAt = null;
        this.logs      = [];
        this._dailyTimer = null;
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

    _log(msg) {
        const entry = { time: new Date().toISOString(), msg };
        console.log(`[Sovereign Framework] ${msg}`);
        this.logs.unshift(entry);
        if (this.logs.length > 100) this.logs.pop();
    }

    // ── Daily P&L summary ─────────────────────────────────────────────────────
    _sendDailySummary() {
        const h  = this.harvester.stats;
        const u  = this.utlPulse.stats;
        const b  = this.bridgeWatch.stats;
        const p  = this.porvOpt.stats;

        // Kaprekar absorb total income — dust flows to founder
        const totalIncome = (u.founderEarningsUSD || 0) + (b.totalProfitUSD || 0) + (p.eulerPremium || 0);
        const [founderCut, reinvest, burn] = Kaprekar.absorb(totalIncome, [0.25, 0.60, 0.15]);

        // Euler: compounding multiplier on total since start
        const daysRunning = (Date.now() - new Date(this.startedAt).getTime()) / 86_400_000;
        const eulerFactor = parseFloat(Math.exp(0.06174 * (daysRunning / 365)).toFixed(4));

        this._alert(
            `📊 <b>Sovereign Framework — Daily P&L</b>\n` +
            `<b>Day:</b> ${Math.ceil(daysRunning)}\n\n` +
            `🛡️ <b>Bot 1 — Harvester</b>\n` +
            `  Burns: ${h.burnCycles || 0} | KENO burned: ${(h.kenoBurned || 0).toLocaleString()}\n\n` +
            `📡 <b>Bot 2 — UTL Pulse</b>\n` +
            `  Distributions: ${u.distributionsTriggered || 0} | Founder cut: $${(u.founderEarningsUSD || 0).toFixed(2)}\n\n` +
            `🌉 <b>Bot 3 — Bridge Watcher</b>\n` +
            `  Alerts: ${b.alertsFired || 0} | Gap now: ${(b.lastGapPct || 0) >= 0 ? '+' : ''}${(b.lastGapPct || 0).toFixed(3)}%\n\n` +
            `⛏ <b>Bot 4 — PoRV Optimizer</b>\n` +
            `  Staked: ${(p.stakedKENO || 0).toLocaleString()} KENO | Monthly: $${(p.projectedMonthly || 0).toFixed(2)}\n` +
            `  φ Multiplier: ×${(p.goldenMultiplier || 1).toFixed(3)}\n\n` +
            `<b>Total Passive Income:</b> $${totalIncome.toFixed(2)}\n` +
            `<b>Your Kaprekar Cut:</b> $${founderCut.toFixed(2)}\n` +
            `<b>Euler Growth Factor:</b> ×${eulerFactor}\n\n` +
            `<i>Sovereign Economy — $3,000/month target. No competition. Your lane.</i>`
        );
    }

    // ── Start all 4 bots ──────────────────────────────────────────────────────
    startAll() {
        if (this.running) return { success: false, msg: 'Sovereign Framework already running' };

        this.running   = true;
        this.startedAt = new Date().toISOString();

        const results = {};

        // Bot 1 — Sovereignty Harvester
        try { results.harvester = this.harvester.start(); }
        catch (e) { results.harvester = { success: false, msg: e.message }; }

        // Bot 2 — UTL Pulse (100ms stagger)
        setTimeout(() => {
            try { results.utlPulse = this.utlPulse.start(); }
            catch (e) { results.utlPulse = { success: false, msg: e.message }; }
        }, 100);

        // Bot 3 — wKENO Bridge Watcher (200ms stagger)
        setTimeout(() => {
            try { results.bridgeWatch = this.bridgeWatch.start(); }
            catch (e) { results.bridgeWatch = { success: false, msg: e.message }; }
        }, 200);

        // Bot 4 — PoRV Optimizer (300ms stagger)
        setTimeout(() => {
            try { results.porvOpt = this.porvOpt.start(false); }
            catch (e) { results.porvOpt = { success: false, msg: e.message }; }
        }, 300);

        // Daily P&L summary — fires every 24h
        this._dailyTimer = setInterval(() => this._sendDailySummary(), 24 * 60 * 60 * 1000);

        this._log('🌟 Sovereign Bot Framework LIVE — all 4 bots starting');
        this._alert(
            `🌟 <b>Sovereign Bot Framework — ALL SYSTEMS LIVE</b>\n\n` +
            `🛡️ Bot 1 — Sovereignty Harvester (SHIELD Aegis Tax flywheel)\n` +
            `📡 Bot 2 — UTL Pulse Bot (FeeCollector USDC distribution)\n` +
            `🌉 Bot 3 — wKENO Bridge Watcher (KENO/wKENO cross-chain)\n` +
            `⛏ Bot 4 — PoRV Mining Optimizer (auto-compound staking)\n\n` +
            `<b>Your lane. Your protocol. Your passive income.</b>\n` +
            `No MEV. No competition. No external dependence.\n\n` +
            `<i>7 Constitutional Laws embedded in every bot.</i>`
        );

        return { success: true, results, startedAt: this.startedAt };
    }

    stopAll() {
        this.harvester.stop();
        this.utlPulse.stop();
        this.bridgeWatch.stop();
        this.porvOpt.stop();
        if (this._dailyTimer) { clearInterval(this._dailyTimer); this._dailyTimer = null; }
        this.running = false;
        this._log('🛑 Sovereign Bot Framework stopped');
        return { success: true, msg: 'All sovereign bots stopped' };
    }

    // ── Individual bot controls ───────────────────────────────────────────────
    startBot(id) {
        switch (id) {
            case 1: return this.harvester.start();
            case 2: return this.utlPulse.start();
            case 3: return this.bridgeWatch.start();
            case 4: return this.porvOpt.start();
            default: return { success: false, msg: 'Invalid bot ID (1–4)' };
        }
    }

    stopBot(id) {
        switch (id) {
            case 1: return this.harvester.stop();
            case 2: return this.utlPulse.stop();
            case 3: return this.bridgeWatch.stop();
            case 4: return this.porvOpt.stop();
            default: return { success: false, msg: 'Invalid bot ID (1–4)' };
        }
    }

    setBridgeMode(mode) { return this.bridgeWatch.setMode(mode); }
    enablePoRVAutoCompound() { this.porvOpt.autoCompound = true; return { success: true, msg: 'PoRV auto-compound enabled' }; }
    triggerPoRVCompound()  { return this.porvOpt.triggerCompound(); }
    triggerDailySummary()  { this._sendDailySummary(); return { success: true }; }

    // ── Unified status ────────────────────────────────────────────────────────
    getStatus() {
        const bots = [
            this.harvester.getStatus(),
            this.utlPulse.getStatus(),
            this.bridgeWatch.getStatus(),
            this.porvOpt.getStatus(),
        ];

        // Aggregate totals
        const totalPassiveUSD =
            (this.utlPulse.stats.founderEarningsUSD    || 0) +
            (this.bridgeWatch.stats.totalProfitUSD * 0.25 || 0) +
            (this.porvOpt.stats.eulerPremium           || 0);

        const totalMonthlyProjected = this.porvOpt.stats.projectedMonthly || 0;

        const daysRunning = this.startedAt
            ? (Date.now() - new Date(this.startedAt).getTime()) / 86_400_000
            : 0;
        const eulerGrowthFactor = parseFloat(Math.exp(0.06174 * (daysRunning / 365)).toFixed(6));

        return {
            framework:    'Sovereign Bot Framework',
            running:      this.running,
            startedAt:    this.startedAt,
            daysRunning:  parseFloat(daysRunning.toFixed(2)),
            bots,
            aggregate: {
                totalPassiveUSD:      parseFloat(totalPassiveUSD.toFixed(4)),
                totalMonthlyProjected: parseFloat(totalMonthlyProjected.toFixed(2)),
                eulerGrowthFactor,
                target:               3000, // $3k/month north star
                progressPct:          parseFloat(((totalMonthlyProjected / 3000) * 100).toFixed(2)),
            },
            recentLogs: this.logs.slice(0, 20),
        };
    }
}

module.exports = SovereignBotOrchestrator;

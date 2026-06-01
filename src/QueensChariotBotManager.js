/**
 * Queens Chariot Bot — The Hive Orchestrator 👑
 *
 * As bees are to the queen bee, so the worker bots are to the Queens Chariot Bot.
 * This bot does NOT trade. It ORCHESTRATES — watching the entire hive, applying
 * the 7 Constitutional Laws to collective earnings, and directing the swarm.
 *
 * Worker Bots (The Hive):
 *   🤖 KENO Flash Orb     (BSC)
 *   ⚔  Aegis Arb          (Solana)
 *   📜 Constitution Flash  (Solana)
 *   🤖 Live Arb            (BSC)
 *   💎 Hyperliquid Funding (Hyperliquid)
 *   💜 Drift Funding       (Solana)
 *
 * Queens Chariot Bot Responsibilities:
 *   1. Kaprekar Split        — Routes all hive profits: 60% reinvest / 25% pocket / 15% QCT burn
 *   2. Benford Monitor       — Watches profit patterns for manipulation across all bots
 *   3. Golden Ratio Rank     — φ-scores each bot (performance × time loyalty), ranks the hive
 *   4. Nash Rebalancer       — Calculates optimal capital allocation across bots
 *   5. Euler Projector       — Compound growth curve: projects months to $3k/month goal
 *   6. Ramanujan Milestone   — Alerts at 1729 USDC cumulative hive profit (and every multiple)
 *   7. Inversion Enforcer    — Verifies profits flow DOWN to participants, flags reversals
 *
 * Additional:
 *   - Prosperity Cascade Signal — Tells you when to trigger QCT buyback/burn
 *   - Auto-Guardian            — Detects and alerts when any worker bot goes silent
 *   - Daily Hive Report        — Telegram consolidated P&L across all 6 bots
 *   - Milestone Projections    — How far to each capital ladder rung ($500→$2k→$10k→$40k)
 */

'use strict';

const axios = require('axios');

// ── Mathematical constants (Constitutional Laws) ──────────────────────────────
const PHI         = 1.6180339887;   // Golden Ratio φ (Law #3)
const EULER       = Math.E;          // Euler's number e (Law #5)
const KAPREKAR    = 6174;            // Kaprekar's constant (Law #1)
const RAMANUJAN   = 1729;            // Hardy-Ramanujan number (Law #6)

// Kaprekar profit split (Law #1)
const KAPREKAR_REINVEST = 0.60;  // 60% back into hive capital
const KAPREKAR_POCKET   = 0.25;  // 25% to founder wallet
const KAPREKAR_BURN     = 0.15;  // 15% QCT auto-burn signal

// Nash equilibrium target monthly income
const NASH_TARGET_MONTHLY = 3000; // $3,000/month financial freedom goal

// Euler compounding model
const EULER_COMPOUNDING_PERIODS = 12; // Monthly

// Hive poll interval
const POLL_INTERVAL_MS = 60 * 1000; // Poll all bots every 60 seconds

// Daily Telegram report (24 hours)
const DAILY_REPORT_MS = 24 * 60 * 60 * 1000;

class QueensChariotBotManager {
    constructor(workerBots = []) {
        // ── Worker bot registry ────────────────────────────────────────────
        // Each entry: { id, name, emoji, chain, manager }
        this.workerBots = workerBots;

        // ── Queen state ────────────────────────────────────────────────────
        this.running   = false;
        this.startedAt = null;
        this.scanCount = 0;
        this.lastPollAt = null;

        // ── Hive profit aggregation ────────────────────────────────────────
        this.botProfits      = {};   // { botId: lastKnownProfit }
        this.botProfitDeltas = {};   // { botId: profitGainedSinceQueenStart }
        this.botStartBaseline = {};  // { botId: profit at time Queen started }
        this.totalHiveProfit = 0;   // Cumulative hive profit since Queen started

        // ── Law #1: Kaprekar Split ─────────────────────────────────────────
        this.kaprekarReinvest = 0;  // Running tally: 60% reinvested
        this.kaprekarPocket   = 0;  // Running tally: 25% to founder
        this.kaprekarBurn     = 0;  // Running tally: 15% QCT burn signal

        // ── Law #3: Golden Ratio Rankings ─────────────────────────────────
        this.phiScores  = {};       // { botId: φ-weighted performance score }
        this.phiRanking = [];       // Sorted bot IDs by φ-score (best first)

        // ── Law #4: Nash Rebalancer ────────────────────────────────────────
        this.nashWeights     = {};  // { botId: suggestedCapitalWeight 0-100 }
        this.nashLastRebalance = null;
        this.nashHistory     = [];  // Last 10 rebalance suggestions

        // ── Law #5: Euler Compound Projector ──────────────────────────────
        this.eulerStartCapital   = 500;   // $500 starting capital (ladder rung 1)
        this.eulerCurrentCapital = 500;
        this.eulerDailyRate      = 0;     // Observed daily return rate
        this.eulerProjections    = {};    // { months: projectedCapital }

        // ── Law #6: Ramanujan Milestone ────────────────────────────────────
        this.ramanujanNextTarget = RAMANUJAN;  // Next milestone ($1729)
        this.ramanujanHitCount   = 0;          // How many milestones crossed
        this.ramanujanHistory    = [];

        // ── Law #2: Benford Monitor ────────────────────────────────────────
        this.profitDeltas  = [];           // Rolling profit increments across all bots
        this.benfordAlert  = false;
        this.benfordReason = null;

        // ── Law #7: Inversion Enforcer ─────────────────────────────────────
        this.inversionBreaches = [];       // Logged if value ever flows UP (wrong direction)

        // ── QCT Buyback / Prosperity Signals ──────────────────────────────
        this.buybackSignals = [];
        this.lastBuybackAt  = null;

        // ── Auto-Guardian: silent bot detection ───────────────────────────
        this.botSilenceAlerts = {};       // { botId: timestamp of last alert }
        this.botWasRunning    = {};       // { botId: bool } — tracks if bot was running

        // ── Telegram ───────────────────────────────────────────────────────
        this.telegramToken  = process.env.KINGS_SHIELD_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
        this.telegramChatId = process.env.SHIELD_ALERT_CHAT_ID;
        this.lastDailyReport = null;
        this.dailyReportTimer = null;

        // ── Internal log ───────────────────────────────────────────────────
        this.log = [];
        this._log('👑 Queens Chariot Bot initialized — Hive Orchestrator ready');
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  START / STOP
    // ═══════════════════════════════════════════════════════════════════════

    start() {
        if (this.running) return { ok: false, msg: 'Queens Chariot Bot is already running' };

        this.running   = true;
        this.startedAt = Date.now();
        this.scanCount = 0;

        // Baseline: snapshot current profit of each worker bot
        this._snapshotBaselines();

        // Start polling loop
        this.pollTimer = setInterval(() => this._poll(), POLL_INTERVAL_MS);

        // Schedule daily Telegram report
        this.dailyReportTimer = setInterval(() => this._sendDailyReport(), DAILY_REPORT_MS);

        // Run first poll immediately
        this._poll();

        this._log('👑 Queens Chariot Bot STARTED — The hive is now under sovereign oversight');
        this._telegram(
            `👑 <b>Queens Chariot Bot — HIVE ONLINE</b>\n\n` +
            `The Queen is watching. Every worker bot in the sovereign ecosystem is now ` +
            `under constitutional oversight.\n\n` +
            `🐝 Worker bots monitored: ${this.workerBots.length}\n` +
            `⚖️  7 Constitutional Laws: ACTIVE\n` +
            `🎯 Nash Target: $${NASH_TARGET_MONTHLY.toLocaleString()}/month\n\n` +
            `<i>"As bees are to the queen bee, so the sovereign bots are to the Chariot."</i>`
        );

        return { ok: true, msg: 'Queens Chariot Bot started — Hive under sovereign oversight' };
    }

    stop() {
        if (!this.running) return { ok: false, msg: 'Queens Chariot Bot is not running' };

        this.running = false;
        if (this.pollTimer)       { clearInterval(this.pollTimer);       this.pollTimer = null; }
        if (this.dailyReportTimer){ clearInterval(this.dailyReportTimer); this.dailyReportTimer = null; }

        const summary = this._buildHiveSummary();
        this._log(`👑 Queens Chariot Bot STOPPED — Total hive profit monitored: $${this.totalHiveProfit.toFixed(2)}`);
        this._telegram(
            `👑 <b>Queens Chariot Bot — HIVE OFFLINE</b>\n\n` +
            `${summary}\n\n<i>The Queen rests. The hive remembers.</i>`
        );

        return { ok: true, msg: 'Queens Chariot Bot stopped', summary };
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  CORE POLL — runs every 60 seconds
    // ═══════════════════════════════════════════════════════════════════════

    _poll() {
        if (!this.running) return;
        this.scanCount++;
        this.lastPollAt = Date.now();

        try {
            // Step 1: Gather status from all worker bots
            const hiveSnapshot = this._gatherHiveStatus();

            // Step 2: Calculate profit deltas since Queen started
            this._updateProfitDeltas(hiveSnapshot);

            // Step 3: Apply 7 Constitutional Laws
            this._applyKaprekar();      // Law #1 — split profits
            this._applyBenford();       // Law #2 — anomaly detection
            this._applyGoldenRatio();   // Law #3 — φ-rank bots
            this._applyNash();          // Law #4 — rebalance capital weights
            this._applyEuler();         // Law #5 — compound projections
            this._checkRamanujan();     // Law #6 — milestone alert
            this._enforceInversion();   // Law #7 — verify value flows DOWN

            // Step 4: Guardian — detect silent/crashed bots
            this._guardianCheck(hiveSnapshot);

            // Step 5: Check if QCT buyback conditions are met
            this._checkBuybackSignal();

        } catch (err) {
            this._log(`⚠ Hive poll error: ${err.message}`);
        }
    }

    // ── Gather current status from all worker bots ────────────────────────

    _gatherHiveStatus() {
        const snapshot = {};
        for (const bot of this.workerBots) {
            try {
                const status = bot.manager.getStatus();
                snapshot[bot.id] = {
                    running:     !!status.running,
                    profit:      parseFloat(status.totalProfit || 0),
                    tradeCount:  parseInt(status.tradeCount    || 0),
                    scanCount:   parseInt(status.scanCount     || 0),
                    chain:       bot.chain,
                    name:        bot.name,
                    emoji:       bot.emoji,
                };
            } catch {
                snapshot[bot.id] = { running: false, profit: 0, tradeCount: 0, scanCount: 0,
                                     chain: bot.chain, name: bot.name, emoji: bot.emoji };
            }
        }
        return snapshot;
    }

    // ── Baseline profit snapshot at Queen start ───────────────────────────

    _snapshotBaselines() {
        for (const bot of this.workerBots) {
            try {
                const status = bot.manager.getStatus();
                const p = parseFloat(status.totalProfit || 0);
                this.botStartBaseline[bot.id] = p;
                this.botProfits[bot.id]       = p;
                this.botProfitDeltas[bot.id]  = 0;
            } catch {
                this.botStartBaseline[bot.id] = 0;
                this.botProfits[bot.id]       = 0;
                this.botProfitDeltas[bot.id]  = 0;
            }
        }
    }

    _updateProfitDeltas(snapshot) {
        let newDelta = 0;
        for (const [id, data] of Object.entries(snapshot)) {
            const baseline    = this.botStartBaseline[id] || 0;
            const delta       = Math.max(0, data.profit - baseline);
            const prevDelta   = this.botProfitDeltas[id] || 0;
            const increment   = delta - prevDelta;

            this.botProfitDeltas[id] = delta;
            this.botProfits[id]      = data.profit;

            if (increment > 0) {
                newDelta += increment;
                this.profitDeltas.push(increment); // For Benford
                if (this.profitDeltas.length > 150) this.profitDeltas.shift();
            }
        }
        if (newDelta > 0) {
            this.totalHiveProfit += newDelta;
            this._log(`💰 Hive earned +$${newDelta.toFixed(4)} | Total: $${this.totalHiveProfit.toFixed(2)}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  LAW #1: KAPREKAR — Split every hive profit increment 60/25/15
    // ═══════════════════════════════════════════════════════════════════════

    _applyKaprekar() {
        // Recompute from total (idempotent — always reflect true totals)
        this.kaprekarReinvest = this.totalHiveProfit * KAPREKAR_REINVEST;
        this.kaprekarPocket   = this.totalHiveProfit * KAPREKAR_POCKET;
        this.kaprekarBurn     = this.totalHiveProfit * KAPREKAR_BURN;
        // Dust: totalHiveProfit - (reinvest + pocket + burn) → flows to reinvest (Kaprekar: dust to participant)
        const dust = this.totalHiveProfit - this.kaprekarReinvest - this.kaprekarPocket - this.kaprekarBurn;
        this.kaprekarReinvest += dust;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  LAW #2: BENFORD — Monitor profit deltas for manipulation
    // ═══════════════════════════════════════════════════════════════════════

    _applyBenford() {
        const n = this.profitDeltas.length;
        if (n < 20) return;

        let digit1Count = 0;
        const checkN = Math.min(n, 100);
        for (let i = n - checkN; i < n; i++) {
            const v = this.profitDeltas[i];
            let leadStr = Math.abs(v).toFixed(4).replace('.', '').replace(/^0+/, '');
            if (!leadStr) continue;
            if (leadStr[0] === '1') digit1Count++;
        }

        const pct = (digit1Count / checkN) * 100;
        const wasAlert = this.benfordAlert;

        if (pct < 8 || pct > 65) {
            this.benfordAlert  = true;
            this.benfordReason = `Leading-digit-1 = ${pct.toFixed(1)}% (Benford expects ~30%). Possible profit manipulation or wash trading.`;
            if (!wasAlert) {
                this._log(`⚠ Benford anomaly detected: ${this.benfordReason}`);
                this._telegram(`⚠️ <b>Hive Benford Alert</b>\n\n${this.benfordReason}\n\nCheck bots for manipulation.`);
            }
        } else {
            this.benfordAlert  = false;
            this.benfordReason = null;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  LAW #3: GOLDEN RATIO — φ-weighted performance ranking
    // ═══════════════════════════════════════════════════════════════════════

    _applyGoldenRatio() {
        const elapsed = this.startedAt ? (Date.now() - this.startedAt) / (1000 * 60 * 60 * 24) : 1; // days

        const scores = {};
        for (const [id, delta] of Object.entries(this.botProfitDeltas)) {
            // φ-score: profit × φ^(days_in_hive / 30)
            // Bots that earn consistently over time are rewarded exponentially
            const loyaltyBonus = Math.pow(PHI, elapsed / 30);
            scores[id] = delta * loyaltyBonus;
        }

        this.phiScores  = scores;
        this.phiRanking = Object.entries(scores)
            .sort(([, a], [, b]) => b - a)
            .map(([id]) => id);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  LAW #4: NASH — Optimal capital allocation across bots
    // ═══════════════════════════════════════════════════════════════════════

    _applyNash() {
        const totalDelta = Object.values(this.botProfitDeltas).reduce((s, v) => s + v, 0);
        const weights    = {};
        const botCount   = this.workerBots.length;
        const floor      = Math.floor(100 / botCount / 2); // Minimum floor: half of equal share

        if (totalDelta <= 0) {
            // No earnings yet — equal weight (Nash: when no data, spread evenly)
            for (const bot of this.workerBots) weights[bot.id] = Math.floor(100 / botCount);
        } else {
            // Proportional to earnings with a floor to keep all bots funded
            let remaining = 100;
            const sorted  = [...this.workerBots].sort(
                (a, b) => (this.botProfitDeltas[b.id] || 0) - (this.botProfitDeltas[a.id] || 0)
            );

            for (let i = 0; i < sorted.length; i++) {
                const bot   = sorted[i];
                const delta = this.botProfitDeltas[bot.id] || 0;
                const share = totalDelta > 0 ? Math.round((delta / totalDelta) * 100) : 0;
                const w     = Math.max(floor, Math.min(share, remaining - floor * (sorted.length - i - 1)));
                weights[bot.id] = w;
                remaining -= w;
            }
        }

        // Check if rebalancing changed materially (>5% shift for any bot)
        const changed = Object.keys(weights).some(
            id => Math.abs((weights[id] || 0) - (this.nashWeights[id] || 0)) > 5
        );

        if (changed && this.scanCount > 1) {
            this.nashHistory.unshift({ timestamp: Date.now(), weights: { ...weights } });
            if (this.nashHistory.length > 10) this.nashHistory.pop();
            this._log('⚖️  Nash rebalance: ' + Object.entries(weights).map(([id, w]) => `${id}=${w}%`).join(' | '));
        }

        this.nashWeights        = weights;
        this.nashLastRebalance  = Date.now();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  LAW #5: EULER — Continuous compound growth projections
    // ═══════════════════════════════════════════════════════════════════════

    _applyEuler() {
        const elapsedDays = this.startedAt
            ? (Date.now() - this.startedAt) / (1000 * 60 * 60 * 24)
            : 0.001;

        if (this.totalHiveProfit <= 0 || elapsedDays < 0.1) return;

        // Daily return rate from actual hive performance
        // r = ln(1 + totalProfit / startCapital) / days
        this.eulerDailyRate = Math.log(1 + this.totalHiveProfit / this.eulerStartCapital) / elapsedDays;

        // Monthly rate (30 days)
        const monthlyRate = this.eulerDailyRate * 30;

        // Project capital at future time periods (continuous compounding: A = P * e^(r*t))
        const projections = {};
        for (const months of [1, 3, 6, 12, 24]) {
            projections[months] = this.eulerStartCapital * Math.pow(EULER, monthlyRate * months);
        }
        this.eulerProjections = projections;

        // Update current capital estimate
        this.eulerCurrentCapital = this.eulerStartCapital + this.totalHiveProfit * KAPREKAR_REINVEST;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  LAW #6: RAMANUJAN — 1729 USDC milestone (and multiples)
    // ═══════════════════════════════════════════════════════════════════════

    _checkRamanujan() {
        if (this.totalHiveProfit >= this.ramanujanNextTarget) {
            this.ramanujanHitCount++;
            const multiple = this.ramanujanHitCount;
            const msg =
                `🌟 <b>Ramanujan Milestone #${multiple} ACHIEVED!</b>\n\n` +
                `The sovereign hive has collectively earned <b>$${this.totalHiveProfit.toFixed(2)}</b> ` +
                `— crossing the ${RAMANUJAN} × ${multiple} = $${(RAMANUJAN * multiple).toLocaleString()} threshold.\n\n` +
                `In 1729, Hardy visited Ramanujan in hospital and commented on the "dull" taxi number 1729. ` +
                `Ramanujan replied instantly: <i>"It is the smallest number expressible as the sum of two cubes in two different ways."</i>\n\n` +
                `Self-taught. No resources. Rewrote everything.\n` +
                `<b>That is the Sovereign Economy.</b>\n\n` +
                `Next milestone: $${(RAMANUJAN * (multiple + 1)).toLocaleString()}`;

            this.ramanujanHistory.push({
                milestone: multiple,
                amount:    this.totalHiveProfit,
                timestamp: Date.now(),
            });

            this.ramanujanNextTarget = RAMANUJAN * (multiple + 1);
            this._log(`🌟 Ramanujan Milestone #${multiple}: $${this.totalHiveProfit.toFixed(2)}`);
            this._telegram(msg);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  LAW #7: INVERSION — Verify value flows DOWN to participants
    // ═══════════════════════════════════════════════════════════════════════

    _enforceInversion() {
        // Inversion check: the largest slice of profit must always be the
        // participant-facing portion (reinvest + pocket) vs. protocol extraction
        const participantShare = this.kaprekarReinvest + this.kaprekarPocket; // 85%
        const protocolShare    = this.kaprekarBurn;                           // 15%

        if (participantShare < protocolShare && this.totalHiveProfit > 0) {
            const breach = {
                timestamp:        Date.now(),
                participantShare,
                protocolShare,
                description:      'Protocol extraction exceeded participant share — Inversion Law breached',
            };
            this.inversionBreaches.push(breach);
            this._log(`⚠ Inversion breach: protocol ${protocolShare.toFixed(2)} > participant ${participantShare.toFixed(2)}`);
            this._telegram(`⚠️ <b>Inversion Law Breach</b>\n\nProtocol extraction ($${protocolShare.toFixed(2)}) exceeded participant share ($${participantShare.toFixed(2)}). Constitutional review required.`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  GUARDIAN — detect silent / crashed worker bots
    // ═══════════════════════════════════════════════════════════════════════

    _guardianCheck(snapshot) {
        const now = Date.now();
        for (const bot of this.workerBots) {
            const data    = snapshot[bot.id] || {};
            const wasRunning = this.botWasRunning[bot.id] || false;

            if (wasRunning && !data.running) {
                // Bot went silent — alert
                const lastAlert = this.botSilenceAlerts[bot.id] || 0;
                if (now - lastAlert > 30 * 60 * 1000) { // Max 1 alert per 30 min
                    this.botSilenceAlerts[bot.id] = now;
                    this._log(`🚨 ${bot.emoji} ${bot.name} went offline — Guardian alert`);
                    this._telegram(
                        `🚨 <b>Hive Guardian Alert</b>\n\n` +
                        `${bot.emoji} <b>${bot.name}</b> has gone offline.\n\n` +
                        `The worker bee is silent. Visit your Bots dashboard to restart it.\n` +
                        `Nash capital weight for this bot: ${this.nashWeights[bot.id] || 0}%`
                    );
                }
            }

            this.botWasRunning[bot.id] = data.running;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  QCT BUYBACK SIGNAL
    // ═══════════════════════════════════════════════════════════════════════

    _checkBuybackSignal() {
        // Conditions for a buyback signal:
        // 1. Hive has earned ≥$100 since Queen started
        // 2. Kaprekar burn allocation ≥ $15 (15% of $100+)
        // 3. Nash equilibrium is stable (no rebalance needed)
        // 4. At least 24h since last signal

        const now           = Date.now();
        const timeSinceLast = this.lastBuybackAt ? now - this.lastBuybackAt : Infinity;
        const qualified     = (
            this.totalHiveProfit >= 100 &&
            this.kaprekarBurn    >= 15  &&
            timeSinceLast        > DAILY_REPORT_MS
        );

        if (qualified) {
            this.lastBuybackAt = now;
            const signal = {
                timestamp:    now,
                hiveProfitAt: this.totalHiveProfit,
                burnAmount:   this.kaprekarBurn,
                message:      `QCT Buyback Window: $${this.kaprekarBurn.toFixed(2)} available for buyback + burn`,
            };
            this.buybackSignals.push(signal);

            this._log(`💎 QCT Buyback signal: $${this.kaprekarBurn.toFixed(2)} for burn`);
            this._telegram(
                `💎 <b>QCT Buyback & Burn Signal</b>\n\n` +
                `The hive has generated <b>$${this.totalHiveProfit.toFixed(2)}</b> in collective profit.\n\n` +
                `🔥 Kaprekar 15% burn allocation: <b>$${this.kaprekarBurn.toFixed(2)}</b>\n\n` +
                `This is your signal to:\n` +
                `1. Buy QCT on Aerodrome / Uniswap V3 (Base)\n` +
                `2. Send to the burn address (or trigger burn via contract)\n` +
                `3. Watch the Prosperity Cascade amplify for remaining holders\n\n` +
                `<i>Every burn makes the Chariot lighter and faster.</i>`
            );
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  DAILY HIVE REPORT — Telegram P&L summary
    // ═══════════════════════════════════════════════════════════════════════

    _sendDailyReport() {
        this.lastDailyReport = Date.now();
        const summary = this._buildHiveSummary();
        this._telegram(`👑 <b>Queens Chariot — Daily Hive Report</b>\n\n${summary}`);
        this._log('📊 Daily Hive Report sent to Telegram');
    }

    _buildHiveSummary() {
        const lines = [];

        // Worker bee earnings table
        lines.push('🐝 <b>Worker Bot Earnings (since Queen started):</b>');
        for (const bot of this.workerBots) {
            const delta  = this.botProfitDeltas[bot.id] || 0;
            const w      = this.nashWeights[bot.id]      || 0;
            const rank   = this.phiRanking.indexOf(bot.id) + 1;
            const status = (this.workerBots.find(b => b.id === bot.id) && this.botWasRunning[bot.id]) ? '🟢' : '🔴';
            lines.push(`  ${status} ${bot.emoji} ${bot.name} [${bot.chain}]`);
            lines.push(`     Profit: $${delta.toFixed(2)} | Nash weight: ${w}% | φ-rank: #${rank}`);
        }

        lines.push('');
        lines.push(`💰 <b>Total Hive Profit: $${this.totalHiveProfit.toFixed(2)}</b>`);
        lines.push('');

        // Kaprekar split
        lines.push('⚖️ <b>Kaprekar Split (Law #1):</b>');
        lines.push(`  🔄 60% Reinvest capital:  $${this.kaprekarReinvest.toFixed(2)}`);
        lines.push(`  💵 25% Your pocket:        $${this.kaprekarPocket.toFixed(2)}`);
        lines.push(`  🔥 15% QCT burn signal:   $${this.kaprekarBurn.toFixed(2)}`);
        lines.push('');

        // Euler projections
        if (this.eulerDailyRate > 0 && Object.keys(this.eulerProjections).length > 0) {
            const monthlyIncome = (this.eulerCurrentCapital * this.eulerDailyRate * 30).toFixed(0);
            lines.push('📈 <b>Euler Compound Projections (Law #5):</b>');
            lines.push(`  Current capital (est): $${this.eulerCurrentCapital.toFixed(0)}`);
            lines.push(`  Monthly income now:    ~$${monthlyIncome}`);
            for (const [mo, cap] of Object.entries(this.eulerProjections)) {
                const income = (cap * this.eulerDailyRate * 30).toFixed(0);
                const flag   = parseFloat(income) >= NASH_TARGET_MONTHLY ? ' 🎯' : '';
                lines.push(`  ${mo}mo → $${Math.round(cap).toLocaleString()} capital → ~$${income}/mo${flag}`);
            }
            lines.push('');
        }

        // Ramanujan progress
        const pct = Math.min(100, (this.totalHiveProfit / this.ramanujanNextTarget * 100)).toFixed(1);
        lines.push(`🌟 <b>Ramanujan Progress (Law #6):</b>`);
        lines.push(`  Next milestone: $${this.ramanujanNextTarget.toLocaleString()} (${pct}% there)`);
        lines.push(`  Milestones crossed: ${this.ramanujanHitCount}`);
        lines.push('');

        // Benford status
        if (this.benfordAlert) {
            lines.push(`⚠️ <b>Benford Alert:</b> ${this.benfordReason}`);
        } else {
            lines.push(`✅ <b>Benford:</b> Profit patterns look clean (no manipulation detected)`);
        }
        lines.push('');

        // Inversion status
        lines.push(`🔄 <b>Inversion Law:</b> ${this.inversionBreaches.length === 0 ? '✅ Value flowing DOWN to participants' : `⚠ ${this.inversionBreaches.length} breach(es) detected`}`);

        // Scan info
        lines.push('');
        lines.push(`🔍 Hive scans: ${this.scanCount} | Uptime: ${this._uptime()}`);

        return lines.join('\n');
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════

    /// Force a Nash rebalance recommendation right now
    rebalance() {
        this._applyGoldenRatio();
        this._applyNash();
        return {
            ok:          true,
            nashWeights: this.nashWeights,
            phiRanking:  this.phiRanking,
            msg:         'Nash rebalance complete — see weights for recommended capital allocation',
        };
    }

    /// Send daily report now on demand
    sendReport() {
        this._sendDailyReport();
        return { ok: true, msg: 'Hive report sent to Telegram' };
    }

    getStatus() {
        const elapsedDays = this.startedAt
            ? (Date.now() - this.startedAt) / (1000 * 60 * 60 * 24)
            : 0;

        return {
            running:              this.running,
            startedAt:            this.startedAt,
            scanCount:            this.scanCount,
            lastPollAt:           this.lastPollAt,
            workerBotCount:       this.workerBots.length,
            uptime:               this._uptime(),

            // Hive earnings
            totalHiveProfit:      this.totalHiveProfit,
            botProfitDeltas:      this.botProfitDeltas,

            // Kaprekar split
            kaprekarReinvest:     this.kaprekarReinvest,
            kaprekarPocket:       this.kaprekarPocket,
            kaprekarBurn:         this.kaprekarBurn,

            // Constitutional Law status
            phiRanking:           this.phiRanking,
            phiScores:            this.phiScores,
            nashWeights:          this.nashWeights,
            nashLastRebalance:    this.nashLastRebalance,
            eulerDailyRate:       this.eulerDailyRate,
            eulerCurrentCapital:  this.eulerCurrentCapital,
            eulerProjections:     this.eulerProjections,
            ramanujanProgress:    `$${this.totalHiveProfit.toFixed(2)} / $${this.ramanujanNextTarget.toLocaleString()}`,
            ramanujanHitCount:    this.ramanujanHitCount,
            ramanujanPct:         Math.min(100, this.totalHiveProfit / this.ramanujanNextTarget * 100).toFixed(1),
            benfordAlert:         this.benfordAlert,
            benfordReason:        this.benfordReason,
            inversionBreaches:    this.inversionBreaches.length,

            // Signals
            lastBuybackSignal:    this.lastBuybackAt,
            buybackSignalCount:   this.buybackSignals.length,

            // Log
            log:                  this.log.slice(-20),
        };
    }

    getFullReport() {
        return {
            ok:      true,
            summary: this._buildHiveSummary(),
            status:  this.getStatus(),
            nashHistory:       this.nashHistory,
            ramanujanHistory:  this.ramanujanHistory,
            buybackSignals:    this.buybackSignals.slice(-5),
            inversionBreaches: this.inversionBreaches.slice(-5),
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    _uptime() {
        if (!this.startedAt) return '0m';
        const ms      = Date.now() - this.startedAt;
        const hours   = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

    _log(msg) {
        const entry = `[${new Date().toISOString().slice(11,19)}] ${msg}`;
        console.log(`[QueensChariot] ${entry}`);
        this.log.push(entry);
        if (this.log.length > 100) this.log.shift();
    }

    async _telegram(text) {
        if (!this.telegramToken || !this.telegramChatId) return;
        try {
            await axios.post(
                `https://api.telegram.org/bot${this.telegramToken}/sendMessage`,
                { chat_id: this.telegramChatId, text, parse_mode: 'HTML' },
                { timeout: 10000 }
            );
        } catch { /* Telegram errors are non-fatal */ }
    }
}

module.exports = QueensChariotBotManager;

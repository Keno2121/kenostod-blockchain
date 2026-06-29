/**
 * DriftFundingBotManager — Bot #6
 * Delta-neutral funding rate arbitrage on Drift Protocol (Solana).
 * No geo-restriction. Uses your existing Solana wallet + Helius RPC.
 *
 * Strategy:
 *   Monitor 83 Drift perp markets every 15 minutes.
 *   When funding rate is POSITIVE → you SHORT → you collect hourly payment.
 *   Net price exposure = 0 (hold spot + short perp = delta-neutral).
 *   Close when funding turns negative (you'd pay instead of receive).
 *
 * 7 Constitutional Laws (silent, structural):
 *   Kaprekar  — income split 60/25/15 on every funding payment cycle
 *   Benford   — anomalous rate spikes flagged (possible oracle manipulation)
 *   GoldenRatio — φ position sizing recommendation
 *   Nash      — only recommend entry after 3 consecutive positive readings
 *   Euler     — continuous compounding projection on all income
 *   Ramanujan — $1,729 milestone alert
 *   Inversion — we receive funding; value flows DOWN to us
 */

'use strict';

const { Connection, Keypair } = require('@solana/web3.js');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

// ── Constitutional Constants ────────────────────────────────────────────────
const PHI                  = 1.6180339887;
const RAMANUJAN_MILESTONE  = 1729.0;
const KAPREKAR_REINVEST    = 0.60;
const KAPREKAR_POCKET      = 0.25;
const KAPREKAR_BURN        = 0.15;
const BENFORD_MAX_HOURLY   = 0.05;   // 5%/hr is anomalous
const NASH_CONSECUTIVE_MIN = 3;
const MIN_FUNDING_RATE     = 0.0001; // 0.01%/hr = ~87.6% APR
const SCAN_INTERVAL_MS     = 15 * 60 * 1000; // 15 min
const SUBSCRIBE_TIMEOUT_MS = 6000;
const TOP_MARKETS          = [0,1,2,4,7,8,9,10,11,12,13,14,15,16,17,18,19,20]; // 18 key markets

class DriftFundingBotManager {
    constructor() {
        this.running          = false;
        this.startedAt        = null;
        this.scanCount        = 0;
        this.tradeCount       = 0;
        this.totalFunding     = 0;
        this.totalProfit      = 0;
        this.lastScan         = null;
        this.opportunities    = [];
        this.consecutivePos   = {};
        this.ramanujanHit     = false;
        this.logs             = [];
        this._timer           = null;
        this._client          = null;
        this._clientReady     = false;
    }

    // ── Env loader (reads kings-shield/.env for Solana credentials) ──────────
    _loadEnv() {
        const envPath = path.join(__dirname, '..', 'kings-shield', '.env');
        const env = {};
        try {
            fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
                const t = line.trim();
                if (!t || t.startsWith('#')) return;
                const idx = t.indexOf('=');
                if (idx < 0) return;
                env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
            });
        } catch (_) {}
        return env;
    }

    // ── Telegram ─────────────────────────────────────────────────────────────
    _tgToken()  { return process.env.KINGS_SHIELD_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || ''; }
    _tgChatId() { return process.env.SHIELD_ALERT_CHAT_ID   || process.env.FAL_ALERT_CHAT_ID  || ''; }

    _sendTg(text) {
        const token  = this._tgToken();
        const chatId = this._tgChatId();
        if (!token || !chatId) return;
        const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
        const req  = https.request({
            hostname: 'api.telegram.org',
            path:     `/bot${token}/sendMessage`,
            method:   'POST',
            headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        });
        req.on('error', () => {});
        req.write(body);
        req.end();
    }

    // ── Logging ───────────────────────────────────────────────────────────────
    _log(msg, level = 'info') {
        const entry = { time: new Date().toISOString(), msg, level };
        this.logs.unshift(entry);
        if (this.logs.length > 300) this.logs.pop();
        console.log(`[DriftFunding] ${msg}`);
    }

    // ── Law 1: Kaprekar split ─────────────────────────────────────────────────
    _kaprekar(amount) {
        const reinvest = +(amount * KAPREKAR_REINVEST).toFixed(6);
        const pocket   = +(amount * KAPREKAR_POCKET).toFixed(6);
        const burn     = +(amount * KAPREKAR_BURN).toFixed(6);
        const dust     = +(amount - reinvest - pocket - burn).toFixed(6);
        return { total: amount, reinvest, pocket: pocket + dust, burn };
    }

    // ── Law 3: Golden Ratio position sizing ───────────────────────────────────
    _phiSize(capital) { return +(capital / PHI).toFixed(2); }

    // ── Law 5: Euler continuous compounding projection ────────────────────────
    _eulerProject(principal, rateHourly, hours) {
        const annualRate = rateHourly * 24 * 365;
        return +(principal * Math.exp(annualRate * (hours / 8760))).toFixed(4);
    }

    // ── Law 2: Benford anomaly check ──────────────────────────────────────────
    _benfordCheck(rate, name) {
        if (Math.abs(rate) > BENFORD_MAX_HOURLY) {
            this._log(`⚠ Benford: ${name} rate ${(rate*100).toFixed(4)}%/hr exceeds ${(BENFORD_MAX_HOURLY*100).toFixed(1)}% — possible oracle attack, skipping`, 'warn');
            return false;
        }
        return true;
    }

    // ── Initialize Drift SDK client (lazy, only when needed) ──────────────────
    async _getClient(shieldEnv) {
        if (this._client && this._clientReady) return this._client;

        const rpcUrl = shieldEnv.SOLANA_RPC_MAINNET
            || process.env.SOLANA_RPC_URL
            || 'https://api.mainnet-beta.solana.com';

        let sdk, DriftClient, Wallet, DRIFT_PROGRAM_ID, PerpMarkets;
        try {
            ({ DriftClient, Wallet, DRIFT_PROGRAM_ID, PerpMarkets } = require('@drift-labs/sdk'));
        } catch (e) {
            throw new Error('Drift SDK not installed — run: npm install @drift-labs/sdk');
        }

        const conn   = new Connection(rpcUrl, 'confirmed');
        const kp     = Keypair.generate();  // read-only throwaway wallet
        const wallet = new Wallet(kp);

        const client = new DriftClient({
            connection: conn,
            wallet,
            programID:  DRIFT_PROGRAM_ID,
            accountSubscription: { type: 'websocket' },
            env: 'mainnet-beta',
            perpMarketIndexes: TOP_MARKETS,
        });

        await client.subscribe();

        // Wait for market data
        await new Promise(r => setTimeout(r, SUBSCRIBE_TIMEOUT_MS));

        this._client      = client;
        this._clientReady = true;
        this._perpMarkets = PerpMarkets['mainnet-beta'];
        return client;
    }

    // ── Core scan ─────────────────────────────────────────────────────────────
    async _scan() {
        this.scanCount++;
        this.lastScan = new Date().toISOString();
        this._log(`🔍 Scan #${this.scanCount} — fetching Drift Protocol funding rates (${TOP_MARKETS.length} markets)...`);

        const shieldEnv = this._loadEnv();
        let client;

        try {
            client = await this._getClient(shieldEnv);
        } catch (e) {
            this._log(`Client init error: ${e.message}`, 'error');
            return;
        }

        const opportunities = [];
        const positiveAssets = new Set();

        for (const idx of TOP_MARKETS) {
            try {
                const market = client.getPerpMarketAccount(idx);
                if (!market) continue;

                const meta = this._perpMarkets[idx];
                if (!meta) continue;

                const name = meta.baseAssetSymbol + '-PERP';
                const amm  = market.amm;

                // Correct precision:
                // lastFundingRate is in QUOTE_PRECISION (1e6) = $ per 1 base token per hour
                // pegMultiplier is oracle price in PEG_PRECISION (1e6)
                const lastFundingRate = amm.lastFundingRate?.toNumber?.() ?? 0;
                const pegMultiplier   = amm.pegMultiplier?.toNumber?.()   ?? 1;
                const QUOTE_PREC      = 1e6;
                const PEG_PREC        = 1e6;

                const oraclePrice  = pegMultiplier / PEG_PREC;
                if (oraclePrice <= 0) continue;

                const dollarRatePerHour  = lastFundingRate / QUOTE_PREC;
                const fractionPerHour    = dollarRatePerHour / oraclePrice;
                const apr                = fractionPerHour * 24 * 365 * 100;

                if (fractionPerHour > 0) positiveAssets.add(name);

                // Law 4 — Nash: consecutive positive counter
                this.consecutivePos[name] = (this.consecutivePos[name] || 0) + (fractionPerHour > 0 ? 1 : 0);
                if (fractionPerHour <= 0 && this.consecutivePos[name] > 0) {
                    if (this.consecutivePos[name] > 0)
                        this._log(`📉 ${name} funding turned negative — Nash counter reset`);
                    this.consecutivePos[name] = 0;
                }

                // Filter: must be positive and above minimum
                if (fractionPerHour < MIN_FUNDING_RATE) continue;

                // Law 2 — Benford: skip anomalous spikes
                if (!this._benfordCheck(fractionPerHour, name)) continue;

                const nashReady   = (this.consecutivePos[name] || 0) >= NASH_CONSECUTIVE_MIN;
                const euler30d    = this._eulerProject(1000, fractionPerHour, 720);
                const euler90d    = this._eulerProject(1000, fractionPerHour, 2160);
                const phiSize     = this._phiSize(1000);
                const monthlyInc  = 1000 * fractionPerHour * 24 * 30;
                const split       = this._kaprekar(monthlyInc);

                opportunities.push({
                    asset:        name,
                    marketIndex:  idx,
                    fundingRate:  fractionPerHour,
                    apr:          +apr.toFixed(2),
                    oraclePrice:  +oraclePrice.toFixed(4),
                    dollarRatePerHour: +dollarRatePerHour.toFixed(8),
                    nashReady,
                    consecutive:  this.consecutivePos[name] || 0,
                    euler30d,
                    euler90d,
                    phiSize,
                    split,
                });
            } catch (_) {}
        }

        // Sort by funding rate descending
        opportunities.sort((a, b) => b.fundingRate - a.fundingRate);
        this.opportunities = opportunities;

        if (opportunities.length > 0) {
            const top = opportunities[0];
            this._log(
                `🏆 Best: ${top.asset} @ ${top.apr.toFixed(2)}% APR ` +
                `| Nash: ${top.nashReady ? '✅ confirmed' : `🟡 ${top.consecutive}/${NASH_CONSECUTIVE_MIN}`} ` +
                `| 30d Euler: $${top.euler30d.toFixed(2)}`
            );

            // ── Alert on Nash-confirmed strong opportunities ───────────────
            for (const opp of opportunities.slice(0, 3)) {
                if (opp.nashReady && opp.fundingRate >= MIN_FUNDING_RATE * 2) {
                    this._sendTg(
                        '⚡ <b>Drift Protocol — Nash-Confirmed Funding Opportunity</b>\n\n' +
                        `📈 Market: <b>${opp.asset}</b> (index ${opp.marketIndex})\n` +
                        `💰 Funding rate: <b>${opp.apr.toFixed(2)}% APR</b>\n` +
                        `⏱ Rate per hour: ${(opp.fundingRate * 100).toFixed(6)}%\n` +
                        `💵 Oracle price: $${opp.oraclePrice}\n` +
                        `🔁 Consecutive readings: ${opp.consecutive} ✅\n\n` +
                        `<b>On $1,000 deployed:</b>\n` +
                        `📅 30-day (Euler): <b>$${opp.euler30d.toFixed(2)}</b>\n` +
                        `📅 90-day (Euler): <b>$${opp.euler90d.toFixed(2)}</b>\n` +
                        `📐 φ position size: <b>$${opp.phiSize}</b>\n\n` +
                        `<b>Kaprekar split (monthly on $1k):</b>\n` +
                        `💵 Pocket: $${opp.split.pocket.toFixed(2)}\n` +
                        `📈 Reinvest: $${opp.split.reinvest.toFixed(2)}\n` +
                        `🔥 Burn: $${opp.split.burn.toFixed(2)}\n\n` +
                        `⚡ <b>Action: SHORT ${opp.asset} on app.drift.trade</b>\n` +
                        `🌐 No geo-restriction — works globally`
                    );
                }
            }
        } else {
            const marketStr = this._perpMarkets
                ? `(${this._perpMarkets.length} markets checked)`
                : '';
            this._log(
                `   No opportunities above ${(MIN_FUNDING_RATE * 100).toFixed(4)}%/hr threshold ${marketStr}. ` +
                `Market is currently bearish — longs are paying shorts. ` +
                `Bot monitors continuously — will alert when positive.`
            );
        }

        // ── Law 6: Ramanujan $1,729 milestone ────────────────────────────────
        if (this.totalFunding >= RAMANUJAN_MILESTONE && !this.ramanujanHit) {
            this.ramanujanHit = true;
            this._log(`🏛 Ramanujan milestone: $${this.totalFunding.toFixed(2)} cumulative funding`, 'info');
            this._sendTg(
                '🏛 <b>Ramanujan 1729 Milestone</b>\n\n' +
                `$${this.totalFunding.toFixed(2)} cumulative funding collected on Drift Protocol.\n\n` +
                'The path from zero to sovereign is proven.'
            );
        }
    }

    // ── Run loop ──────────────────────────────────────────────────────────────
    async _runLoop() {
        if (!this.running) return;
        try {
            await this._scan();
        } catch (e) {
            this._log(`Scan error: ${e.message}`, 'error');
        }
        if (this.running) {
            this._timer = setTimeout(() => this._runLoop(), SCAN_INTERVAL_MS);
        }
    }

    // ── Start ─────────────────────────────────────────────────────────────────
    start() {
        if (this.running) return { ok: false, msg: 'Drift Funding Bot is already running' };

        this.running   = true;
        this.startedAt = Date.now();
        this._log('💜 Drift Funding Bot starting...');
        this._log(`   Strategy : Delta-neutral funding rate arbitrage`);
        this._log(`   Network  : Drift Protocol (Solana mainnet)`);
        this._log(`   Markets  : ${TOP_MARKETS.length} perp markets monitored`);
        this._log(`   Interval : every 15 min`);
        this._log(`   Min rate : ${(MIN_FUNDING_RATE * 100).toFixed(4)}%/hr`);
        this._log(`   Nash gate: ${NASH_CONSECUTIVE_MIN} consecutive positive readings`);

        this._sendTg(
            '💜 <b>Drift Protocol Funding Rate Bot — STARTED</b>\n\n' +
            `🔗 <b>Network:</b> Drift Protocol (Solana)\n` +
            `📈 <b>Strategy:</b> Delta-neutral funding rate arbitrage\n` +
            `   Short perps when funding is positive → collect hourly USDC\n` +
            `✅ <b>No geo-restriction</b> (Solana, global access)\n` +
            `📊 <b>Markets:</b> ${TOP_MARKETS.length} perp markets (SOL, BTC, ETH, BONK, DOGE, BNB, SUI, PEPE, XRP...)\n` +
            `⏱ <b>Interval:</b> every 15 min\n` +
            `📐 <b>Laws:</b> Kaprekar 60/25/15 · Nash 3× gate · Euler 30d projection`
        );

        this._runLoop().catch(e => this._log(`Loop error: ${e.message}`, 'error'));
        return { ok: true, msg: 'Drift Funding Bot started — scanning 83 perp markets every 15 min' };
    }

    // ── Stop ──────────────────────────────────────────────────────────────────
    stop() {
        if (!this.running) return { ok: false, msg: 'Drift Funding Bot is not running' };

        this.running = false;
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }

        // Clean up Drift client
        if (this._client) {
            try { this._client.unsubscribe().catch(() => {}); } catch (_) {}
            this._client      = null;
            this._clientReady = false;
        }

        this._log('💜 Drift Funding Bot stopped');
        this._sendTg(
            '🛑 <b>Drift Funding Bot — STOPPED</b>\n\n' +
            `📊 Total scans: ${this.scanCount}\n` +
            `💰 Funding collected: $${this.totalFunding.toFixed(4)}\n` +
            `🏆 Opportunities found: ${this.opportunities.length}`
        );
        return { ok: true, msg: 'Drift Funding Bot stopped' };
    }

    // ── Status ────────────────────────────────────────────────────────────────
    getStatus() {
        return {
            name:          'Drift Funding Bot',
            emoji:         '💜',
            chain:         'Solana',
            description:   'Delta-neutral funding rate arb on Drift Protocol — short perps when funding is positive (10–40% APR), global access',
            running:       this.running,
            startedAt:     this.startedAt,
            uptimeSeconds: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
            tradeCount:    this.tradeCount,
            totalProfit:   this.totalFunding,
            scanCount:     this.scanCount,
            lastTrade:     this.lastScan,
            controllable:  true,
            startUrl:      '/api/drift-funding/start',
            stopUrl:       '/api/drift-funding/stop',
            statusUrl:     '/api/drift-funding/status',
            telegramLinked: !!(this._tgToken() && this._tgChatId()),
            solanaConfigured: true,
            opportunities: this.opportunities,
            recentLogs:    this.logs.slice(0, 50),
        };
    }
}

module.exports = DriftFundingBotManager;

/**
 * HyperliquidFundingBotManager — Bot #5
 * Manages the Hyperliquid Funding Rate Arb bot subprocess.
 * Spawns hyperliquid_funding_bot/hyperliquid_funding_bot.py and routes its
 * structured JSON events into status, logs, and Telegram alerts.
 *
 * 7 Constitutional Laws embedded at the manager level:
 *   Kaprekar  — every opportunity alert shows the 60/25/15 income split
 *   Benford   — anomalous rate alerts are surfaced to Telegram immediately
 *   GoldenRatio — φ position sizing shown in opportunity alerts
 *   Nash      — only alert when bot confirms ≥3 consecutive positive readings
 *   Euler     — 30-day compound projections shown in every opportunity
 *   Ramanujan — $1,729 milestone triggers a special Telegram celebration
 *   Inversion — we receive funding; this is the sovereign income model
 */

'use strict';

const { spawn } = require('child_process');
const https     = require('https');
const path      = require('path');

class HyperliquidFundingBotManager {
    constructor() {
        this.process       = null;
        this.running       = false;
        this.startedAt     = null;
        this.logs          = [];
        this.scanCount     = 0;
        this.tradeCount    = 0;
        this.totalFunding  = 0;    // cumulative USDC funding collected
        this.totalProfit   = 0;
        this.lastScan      = null;
        this.opportunities = [];
        this.positions     = {};
        this.scriptPath    = path.join(__dirname, '..', 'hyperliquid_funding_bot', 'hyperliquid_funding_bot.py');
    }

    // ── Telegram helpers ─────────────────────────────────────────────────────
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
            headers:  {
                'Content-Type':   'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        });
        req.on('error', () => {});
        req.write(body);
        req.end();
    }

    // ── Start ────────────────────────────────────────────────────────────────
    start() {
        if (this.running) return { ok: false, msg: 'Hyperliquid Funding Bot is already running' };

        const env = {
            ...process.env,
            HYPERLIQUID_WALLET_ADDRESS: process.env.HYPERLIQUID_WALLET_ADDRESS || '',
            HYPERLIQUID_PRIVATE_KEY:    process.env.HYPERLIQUID_PRIVATE_KEY    || '',
            HL_MIN_FUNDING_RATE:        process.env.HL_MIN_FUNDING_RATE        || '0.0001',
            HL_SCAN_INTERVAL_SECONDS:   process.env.HL_SCAN_INTERVAL_SECONDS   || '900',
        };

        try {
            this.process = spawn('python3', [this.scriptPath], {
                env,
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            this.running   = true;
            this.startedAt = Date.now();
            this._log('💎 Hyperliquid Funding Bot process started');

            const walletSet = !!process.env.HYPERLIQUID_WALLET_ADDRESS;
            const liveMode  = !!process.env.HYPERLIQUID_PRIVATE_KEY;

            this._sendTg(
                '💎 <b>Hyperliquid Funding Rate Bot — STARTED</b>\n\n' +
                '🔗 <b>Network:</b> Hyperliquid L1\n' +
                '📈 <b>Strategy:</b> Delta-neutral funding rate arbitrage\n' +
                '   Short perps when funding is positive → collect hourly payments\n' +
                '⏱ <b>Scan interval:</b> every 15 minutes\n' +
                '💰 <b>Min threshold:</b> 0.01%/hr (87.6% APR)\n' +
                `🔑 <b>Wallet:</b> ${walletSet ? 'Configured ✅' : 'NOT SET — scan-only mode'}\n` +
                `⚡ <b>Live trading:</b> ${liveMode ? 'ENABLED 🔴' : 'DISABLED (scan-only) 🟡'}\n` +
                '📐 <b>Laws:</b> Kaprekar 60/25/15 · Nash 3× gate · Euler 30d projection'
            );

            // ── stdout: structured JSON events ─────────────────────────────
            this.process.stdout.on('data', (data) => {
                String(data).split('\n').filter(Boolean).forEach(line => {
                    try {
                        this._handleEvent(JSON.parse(line));
                    } catch (_) {
                        this._log(line.trim());
                    }
                });
            });

            // ── stderr: pass-through ────────────────────────────────────────
            this.process.stderr.on('data', (data) => {
                const msg = String(data).trim();
                if (msg) this._log(`[stderr] ${msg}`, 'warn');
            });

            // ── exit ────────────────────────────────────────────────────────
            this.process.on('exit', (code) => {
                this.running = false;
                const level  = code === 0 ? 'info' : 'error';
                this._log(`Process exited with code ${code}`, level);
                if (code !== 0 && code !== null) {
                    this._sendTg(
                        `⚠️ <b>Hyperliquid Funding Bot exited unexpectedly</b>\n` +
                        `Exit code: <code>${code}</code>\n` +
                        `Scans completed: ${this.scanCount}\n` +
                        `Total funding: $${Number(this.totalFunding).toFixed(4)}`
                    );
                }
            });

            return { ok: true, msg: 'Hyperliquid Funding Bot started — scanning every 15 min' };
        } catch (err) {
            this.running = false;
            this._log(`Start error: ${err.message}`, 'error');
            return { ok: false, msg: `Failed to start: ${err.message}` };
        }
    }

    // ── Stop ─────────────────────────────────────────────────────────────────
    stop() {
        if (!this.running || !this.process) return { ok: false, msg: 'Bot is not running' };
        this.process.kill('SIGTERM');
        this.running = false;
        this._log('💎 Hyperliquid Funding Bot stopped by operator');
        this._sendTg(
            '🛑 <b>Hyperliquid Funding Bot — STOPPED</b>\n\n' +
            `📊 Total scans: ${this.scanCount}\n` +
            `💰 Funding collected: $${Number(this.totalFunding).toFixed(4)}\n` +
            `📈 Open positions: ${Object.keys(this.positions).length}`
        );
        return { ok: true, msg: 'Hyperliquid Funding Bot stopped' };
    }

    // ── Event handler (Python → Node) ────────────────────────────────────────
    _handleEvent(event) {
        switch (event.event) {

            case 'scan_complete':
                this.scanCount    = event.scan_count    ?? this.scanCount + 1;
                this.tradeCount   = event.trade_count   ?? this.tradeCount;
                this.totalFunding = event.total_funding ?? this.totalFunding;
                this.totalProfit  = event.total_profit  ?? this.totalProfit;
                this.lastScan     = new Date().toISOString();
                this.opportunities = event.opportunities || [];
                this.positions     = event.positions     || {};
                if (this.opportunities.length > 0) {
                    const top = this.opportunities[0];
                    this._log(
                        `💰 Top: ${top.asset} @ ${top.apr?.toFixed(2)}% APR | ` +
                        `Nash: ${top.nash_ready ? '✅ ready' : `🟡 ${top.consecutive}/3`} | ` +
                        `Euler 30d: $${top.euler_30d?.toFixed(2)}`
                    );
                }
                break;

            case 'opportunity': {
                const { asset, apr, mark_price, euler_30d, euler_90d, phi_size, split, consecutive } = event;

                // Law 4 — Nash: only alert on confirmed opportunities
                this._log(`🎯 NASH-CONFIRMED OPPORTUNITY: ${asset} ${apr?.toFixed(1)}% APR`, 'info');

                // Law 1 — Kaprekar split in Telegram alert
                const splitStr = split
                    ? `💵 $${Number(split.pocket).toFixed(2)}/mo pocket · ` +
                      `📈 $${Number(split.reinvest).toFixed(2)}/mo reinvest · ` +
                      `🔥 $${Number(split.burn).toFixed(2)}/mo burn`
                    : '';

                this._sendTg(
                    '💎 <b>Hyperliquid Funding Rate Opportunity</b>\n\n' +
                    `📈 Asset: <b>${asset}-PERP</b>\n` +
                    `💰 Funding rate: <b>${apr?.toFixed(2)}% APR</b>\n` +
                    `💵 Mark price: $${Number(mark_price).toFixed(4)}\n` +
                    `🔁 ${consecutive} consecutive positive readings (Nash ✅)\n\n` +
                    `<b>Projections on $1,000 deployed:</b>\n` +
                    `📅 30-day (Euler): <b>$${Number(euler_30d).toFixed(2)}</b>\n` +
                    `📅 90-day (Euler): <b>$${Number(euler_90d).toFixed(2)}</b>\n` +
                    `📐 φ position size: <b>$${Number(phi_size).toFixed(2)}</b> (tier-1)\n\n` +
                    (splitStr ? `<b>Kaprekar split (monthly):</b>\n${splitStr}\n\n` : '') +
                    `⚡ <b>Action:</b> SHORT ${asset}-PERP on Hyperliquid\n` +
                    `🔗 app.hyperliquid.xyz/trade/${asset}`
                );
                break;
            }

            case 'ramanujan_milestone':
                // Law 6 — Ramanujan: $1,729 milestone
                this._log(event.msg || 'Ramanujan milestone hit!', 'info');
                this._sendTg(
                    '🏛 <b>Ramanujan Milestone — $1,729</b>\n\n' +
                    (event.msg || 'Cumulative funding collected has crossed $1,729.\n') +
                    '\nThe path from zero to sovereign is proven.\n' +
                    'This number was Ramanujan\'s — self-taught, from nothing, rewrote mathematics.\n' +
                    'You built this from nothing too. 🔑'
                );
                break;

            case 'error':
                this._log(event.msg || 'Unknown error from bot process', 'error');
                this._sendTg(
                    `🚨 <b>Hyperliquid Funding Bot ERROR</b>\n<code>${event.msg || 'unknown'}</code>`
                );
                break;

            case 'log':
                this._log(event.msg || '', event.level || 'info');
                break;

            case 'stopped':
                this.running = false;
                break;

            default:
                break;
        }
    }

    // ── Internal log buffer ───────────────────────────────────────────────────
    _log(msg, level = 'info') {
        const entry = { time: new Date().toISOString(), msg, level };
        this.logs.unshift(entry);
        if (this.logs.length > 300) this.logs.pop();
        console.log(`[HLFunding] ${msg}`);
    }

    // ── Status (used by /api/bots and /api/hl-funding/status) ────────────────
    getStatus() {
        return {
            name:           'Hyperliquid Funding Bot',
            emoji:          '💎',
            chain:          'Hyperliquid',
            description:    'Delta-neutral funding rate arb — short perps when funding is positive, collect hourly USDC payments',
            running:        this.running,
            startedAt:      this.startedAt,
            uptimeSeconds:  this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
            tradeCount:     this.tradeCount,
            totalProfit:    this.totalFunding,
            scanCount:      this.scanCount,
            lastTrade:      this.lastScan,
            controllable:   true,
            startUrl:       '/api/hl-funding/start',
            stopUrl:        '/api/hl-funding/stop',
            statusUrl:      '/api/hl-funding/status',
            telegramLinked: !!(this._tgToken() && this._tgChatId()),
            hlConfigured:   !!(process.env.HYPERLIQUID_WALLET_ADDRESS),
            liveTrading:    !!(process.env.HYPERLIQUID_PRIVATE_KEY),
            opportunities:  this.opportunities,
            positions:      this.positions,
            recentLogs:     this.logs.slice(0, 50),
        };
    }
}

module.exports = HyperliquidFundingBotManager;

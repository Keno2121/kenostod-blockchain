/**
 * Aegis Arb Bot Manager
 * Node.js manager that spawns aegis_arb_bot/aegis_arb_bot.py as a child process.
 * Captures stdout JSON events, feeds logs to founder dashboard, sends Telegram alerts.
 */

const { spawn } = require('child_process');
const path = require('path');

class AegisArbBotManager {
    constructor() {
        this.process     = null;
        this.running     = false;
        this.startedAt   = null;
        this.logs        = [];
        this.tradeCount  = 0;
        this.totalProfit = 0;
        this.lastTrade   = null;
        this.scanCount   = 0;
        this.scriptPath  = path.join(__dirname, '..', 'aegis_arb_bot', 'aegis_arb_bot.py');
    }

    start() {
        if (this.running) return { ok: false, msg: 'Aegis Arb Bot already running' };

        const env = {
            ...process.env,
            SOLANA_RPC_URL:            process.env.SOLANA_RPC_URL     || 'https://api.mainnet-beta.solana.com',
            SOLANA_WALLET_PRIVATE_KEY: process.env.SOLANA_WALLET_PRIVATE_KEY || '',
            TELEGRAM_BOT_TOKEN:        process.env.TELEGRAM_BOT_TOKEN || '',
            SHIELD_ALERT_CHAT_ID:      process.env.SHIELD_ALERT_CHAT_ID || process.env.FAL_ALERT_CHAT_ID || '',
            SHIELD_TOKEN_MINT:         process.env.SHIELD_TOKEN_MINT || '',
        };

        try {
            this.process = spawn('python3', [this.scriptPath], { env, stdio: ['ignore', 'pipe', 'pipe'] });
            this.running   = true;
            this.startedAt = Date.now();
            this._log('⚔ Aegis Arb Bot process started');

            this.process.stdout.on('data', (data) => {
                String(data).split('\n').filter(Boolean).forEach(line => {
                    try {
                        const event = JSON.parse(line);
                        this._handleEvent(event);
                    } catch (_) {
                        this._log(line.trim());
                    }
                });
            });

            this.process.stderr.on('data', (data) => {
                this._log(`[stderr] ${String(data).trim()}`, 'warn');
            });

            this.process.on('exit', (code) => {
                this.running = false;
                this._log(`Process exited with code ${code}`, code === 0 ? 'info' : 'error');
            });

            return { ok: true, msg: 'Aegis Arb Bot started' };
        } catch (err) {
            this.running = false;
            this._log(`Start error: ${err.message}`, 'error');
            return { ok: false, msg: err.message };
        }
    }

    stop() {
        if (!this.running || !this.process) return { ok: false, msg: 'Not running' };
        this.process.kill('SIGTERM');
        this.running = false;
        this._log('⚔ Aegis Arb Bot stopped');
        return { ok: true, msg: 'Aegis Arb Bot stopped' };
    }

    _handleEvent(event) {
        switch (event.event) {
            case 'trade':
                this.tradeCount  = event.trade_count  || this.tradeCount + 1;
                this.totalProfit = event.total_profit || this.totalProfit;
                this.lastTrade   = new Date().toISOString();
                this._log(`✅ Trade #${this.tradeCount} — $${Number(event.net_usd).toFixed(2)} net [${event.simulated ? 'SIM' : 'LIVE'}]`);
                break;
            case 'scan_complete':
                this.scanCount   = event.scan_count || this.scanCount + 1;
                this.tradeCount  = event.trade_count  || this.tradeCount;
                this.totalProfit = event.total_profit || this.totalProfit;
                break;
            case 'log':
                this._log(event.msg, event.level || 'info');
                break;
            case 'stopped':
                this.running = false;
                break;
            default:
                break;
        }
    }

    _log(msg, level = 'info') {
        const entry = { time: new Date().toISOString(), msg, level };
        this.logs.unshift(entry);
        if (this.logs.length > 200) this.logs.pop();
        console.log(`[AegisArbBot] ${msg}`);
    }

    getStatus() {
        return {
            name:        'Aegis Arb Bot',
            chain:       'Solana',
            description: 'Live DEX arb — SOL/USDC & SHIELD/SOL via Jupiter (Meteora, Orca, Raydium)',
            running:     this.running,
            startedAt:   this.startedAt,
            uptimeSeconds: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
            tradeCount:  this.tradeCount,
            totalProfit: this.totalProfit,
            scanCount:   this.scanCount,
            lastTrade:   this.lastTrade,
            telegramLinked: !!(process.env.TELEGRAM_BOT_TOKEN && (process.env.SHIELD_ALERT_CHAT_ID || process.env.FAL_ALERT_CHAT_ID)),
            solanaConfigured: !!(process.env.SOLANA_RPC_URL && process.env.SOLANA_WALLET_PRIVATE_KEY),
            recentLogs:  this.logs.slice(0, 30),
        };
    }
}

module.exports = AegisArbBotManager;

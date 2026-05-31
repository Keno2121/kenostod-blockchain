/**
 * Constitution Flash Bot Manager
 * Node.js manager that spawns constitution_flash_bot/constitution_flash_bot.py.
 * Kaprekar borrow amounts: 0.6174 | 1.234 | 6.174 SOL
 * Routes: SOL→USDC→SOL | SOL→USDT→USDC→SOL | SOL→SHIELD→SOL
 */

const { spawn } = require('child_process');
const path = require('path');

class ConstitutionFlashBotManager {
    constructor() {
        this.process      = null;
        this.running      = false;
        this.startedAt    = null;
        this.logs         = [];
        this.tradeCount   = 0;
        this.skipCount    = 0;
        this.totalProfit  = 0;
        this.lastTrade    = null;
        this.scanCount    = 0;
        this.currentBorrow = 0.6174;
        this.scriptPath   = path.join(__dirname, '..', 'constitution_flash_bot', 'constitution_flash_bot.py');
    }

    start() {
        if (this.running) return { ok: false, msg: 'Constitution Flash Bot already running' };

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
            this._log('⚔ Constitution Flash Bot process started');

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

            return { ok: true, msg: 'Constitution Flash Bot started' };
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
        this._log('⚔ Constitution Flash Bot stopped');
        return { ok: true, msg: 'Constitution Flash Bot stopped' };
    }

    _handleEvent(event) {
        switch (event.event) {
            case 'trade':
                this.tradeCount    = event.trade_count   || this.tradeCount + 1;
                this.totalProfit   = event.total_profit  || this.totalProfit;
                this.currentBorrow = event.borrow_sol    || this.currentBorrow;
                this.lastTrade     = new Date().toISOString();
                this._log(`✅ Flash trade #${this.tradeCount} — $${Number(event.net_usd).toFixed(2)} [${event.simulated ? 'SIM' : 'LIVE'}]`);
                break;
            case 'scan_complete':
                this.scanCount    = event.scan_count   || this.scanCount + 1;
                this.skipCount    = event.skip_count   || this.skipCount;
                this.tradeCount   = event.trade_count  || this.tradeCount;
                this.totalProfit  = event.total_profit || this.totalProfit;
                this.currentBorrow = event.borrow_sol  || this.currentBorrow;
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
        console.log(`[ConstitutionFlashBot] ${msg}`);
    }

    getStatus() {
        return {
            name:        'Constitution Flash Bot',
            chain:       'Solana',
            description: 'Flash loan arb — 0.6174/1.234/6.174 SOL (Kaprekar) via triangular routes',
            running:     this.running,
            startedAt:   this.startedAt,
            uptimeSeconds: this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
            tradeCount:  this.tradeCount,
            skipCount:   this.skipCount,
            totalProfit: this.totalProfit,
            scanCount:   this.scanCount,
            lastTrade:   this.lastTrade,
            currentBorrow: this.currentBorrow,
            telegramLinked: !!(process.env.TELEGRAM_BOT_TOKEN && (process.env.SHIELD_ALERT_CHAT_ID || process.env.FAL_ALERT_CHAT_ID)),
            solanaConfigured: !!(process.env.SOLANA_RPC_URL && process.env.SOLANA_WALLET_PRIVATE_KEY),
            recentLogs:  this.logs.slice(0, 30),
        };
    }
}

module.exports = ConstitutionFlashBotManager;

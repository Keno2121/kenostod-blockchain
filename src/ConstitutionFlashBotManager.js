/**
 * Constitution Flash Bot Manager
 * Node.js manager that spawns constitution_flash_bot/constitution_flash_bot.py.
 * Kaprekar borrow amounts: 0.6174 | 1.234 | 6.174 SOL
 * Routes: SOL→USDC→SOL | SOL→USDT→USDC→SOL | SOL→SHIELD→SOL
 *
 * Telegram setup:
 *   KINGS_SHIELD_BOT_TOKEN  — token for a dedicated Kings Shield bot (BotFather)
 *                             Falls back to TELEGRAM_BOT_TOKEN if not set.
 *   SHIELD_ALERT_CHAT_ID    — your personal Telegram chat ID (get it from @userinfobot)
 */

const { spawn } = require('child_process');
const https     = require('https');
const path      = require('path');
const fs        = require('fs');

class ConstitutionFlashBotManager {
    constructor() {
        this.process       = null;
        this.running       = false;
        this.startedAt     = null;
        this.logs          = [];
        this.tradeCount    = 0;
        this.skipCount     = 0;
        this.totalProfit   = 0;
        this.lastTrade     = null;
        this.scanCount     = 0;
        this.currentBorrow = 0.6174;
        this.scriptPath    = path.join(__dirname, '..', 'constitution_flash_bot', 'constitution_flash_bot.py');
    }

    // ─── Load kings-shield/.env for bot credentials ──────────────────────────
    _loadShieldEnv() {
        try {
            const envPath = path.join(__dirname, '..', 'kings-shield', '.env');
            const lines   = fs.readFileSync(envPath, 'utf8').split('\n');
            const env     = {};
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const idx = trimmed.indexOf('=');
                if (idx < 0) continue;
                env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
            }
            return env;
        } catch (_) {
            return {};
        }
    }

    // ─── Telegram ────────────────────────────────────────────────────────────
    _tgToken()  { return process.env.KINGS_SHIELD_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || ''; }
    _tgChatId() { return process.env.SHIELD_ALERT_CHAT_ID   || process.env.FAL_ALERT_CHAT_ID  || ''; }

    _sendTelegramAlert(text) {
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

    // ─── Lifecycle ───────────────────────────────────────────────────────────
    start() {
        if (this.running) return { ok: false, msg: 'Constitution Flash Bot already running' };

        const shield = this._loadShieldEnv();
        const env = {
            ...process.env,
            SOLANA_RPC_URL:            process.env.SOLANA_RPC_URL            || shield.SOLANA_RPC_MAINNET || 'https://api.mainnet-beta.solana.com',
            SOLANA_WALLET_PRIVATE_KEY: process.env.SOLANA_WALLET_PRIVATE_KEY || shield.SHIELD_BOT_PRIVATE_KEY || '',
            SHIELD_TOKEN_MINT:         process.env.SHIELD_TOKEN_MINT         || shield.SHIELD_TOKEN_MINT  || '',
            TELEGRAM_BOT_TOKEN:        this._tgToken(),
            SHIELD_ALERT_CHAT_ID:      this._tgChatId(),
            KINGS_SHIELD_BOT_TOKEN:    process.env.KINGS_SHIELD_BOT_TOKEN    || '',
        };

        try {
            this.process = spawn('python3', [this.scriptPath], { env, stdio: ['ignore', 'pipe', 'pipe'] });
            this.running   = true;
            this.startedAt = Date.now();
            this._log('📜 Constitution Flash Bot process started');

            this._sendTelegramAlert(
                '📜 <b>Constitution Flash Bot — STARTED</b>\n' +
                '🔗 Chain: Solana\n' +
                '💰 Borrow amounts: 0.6174 | 1.234 | 6.174 SOL (Kaprekar)\n' +
                '📡 Routes: SOL→USDC→SOL | SOL→USDT→USDC→SOL | SOL→SHIELD→SOL\n' +
                '⏱ Scan cycle: every 30s'
            );

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
                const lvl = code === 0 ? 'info' : 'error';
                this._log(`Process exited with code ${code}`, lvl);
                if (code !== 0) {
                    this._sendTelegramAlert(`⚠️ <b>Constitution Flash Bot exited</b> — code ${code}\nRestart from the Bots dashboard.`);
                }
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
        this._log('📜 Constitution Flash Bot stopped');
        this._sendTelegramAlert(
            '🛑 <b>Constitution Flash Bot — STOPPED</b>\n' +
            `📊 Trades: ${this.tradeCount} | Skipped: ${this.skipCount} | Total profit: $${Number(this.totalProfit).toFixed(2)}`
        );
        return { ok: true, msg: 'Constitution Flash Bot stopped' };
    }

    // ─── Event handling ───────────────────────────────────────────────────────
    _handleEvent(event) {
        switch (event.event) {
            case 'trade': {
                this.tradeCount    = event.trade_count   != null ? event.trade_count   : this.tradeCount + 1;
                this.totalProfit   = event.total_profit  != null ? event.total_profit  : this.totalProfit;
                this.currentBorrow = event.borrow_sol    || this.currentBorrow;
                this.lastTrade     = new Date().toISOString();
                const net    = Number(event.net_usd   || 0).toFixed(2);
                const gross  = Number(event.gross_usd || 0).toFixed(2);
                const borrow = Number(this.currentBorrow).toFixed(4);
                const route  = event.route  || 'SOL→USDC→SOL';
                const mode   = event.simulated ? '🧪 SIMULATED' : '✅ LIVE';
                this._log(`✅ Flash trade #${this.tradeCount} — $${net} net [${event.simulated ? 'SIM' : 'LIVE'}]`);
                this._sendTelegramAlert(
                    `📜 <b>Constitution Flash Trade #${this.tradeCount}</b> ${mode}\n` +
                    `📈 Route: <code>${route}</code>\n` +
                    `🏦 Borrow: <b>${borrow} SOL</b> (Kaprekar)\n` +
                    `💵 Gross: <b>$${gross}</b> → Net: <b>$${net}</b>\n` +
                    `📊 Total profit: <b>$${Number(this.totalProfit).toFixed(2)}</b> | Scans: ${this.scanCount}`
                );
                break;
            }
            case 'scan_complete':
                this.scanCount     = event.scan_count    != null ? event.scan_count    : this.scanCount + 1;
                this.skipCount     = event.skip_count    != null ? event.skip_count    : this.skipCount;
                this.tradeCount    = event.trade_count   != null ? event.trade_count   : this.tradeCount;
                this.totalProfit   = event.total_profit  != null ? event.total_profit  : this.totalProfit;
                this.currentBorrow = event.borrow_sol    || this.currentBorrow;
                break;
            case 'error': {
                const errMsg = event.msg || 'Unknown error';
                this._log(errMsg, 'error');
                this._sendTelegramAlert(`🚨 <b>Constitution Flash Bot ERROR</b>\n<code>${errMsg}</code>`);
                break;
            }
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
            name:             'Constitution Flash Bot',
            chain:            'Solana',
            description:      'Flash loan arb — 0.6174/1.234/6.174 SOL (Kaprekar) via triangular routes',
            running:          this.running,
            startedAt:        this.startedAt,
            uptimeSeconds:    this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
            tradeCount:       this.tradeCount,
            skipCount:        this.skipCount,
            totalProfit:      this.totalProfit,
            scanCount:        this.scanCount,
            lastTrade:        this.lastTrade,
            currentBorrow:    this.currentBorrow,
            telegramLinked:   !!(this._tgToken() && this._tgChatId()),
            solanaConfigured: !!(process.env.SOLANA_WALLET_PRIVATE_KEY || this._loadShieldEnv().SHIELD_BOT_PRIVATE_KEY),
            recentLogs:       this.logs.slice(0, 30),
        };
    }
}

module.exports = ConstitutionFlashBotManager;

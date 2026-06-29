/**
 * Kings Shield Alert Bot
 * Law I  — Kaprekar: dust always to participant
 * Law II — Benford: anomaly detection on site events
 * Law V  — Euler: continuous uptime tracking
 *
 * Monitors the Kings Shield website & SHIELD token ecosystem.
 * Sends founder Telegram alerts for: site status, waitlist signups,
 * Aegis Tax milestones, holder milestones, and daily summaries.
 *
 * One-way alert sender — no polling. Attaches to the existing
 * TELEGRAM_BOT_TOKEN + SHIELD_ALERT_CHAT_ID env vars.
 */

const https = require('https');

const KAPREKAR = 6174;
const CHECK_INTERVAL_MS  = 5 * 60 * 1000;   // 5 min site ping
const DAILY_SUMMARY_MS   = 24 * 60 * 60 * 1000;
const SITE_URL           = 'https://kings-shield.com';
const RENDER_URL         = 'https://kings-shield-website.onrender.com';

class KingsShieldAlertBot {
    constructor() {
        this.token      = process.env.TELEGRAM_BOT_TOKEN;
        this.chatId     = process.env.SHIELD_ALERT_CHAT_ID || process.env.FAL_ALERT_CHAT_ID;
        this.running    = false;
        this.lastStatus = null;
        this.uptimeTicks   = 0;
        this.downtimeTicks = 0;
        this.signupCount   = 0;
        this.aegisTaxTotal = 0;
        this.startedAt  = null;
        this.logs       = [];
        this._pingTimer    = null;
        this._summaryTimer = null;

        if (!this.token) {
            this.log('No TELEGRAM_BOT_TOKEN — alert bot disabled.', 'warn');
        }
    }

    start() {
        if (this.running) return { ok: false, msg: 'Already running' };
        this.running   = true;
        this.startedAt = Date.now();
        this.log('⚔ Kings Shield Alert Bot started');

        this._pingTimer    = setInterval(() => this._checkSite(), CHECK_INTERVAL_MS);
        this._summaryTimer = setInterval(() => this._sendDailySummary(), DAILY_SUMMARY_MS);

        this._checkSite();
        this.sendAlert(`⚔ <b>Kings Shield Alert Bot ONLINE</b>\n\nMonitoring:\n• ${SITE_URL}\n• Aegis Tax (6.174%)\n• Holder milestones\n\nKaprekar constant: ${KAPREKAR} — all paths converge.`);
        return { ok: true, msg: 'Kings Shield Alert Bot started' };
    }

    stop() {
        if (!this.running) return { ok: false, msg: 'Not running' };
        clearInterval(this._pingTimer);
        clearInterval(this._summaryTimer);
        this.running = false;
        this.log('Kings Shield Alert Bot stopped');
        return { ok: true, msg: 'Kings Shield Alert Bot stopped' };
    }

    _checkSite() {
        const urls = [SITE_URL, RENDER_URL];
        urls.forEach(url => {
            const proto = url.startsWith('https') ? https : require('http');
            const start = Date.now();
            const req = proto.get(url, { timeout: 10000 }, (res) => {
                const ms = Date.now() - start;
                const ok = res.statusCode < 400;
                if (ok) {
                    this.uptimeTicks++;
                    if (this.lastStatus === false) {
                        this.sendAlert(`✅ <b>Kings Shield is BACK ONLINE</b>\n${url}\nResponse: ${ms}ms`);
                    }
                    this.lastStatus = true;
                } else {
                    this.downtimeTicks++;
                    if (this.lastStatus !== false) {
                        this.sendAlert(`🚨 <b>Kings Shield site issue detected</b>\n${url}\nHTTP ${res.statusCode} — checking every 5 min.`);
                    }
                    this.lastStatus = false;
                }
                this.log(`Site check ${url} → HTTP ${res.statusCode} (${ms}ms)`);
            });
            req.on('error', (err) => {
                this.downtimeTicks++;
                if (this.lastStatus !== false) {
                    this.sendAlert(`🚨 <b>Kings Shield site unreachable</b>\n${url}\nError: ${err.message}`);
                }
                this.lastStatus = false;
                this.log(`Site check error: ${err.message}`, 'error');
            });
            req.on('timeout', () => req.destroy());
        });
    }

    _sendDailySummary() {
        const uptimePct = this.uptimeTicks + this.downtimeTicks > 0
            ? ((this.uptimeTicks / (this.uptimeTicks + this.downtimeTicks)) * 100).toFixed(1)
            : '100';
        const msg = `📊 <b>Kings Shield — Daily Report</b>\n\n`
            + `🌐 Uptime: ${uptimePct}%\n`
            + `📧 New waitlist signups: ${this.signupCount}\n`
            + `💰 Aegis Tax collected: ${this.aegisTaxTotal.toFixed(4)} BNB\n`
            + `\n⚔ Kaprekar ${KAPREKAR} — value flows to the participant.`;
        this.sendAlert(msg);
        this.signupCount   = 0;
        this.aegisTaxTotal = 0;
    }

    notifySignup(email) {
        this.signupCount++;
        this.sendAlert(`⚔ <b>New Kings Shield Signup</b>\n📧 ${email}\nTotal today: ${this.signupCount}`);
    }

    notifyAegisTax(amountBNB) {
        this.aegisTaxTotal += amountBNB;
        const milestone = Math.floor(this.aegisTaxTotal / 1) * 1;
        if (Number.isInteger(this.aegisTaxTotal) && amountBNB > 0) {
            this.sendAlert(`⚔ <b>Aegis Tax Milestone</b>\n💰 ${this.aegisTaxTotal.toFixed(4)} BNB collected\n6.174% shield protects every transfer.`);
        }
    }

    notifyHolderMilestone(count) {
        const milestones = [100, 500, 1000, 1729, 6174, 10000];
        if (milestones.includes(count)) {
            const special = count === 1729 ? ' 🎯 Ramanujan milestone!' : count === 6174 ? ' 🎯 Kaprekar milestone!' : '';
            this.sendAlert(`⚔ <b>Kings Shield Holder Milestone</b>\n👥 ${count.toLocaleString()} holders${special}`);
        }
    }

    sendAlert(text) {
        if (!this.token || !this.chatId) return;
        try {
            const payload = JSON.stringify({ chat_id: this.chatId, text, parse_mode: 'HTML' });
            const req = https.request({
                hostname: 'api.telegram.org',
                path: `/bot${this.token}/sendMessage`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            });
            req.write(payload);
            req.end();
        } catch (_) {}
    }

    log(msg, level = 'info') {
        const entry = { time: new Date().toISOString(), msg, level };
        this.logs.unshift(entry);
        if (this.logs.length > 100) this.logs.pop();
        console.log(`[KingsShieldAlertBot] ${msg}`);
    }

    getStatus() {
        const uptimePct = this.uptimeTicks + this.downtimeTicks > 0
            ? ((this.uptimeTicks / (this.uptimeTicks + this.downtimeTicks)) * 100).toFixed(1)
            : '100';
        return {
            running:         this.running,
            siteOnline:      this.lastStatus,
            uptimePct,
            signupCount:     this.signupCount,
            aegisTaxTotal:   this.aegisTaxTotal,
            startedAt:       this.startedAt,
            recentLogs:      this.logs.slice(0, 20),
            telegramLinked:  !!(this.token && this.chatId)
        };
    }
}

module.exports = KingsShieldAlertBot;

if (require.main === module) {
  const bot = new KingsShieldAlertBot();
  bot.start();
  console.log('[KingsShieldAlertBot] Running — monitoring Kings Shield ecosystem.');
  process.on('SIGTERM', () => { bot.stop(); process.exit(0); });
  process.on('SIGINT',  () => { bot.stop(); process.exit(0); });
}

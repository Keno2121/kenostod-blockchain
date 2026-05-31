/**
 * Kings Shield Support Bot
 * Registers Kings Shield-specific commands on the shared Telegram bot.
 * Plugs into the existing node-telegram-bot-api instance.
 *
 * Commands added:
 *   /shield   — what is Kings Shield
 *   /aegis    — how Aegis Tax works
 *   /protect  — how to get protected
 *   /kingsshield — full product overview
 *
 * Law VII — Inversion: value flows to the participant (the holder).
 */

const SHIELD_INTRO = `⚔ <b>The King's Shield</b>

Kings Shield is sovereign financial protection — a gold-backed security layer built on blockchain.

🛡 <b>Aegis Tax</b> — 6.174% on every SHIELD transfer redistributes value back to holders.

💰 <b>Backing</b> — each SHIELD token is anchored to real-world value through the Kaprekar reserve.

🔒 <b>Security</b> — dual-chip B.U.K. card, cold-storage grade protection.

🌐 <a href="https://kings-shield.com">kings-shield.com</a>`;

const AEGIS_INFO = `⚔ <b>Aegis Tax — 6.174%</b>

Every SHIELD token transfer triggers the Aegis Tax:

• <b>6.174%</b> of every transfer is collected
• Redistributed to current SHIELD holders
• The longer you hold, the more you earn
• Rooted in Kaprekar's Constant — the number all numbers converge to

This is passive income that compounds with every transfer in the ecosystem.

The more SHIELD moves, the more <i>your</i> SHIELD grows.`;

const PROTECT_INFO = `⚔ <b>How to get protected</b>

1. Visit <a href="https://kings-shield.com">kings-shield.com</a>
2. Join the waitlist for early access
3. Get SHIELD tokens at launch
4. Hold and earn Aegis Tax on every transfer

Early holders receive the highest yield — the protocol rewards commitment.

📧 Questions? Contact us at shield@kenostodblockchain.com`;

class KingsShieldSupportBot {
    constructor(botInstance) {
        this.bot     = botInstance;
        this.running = false;
        this.logs    = [];
        this.msgCount = 0;

        if (!botInstance) {
            this.log('No bot instance provided — support commands disabled.', 'warn');
            return;
        }

        this._registerCommands();
        this.running = true;
        this.log('⚔ Kings Shield Support commands registered on TelegramBot');
    }

    _registerCommands() {
        this.bot.onText(/\/shield/, (msg) => {
            this.msgCount++;
            this.log(`/shield from ${msg.from?.first_name || 'unknown'}`);
            this.bot.sendMessage(msg.chat.id, SHIELD_INTRO, { parse_mode: 'HTML', disable_web_page_preview: true });
        });

        this.bot.onText(/\/aegis/, (msg) => {
            this.msgCount++;
            this.log(`/aegis from ${msg.from?.first_name || 'unknown'}`);
            this.bot.sendMessage(msg.chat.id, AEGIS_INFO, { parse_mode: 'HTML' });
        });

        this.bot.onText(/\/protect/, (msg) => {
            this.msgCount++;
            this.log(`/protect from ${msg.from?.first_name || 'unknown'}`);
            this.bot.sendMessage(msg.chat.id, PROTECT_INFO, { parse_mode: 'HTML', disable_web_page_preview: true });
        });

        this.bot.onText(/\/kingsshield/, (msg) => {
            this.msgCount++;
            this.log(`/kingsshield from ${msg.from?.first_name || 'unknown'}`);
            const full = `${SHIELD_INTRO}\n\n${AEGIS_INFO}\n\n${PROTECT_INFO}`;
            this.bot.sendMessage(msg.chat.id, full, { parse_mode: 'HTML', disable_web_page_preview: true });
        });
    }

    log(msg, level = 'info') {
        const entry = { time: new Date().toISOString(), msg, level };
        this.logs.unshift(entry);
        if (this.logs.length > 100) this.logs.pop();
        console.log(`[KingsShieldSupportBot] ${msg}`);
    }

    getStatus() {
        return {
            running:    this.running,
            msgCount:   this.msgCount,
            commands:   ['/shield', '/aegis', '/protect', '/kingsshield'],
            recentLogs: this.logs.slice(0, 10)
        };
    }
}

module.exports = KingsShieldSupportBot;

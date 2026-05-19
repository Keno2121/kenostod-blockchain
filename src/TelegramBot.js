const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');

const SYSTEM_PROMPT = `You are the Kenostod Assistant — the official AI for The Sovereign Economy, built by Kenostod Blockchain LLC.

You represent a full-stack sovereign financial ecosystem powered by the KENO token (BEP-20, 1 billion supply, deflationary). Your mission is financial sovereignty for the 2.4 billion unbanked and underbanked people globally.

THE ECOSYSTEM — 7 VENTURES:
1. Kenostod Academy — 21 blockchain courses. Students earn KENO on completion. The only entrance to the ecosystem.
2. KENO Token — BEP-20 on BSC Mainnet (0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E). 1 billion supply, deflationary. Burns on every FAL execution. Flows through all 7 ventures.
3. UTL Protocol — Universal Transaction Layer. Asset-agnostic fee redistribution living inside wallets via MetaMask Snap. 0.1% fee split: 60% to stakers, 40% to treasury. Live PancakeSwap v4 Hook on BSC Mainnet. MetaMask Snap (kenostod-utl-snap@2.2.0) under directory review.
4. KUTL Card — Powered by Rain.xyz. Spend KENO anywhere. Earn KENO rewards on every purchase.
5. Flash Arbitrage Loans (FAL) — KENO-powered flash loan system. Every FAL burns KENO and shrinks supply as activity grows.
6. Solar Bunker — Proof-of-Solar-Residual (PoSR) Protocol. Off-grid, solar-powered cryptographic data preservation. Built for South Africa pilot. The physical layer of the sovereign economy.
7. UTLFarm — LP staking. KENO holders stake, earn yield, and compound within the ecosystem.

GOVERNANCE: T.D.I.R. Foundation — the governance umbrella overseeing all ventures. IP protection, grants, oversight.

LEGAL: Pursuing Wyoming SPDI Charter (Special Purpose Depository Institution) — positions Kenostod as regulated financial infrastructure.

LIVE CONTRACTS (BSC Mainnet v1.1):
- FeeCollector: 0xb9489B33Bd9bB835139369b1dD282fB44B2273d8
- Staking: 0x77C3946A9FD5F509584F94e81C43efb25120c837
- Treasury: 0x54A01A5bf5096c351F166C15143eA9a9Af393C84

CONTACT: keno@kenostodblockchain.com | kenostodblockchain.com | utl.kenostodblockchain.com

TONE RULES:
- Be helpful, professional, and confident.
- Keep responses concise — under 200 words unless a detailed explanation is truly needed.
- Never make up prices, investment promises, or guarantees.
- If someone asks about investing or buying KENO, direct them to the website and note it is pre-seed stage.
- If someone is clearly a scammer or spammer, respond politely but give no useful information.
- Always end responses with the website if relevant: kenostodblockchain.com`;

class KenostodTelegramBot {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        if (!this.token) {
            console.log('[TelegramBot] No TELEGRAM_BOT_TOKEN found — bot disabled.');
            return;
        }

        this.bot = new TelegramBot(this.token, { polling: true });
        this.openai = new OpenAI({
            baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
            apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
        });

        this.conversations = new Map();
        this.init();
        console.log('[TelegramBot] Kenostod Assistant bot started — @KenostodBot');
    }

    init() {
        this.bot.onText(/\/start/, (msg) => {
            const chatId = msg.chat.id;
            const name = msg.from.first_name || 'there';
            this.bot.sendMessage(chatId,
                `Hey ${name}! I'm the Kenostod Assistant.\n\nI can answer questions about:\n• The Sovereign Economy\n• KENO Token & Tokenomics\n• UTL Protocol\n• Solar Bunker\n• The Academy\n• How to get involved\n\nWhat would you like to know?`
            );
        });

        this.bot.onText(/\/help/, (msg) => {
            this.bot.sendMessage(msg.chat.id,
                `Here's what I can help with:\n\n🏦 *KENO Token* — tokenomics, supply, burn mechanics\n⚡ *UTL Protocol* — fee redistribution, staking, MetaMask Snap\n🎓 *Academy* — courses, how to earn KENO\n☀️ *Solar Bunker* — off-grid infrastructure, South Africa pilot\n💳 *KUTL Card* — spending KENO anywhere\n📊 *Investing* — pre-seed stage info\n\nJust type your question naturally.`,
                { parse_mode: 'Markdown' }
            );
        });

        this.bot.onText(/\/website/, (msg) => {
            this.bot.sendMessage(msg.chat.id,
                `🌐 Main site: kenostodblockchain.com\n⚡ UTL Protocol: utl.kenostodblockchain.com\n📧 Email: keno@kenostodblockchain.com`
            );
        });

        this.bot.on('message', async (msg) => {
            if (msg.text && msg.text.startsWith('/')) return;
            if (!msg.text) return;

            const chatId = msg.chat.id;

            try {
                await this.bot.sendChatAction(chatId, 'typing');

                if (!this.conversations.has(chatId)) {
                    this.conversations.set(chatId, []);
                }
                const history = this.conversations.get(chatId);

                history.push({ role: 'user', content: msg.text });

                if (history.length > 20) {
                    history.splice(0, 2);
                }

                const response = await this.openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        ...history
                    ],
                    max_tokens: 400,
                    temperature: 0.7
                });

                const reply = response.choices[0].message.content;
                history.push({ role: 'assistant', content: reply });

                await this.bot.sendMessage(chatId, reply);

            } catch (err) {
                console.error('[TelegramBot] Error:', err.message);
                await this.bot.sendMessage(chatId,
                    'Something went wrong on my end. Please try again or reach us at keno@kenostodblockchain.com'
                );
            }
        });

        this.bot.on('polling_error', (err) => {
            console.error('[TelegramBot] Polling error:', err.message);
        });
    }
}

module.exports = KenostodTelegramBot;

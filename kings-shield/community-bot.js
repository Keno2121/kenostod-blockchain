/**
 * Kings Shield Community Bot
 * ===========================
 * Keeps the Sovereign Economy Telegram group alive and animated.
 *
 * Features:
 *   - Welcomes every new member with a branded message
 *   - Posts a daily KENO presale countdown at 9:00 AM
 *   - Responds to commands: /presale /keno /about /links
 *   - Kaprekar Constant: 6174 embedded in scan interval
 */

const TelegramBot = require('node-telegram-bot-api');

const TOKEN    = process.env.KINGS_SHIELD_BOT_TOKEN;
const CHAT_ID  = process.env.SHIELD_ALERT_CHAT_ID;

if (!TOKEN) {
  console.error('❌  KINGS_SHIELD_BOT_TOKEN not set. Bot cannot start.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── Presale config ────────────────────────────────────────────────────────
const PRESALE_OPEN  = new Date('2026-06-26T00:00:00Z');
const PRESALE_CLOSE = new Date('2026-07-10T00:00:00Z');
const KENO_CONTRACT = '0x48bb049afe50b050b458624dc6233acd51024ab4';
const WEBSITE       = 'https://kenostodblockchain.com';
const PINKSALE_LINK = 'https://www.pinksale.finance'; // update when live

// ─── Helpers ───────────────────────────────────────────────────────────────
function daysUntil(date) {
  const now  = new Date();
  const diff = date - now;
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function presaleStatus() {
  const now = new Date();
  if (now < PRESALE_OPEN)  return `opens in ${daysUntil(PRESALE_OPEN)} days`;
  if (now < PRESALE_CLOSE) return `LIVE — closes in ${daysUntil(PRESALE_CLOSE)} days`;
  return 'closed';
}

function countdownMessage() {
  const now    = new Date();
  const isLive = now >= PRESALE_OPEN && now < PRESALE_CLOSE;
  const emoji  = isLive ? '🟢' : '🟡';

  return (
`${emoji} *KENO Presale Update*

📅 Presale: ${presaleStatus().toUpperCase()}
⚡ Rate: 750,000 KENO per BNB
🎯 Soft cap: 30 BNB | Hard cap: 60 BNB

🔗 PinkSale: ${PINKSALE_LINK}
🌐 Website: ${WEBSITE}

_The Sovereign Economy — Education\\-Fi \\(E\\-Fi\\)_
_Where Learning ends and Earning begins\\._`
  );
}

// ─── Welcome new members ───────────────────────────────────────────────────
bot.on('new_chat_members', async (msg) => {
  const names = msg.new_chat_members
    .map(u => u.first_name || u.username || 'Sovereign')
    .join(', ');

  const welcome =
`👑 *Welcome to The Sovereign Economy\\!*

Gm ${escMd(names)} — glad you're here\\.

You've just joined the *Education\\-Fi \\(E\\-Fi\\)* movement\\.
Where learning ends and earning begins — there is no line\\.

Here's what we're building:
🟡 *KENO* — BSC utility token \\(presale ${presaleStatus()}\\)
⚔️ *SHIELD* — Solana community token
👑 *QCT* — Queens Chariot multi\\-chain DEX

🌐 ${WEBSITE}

Type /presale for presale details\\.
Type /about for the full story\\.`;

  try {
    await bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'MarkdownV2' });
  } catch (e) {
    console.error('Welcome message failed:', e.message);
  }
});

// ─── Commands ──────────────────────────────────────────────────────────────
bot.onText(/\/presale/, async (msg) => {
  try {
    await bot.sendMessage(msg.chat.id, countdownMessage(), { parse_mode: 'MarkdownV2' });
  } catch (e) {
    console.error('/presale failed:', e.message);
  }
});

bot.onText(/\/keno/, async (msg) => {
  const text =
`🟡 *KENO Token \\(v2\\)*

📍 Network: Binance Smart Chain \\(BSC\\)
📋 Contract: \`${escMd(KENO_CONTRACT)}\`
💰 Presale Rate: 750,000 KENO per BNB
🔒 Soft cap: 30 BNB | Hard cap: 60 BNB
📅 Presale: June 26 – July 10, 2026

✅ Verify on BSCScan before buying\\.
🌐 ${WEBSITE}`;

  try {
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'MarkdownV2' });
  } catch (e) {
    console.error('/keno failed:', e.message);
  }
});

bot.onText(/\/about/, async (msg) => {
  const text =
`⚔️ *The Sovereign Economy*

We coined *Education\\-Fi \\(E\\-Fi\\)* in 2026\\.
The convergence of education and finance — where the two are one\\.

🎓 21 courses with KENO rewards
💳 KUTL Card \\(BNB\\-compatible, in development\\)
🤖 4\\-platform VLAT arbitrage protocol
🌍 Built for 2\\.4B unbanked worldwide

3\\-token ecosystem: KENO · SHIELD · QCT
Each token is a chapter in the same story\\.

🌐 ${WEBSITE}
Founded by Nickeo Coleman`;

  try {
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'MarkdownV2' });
  } catch (e) {
    console.error('/about failed:', e.message);
  }
});

bot.onText(/\/links/, async (msg) => {
  const text =
`🔗 *Sovereign Economy Links*

🌐 Website: ${WEBSITE}
🐦 Twitter/X: https://twitter.com/kenostod
📋 PinkSale: ${PINKSALE_LINK}
🔍 KENO Contract: \`${escMd(KENO_CONTRACT)}\`
📡 BSCScan: https://bscscan\\.com/token/${KENO_CONTRACT}`;

  try {
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'MarkdownV2' });
  } catch (e) {
    console.error('/links failed:', e.message);
  }
});

// ─── Daily countdown scheduler ─────────────────────────────────────────────
function scheduleDailyPost() {
  if (!CHAT_ID) {
    console.log('⚠️  SHIELD_ALERT_CHAT_ID not set — daily posts disabled.');
    return;
  }

  function msUntilNextPost() {
    const now    = new Date();
    const target = new Date();
    target.setUTCHours(9, 0, 0, 0);
    if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
    return target - now;
  }

  function postAndReschedule() {
    bot.sendMessage(CHAT_ID, countdownMessage(), { parse_mode: 'MarkdownV2' })
      .then(() => console.log('📢 Daily countdown posted'))
      .catch(e => console.error('Daily post failed:', e.message));

    setTimeout(postAndReschedule, msUntilNextPost());
  }

  const firstDelay = msUntilNextPost();
  console.log(`⏰  Daily post scheduled in ${Math.round(firstDelay / 60000)} minutes`);
  setTimeout(postAndReschedule, firstDelay);
}

// ─── Markdown v2 escape helper ─────────────────────────────────────────────
function escMd(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// ─── Start ─────────────────────────────────────────────────────────────────
console.log('👑  Kings Shield Community Bot — online');
console.log('   Kaprekar Constant: 6174 — All paths converge.');
scheduleDailyPost();

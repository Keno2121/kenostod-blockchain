/**
 * Kings Shield Community Bot — Enhanced
 * =======================================
 * Keeps the Sovereign Economy Telegram group alive, educated, and transparent.
 *
 * Features:
 *   - Welcomes every new member with a branded message
 *   - Daily rotating posts: morning course teaser + evening trivia
 *   - Immediate post on startup if daily post was missed
 *   - Commands: /courses /presale /keno /about /links /liquidity /trivia
 *   - Kaprekar Constant: 6174
 */

const TelegramBot = require('node-telegram-bot-api');

const TOKEN   = process.env.KINGS_SHIELD_BOT_TOKEN;
const CHAT_ID = process.env.COMMUNITY_CHAT_ID;

if (!TOKEN) {
  console.error('❌  KINGS_SHIELD_BOT_TOKEN not set. Bot cannot start.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── Config ────────────────────────────────────────────────────────────────
const PRESALE_OPEN  = new Date('2026-07-23T00:00:00Z');
const PRESALE_CLOSE = new Date('2026-08-06T00:00:00Z');
const WEBSITE       = 'https://kenostodblockchain.com';
const PINKSALE_LINK = 'https://www.pinksale.finance';
const KENO_CONTRACT = '0x48bb049afe50b050b458624dc6233acd51024ab4';

// ─── 21 Course teasers ─────────────────────────────────────────────────────
const COURSE_TEASERS = [
  { num: 1,  title: 'What is Blockchain?',              teaser: 'Most people think blockchain is just Bitcoin. Course 1 shows you why that\'s like saying the internet is just email.' },
  { num: 2,  title: 'How Crypto Wallets Work',           teaser: 'Your wallet doesn\'t hold coins — it holds keys. Course 2 explains what you\'re actually protecting and why it matters.' },
  { num: 3,  title: 'DeFi vs Traditional Finance',      teaser: 'Banks charge you to hold your own money. Course 3 breaks down how DeFi flips that model completely.' },
  { num: 4,  title: 'Understanding Tokenomics',         teaser: 'Why do some tokens moon and others crash? Course 4 teaches you to read the math behind any token before you buy.' },
  { num: 5,  title: 'Smart Contracts Explained',        teaser: 'A smart contract is a promise written in code that executes itself. No middleman. No trust needed. Course 5 shows you how.' },
  { num: 6,  title: 'Staking & Yield Farming',          teaser: 'Your money should work while you sleep. Course 6 teaches you how staking and yield farming generate passive income.' },
  { num: 7,  title: 'NFTs Beyond the Hype',             teaser: 'NFTs aren\'t just JPEGs. Course 7 shows the real utility — ownership, royalties, and digital identity.' },
  { num: 8,  title: 'Liquidity Pools Deep Dive',        teaser: 'Every DEX trade you make goes through a liquidity pool. Course 8 explains who profits from that — and how you can too.' },
  { num: 9,  title: 'Cross-Chain Bridges',              teaser: 'Value shouldn\'t be trapped on one blockchain. Course 9 shows how assets move between chains and why it matters.' },
  { num: 10, title: 'DAO Governance',                   teaser: 'What if your community voted on every major decision? Course 10 explains how DAOs make that real.' },
  { num: 11, title: 'Layer 2 Solutions',                teaser: 'Gas fees killing your profits? Course 11 breaks down Layer 2 networks and how they make blockchain affordable.' },
  { num: 12, title: 'Crypto Security Fundamentals',     teaser: '95% of crypto losses are preventable. Course 12 covers the exact habits that separate safe holders from victims.' },
  { num: 13, title: 'Reading On-Chain Data',            teaser: 'Everything on blockchain is public. Course 13 teaches you to read what whales are doing before the price moves.' },
  { num: 14, title: 'Arbitrage & Trading Basics',       teaser: 'The same asset trading at different prices on two exchanges is free money — if you know how. Course 14 teaches you.' },
  { num: 15, title: 'Flash Loans & FALs',               teaser: 'Borrow millions with zero collateral for one transaction. Course 15 explains Flash Arbitrage Loans and how KENO uses them.' },
  { num: 16, title: 'Proof of Work vs Proof of Stake',  teaser: 'Bitcoin mines. Ethereum stakes. KENO does both — plus PoRV. Course 16 explains why the hybrid model wins.' },
  { num: 17, title: 'The Unbanked Opportunity',         teaser: '2.4 billion people have no access to banking. Course 17 shows why that\'s the largest untapped market in human history.' },
  { num: 18, title: 'Building Wealth with KENO',        teaser: 'The Sovereign Economy isn\'t a job. It\'s a machine that pays you. Course 18 shows you how to set it up.' },
  { num: 19, title: 'PoRV — Proof of Residual Value',   teaser: 'KENO\'s proprietary consensus mechanism. Course 19 explains how value compounds every time someone learns.' },
  { num: 20, title: 'Community Governance & Voting',    teaser: 'You don\'t just hold KENO — you direct it. Course 20 covers your voting power in the Sovereign Economy DAO.' },
  { num: 21, title: 'Graduation & Your 5,250 KENO',     teaser: 'The final chapter. Course 21 covers what happens when you graduate, what your KENO is worth, and how redemption works.' },
];

// ─── Daily trivia ──────────────────────────────────────────────────────────
const TRIVIA = [
  { q: 'What does DeFi stand for?',                              a: 'Decentralized Finance' },
  { q: 'What is the KENO presale rate in KENO per BNB?',         a: '750,000 KENO per BNB' },
  { q: 'How many courses are in the Sovereign Economy Academy?', a: '21 courses' },
  { q: 'What does PoRV stand for?',                              a: 'Proof of Residual Value' },
  { q: 'How many KENO do graduates earn?',                       a: '5,250 KENO' },
  { q: 'What is Kaprekar\'s Constant?',                          a: '6174' },
  { q: 'What does E-Fi stand for?',                              a: 'Education-Fi' },
  { q: 'On which blockchain is KENO v2 deployed?',               a: 'Binance Smart Chain (BSC)' },
  { q: 'What is a Flash Arbitrage Loan (FAL)?',                  a: 'A zero-collateral loan executed and repaid in one transaction' },
  { q: 'What is the soft cap for the KENO presale?',             a: '30 BNB' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function daysUntil(date) {
  const diff = date - new Date();
  return diff <= 0 ? 0 : Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function timeGreeting() {
  const h = new Date().getUTCHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function presaleStatus() {
  const now = new Date();
  if (now < PRESALE_OPEN)  return `opens in ${daysUntil(PRESALE_OPEN)} days (July 23)`;
  if (now < PRESALE_CLOSE) return `LIVE — closes in ${daysUntil(PRESALE_CLOSE)} days`;
  return 'closed';
}

function todayCourse() {
  return COURSE_TEASERS[new Date().getUTCDate() % COURSE_TEASERS.length];
}

function todayTrivia() {
  return TRIVIA[new Date().getUTCDate() % TRIVIA.length];
}

function send(chatId, html) {
  return bot.sendMessage(chatId, html, { parse_mode: 'HTML' });
}

// ─── Welcome rate-limit queue ──────────────────────────────────────────────
const welcomeQueue = [];
let welcomeBusy = false;

async function processWelcomeQueue() {
  if (welcomeBusy || welcomeQueue.length === 0) return;
  welcomeBusy = true;
  const { chatId, text } = welcomeQueue.shift();
  try {
    await send(chatId, text);
  } catch (e) {
    if (e.message && e.message.includes('429')) {
      const wait = 5000;
      console.log(`Welcome rate-limited — retrying in ${wait}ms`);
      welcomeQueue.unshift({ chatId, text });
      await new Promise(r => setTimeout(r, wait));
    } else {
      console.error('Welcome failed:', e.message);
    }
  }
  welcomeBusy = false;
  if (welcomeQueue.length > 0) setTimeout(processWelcomeQueue, 1500);
}

// ─── Welcome new members ───────────────────────────────────────────────────
bot.on('new_chat_members', (msg) => {
  const names = msg.new_chat_members
    .filter(u => !u.is_bot)
    .map(u => u.first_name || u.username || 'Sovereign')
    .join(', ');

  if (!names) return;

  const text =
`👑 <b>Welcome to The Sovereign Economy!</b>

${timeGreeting()}, <b>${names}</b> 🙌

You just joined the <b>Education-Fi (E-Fi)</b> movement.
Where learning ends and earning begins — there is no line.

🟡 <b>KENO</b> — BSC utility token (presale ${presaleStatus()})
⚔️ <b>SHIELD</b> — Solana community token
👑 <b>QCT</b> — Queens Chariot multi-chain DEX

📚 <b>The Academy has 21 FREE courses.</b>
You don't pay to learn. <b>Learning pays YOU.</b>
Complete all 21 → earn <b>5,250 KENO</b> in rewards.

👉 Start your first lesson free: ${WEBSITE}

Type /courses · /presale · /liquidity · /about`;

  welcomeQueue.push({ chatId: msg.chat.id, text });
  processWelcomeQueue();
});

// ─── Commands ──────────────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  console.log(`📨 Message from chat: ${msg.chat.id} (${msg.chat.type}) "${msg.chat.title || msg.chat.username || 'private'}"`);
  if (msg.text && msg.text.toLowerCase().includes('chatid')) {
    try {
      await send(msg.chat.id, `Chat ID: <code>${msg.chat.id}</code>\nTitle: ${msg.chat.title || 'private'}`);
    } catch (e) {
      console.error('chatid reply failed:', e.message);
    }
  }
});

bot.onText(/\/presale/, async (msg) => {
  const text =
`🟡 <b>KENO Presale</b>

📅 Opens: <b>July 23, 2026</b>
📅 Closes: <b>August 6, 2026</b>
⚡ Rate: 750,000 KENO per BNB
🎯 Soft cap: 30 BNB | Hard cap: 60 BNB

🔗 PinkSale: ${PINKSALE_LINK}
🌐 Website: ${WEBSITE}

<i>The Sovereign Economy — Education-Fi (E-Fi)</i>`;

  try { await send(msg.chat.id, text); } catch (e) { console.error('/presale:', e.message); }
});

bot.onText(/\/courses/, async (msg) => {
  const c = todayCourse();
  const text =
`📚 <b>The Sovereign Economy Academy</b>

21 courses. All FREE — always.
You don't pay to learn. <b>Learning pays YOU.</b>

🎓 Complete all 21 → earn <b>5,250 KENO</b> in rewards

<b>Today's spotlight — Course ${c.num}: ${c.title}</b>
<i>${c.teaser}</i>

👉 Start Course 1 FREE: ${WEBSITE}

Complete a course → screenshot it → drop it here.
First 10 graduates get <b>priority presale allocation</b> 🎯`;

  try { await send(msg.chat.id, text); } catch (e) { console.error('/courses:', e.message); }
});

bot.onText(/\/liquidity/, async (msg) => {
  const text =
`💧 <b>How KENO Redemption Works — Full Transparency</b>

When you graduate the Academy you earn:
→ <b>5,250 KENO</b> (target value: $5,250 at $1/KENO)

<b>Can I cash out $5,250 immediately?</b>
Not if the liquidity pool is small.
A low-liquidity pool can't absorb large sells without affecting the price for everyone.

<b>So how do I access my value?</b>
→ Use <b>FALs</b> (Flash Arbitrage Loans) to generate yield while the pool grows
→ Partial sells as liquidity deepens
→ Full redemption once pool supports the volume

<b>What grows the pool?</b>
→ Every presale participant adds liquidity
→ Every KENO holder who stakes adds depth
→ Arbitrage bot profits recycle back in

<b>The honest timeline:</b>
Early graduates → FAL strategy first
As community grows → full cashout unlocks

This is how DeFi actually works.
We tell you upfront so there are no surprises. 🤜`;

  try { await send(msg.chat.id, text); } catch (e) { console.error('/liquidity:', e.message); }
});

bot.onText(/\/keno/, async (msg) => {
  const text =
`🟡 <b>KENO Token (v2 — Active)</b>

📍 Network: Binance Smart Chain (BSC)
📋 Contract: <code>${KENO_CONTRACT}</code>
💰 Presale Rate: 750,000 KENO per BNB
🔒 Soft cap: 30 BNB | Hard cap: 60 BNB
📅 Presale: July 23 – August 6, 2026

✅ Verify on BSCScan before buying.
🌐 ${WEBSITE}`;

  try { await send(msg.chat.id, text); } catch (e) { console.error('/keno:', e.message); }
});

bot.onText(/\/about/, async (msg) => {
  const text =
`⚔️ <b>The Sovereign Economy</b>

We coined <b>Education-Fi (E-Fi)</b> in 2026.
The convergence of education and finance.
Where learning ends and earning begins — there is no line.

🎓 21 courses with KENO rewards
💳 KUTL Card (BNB-compatible, in development)
🤖 VLAT 4-platform arbitrage protocol
🌍 Built for 2.4B unbanked worldwide

3-token ecosystem:
🟡 KENO · ⚔️ SHIELD · 👑 QCT

Each token is a chapter in the same story.

🌐 ${WEBSITE}
Founded by Nickeo Coleman`;

  try { await send(msg.chat.id, text); } catch (e) { console.error('/about:', e.message); }
});

bot.onText(/\/links/, async (msg) => {
  const text =
`🔗 <b>Official Links</b>

🌐 Website: ${WEBSITE}
📚 Academy: ${WEBSITE}
🐦 Twitter/X: https://twitter.com/kenostod
📋 PinkSale: ${PINKSALE_LINK}
🔍 KENO on BSCScan: https://bscscan.com/token/${KENO_CONTRACT}`;

  try { await send(msg.chat.id, text); } catch (e) { console.error('/links:', e.message); }
});

bot.onText(/\/trivia/, async (msg) => {
  const t = todayTrivia();
  const text =
`🧠 <b>Daily Crypto Trivia!</b>

<b>${t.q}</b>

Reply with your answer — winner gets a shoutout 👑

<i>Hint: The answer is covered in one of our 21 free courses.</i>
Start free at ${WEBSITE}`;

  try { await send(msg.chat.id, text); } catch (e) { console.error('/trivia:', e.message); }
});

// ─── Daily post content builders ───────────────────────────────────────────
function buildMorningPost() {
  const c = todayCourse();
  return `☀️ <b>${timeGreeting()}, Sovereign Economy fam!</b>

📅 Presale in <b>${daysUntil(PRESALE_OPEN)} days</b> — July 23, 2026

📚 <b>Course of the Day — Course ${c.num}: ${c.title}</b>
<i>${c.teaser}</i>

👉 Start free: ${WEBSITE}

Complete a course → screenshot → drop it here.
First 10 graduates get <b>priority presale allocation</b> 🎯

Type /courses · /liquidity · /trivia · /presale`;
}

function buildEveningPost() {
  const t = todayTrivia();
  return `🌙 <b>Evening check-in, Sovereign fam!</b>

🧠 <b>Trivia time!</b>

<b>${t.q}</b>

Reply with your answer — first correct gets a shoutout 👑

<i>The answer is in one of our 21 free courses.</i>
Start free: ${WEBSITE}`;
}

// ─── Daily scheduler ───────────────────────────────────────────────────────
function msUntilHourUTC(hourUTC) {
  const now    = new Date();
  const target = new Date();
  target.setUTCHours(hourUTC, 0, 0, 0);
  if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
  return target - now;
}

function scheduleDailyPosts() {
  if (!CHAT_ID) {
    console.log('⚠️  COMMUNITY_CHAT_ID not set — daily posts disabled.');
    return;
  }

  const nowUTC = new Date().getUTCHours();

  // If bot starts after midnight but before 9am — post morning now
  // If bot starts after 9am but before 6pm — post morning now (missed), schedule evening
  // If bot starts after 6pm — schedule both for tomorrow
  const missedMorning = nowUTC >= 9;
  const missedEvening = nowUTC >= 18;

  if (missedMorning && !missedEvening) {
    if (alreadySentToday('morning')) {
      console.log('⏭  Morning post already sent today — skipping (restart guard)');
    } else {
      console.log('📢 Sending missed morning post now...');
      send(CHAT_ID, buildMorningPost())
        .then(() => { markSentToday('morning'); console.log('✅ Missed morning post sent'); })
        .catch(e => console.error('Missed morning post failed:', e.message));
    }
  }

  if (missedEvening) {
    console.log('📢 Both posts missed today — scheduling for tomorrow.');
  }

  function scheduleLoop(hourUTC, buildFn, label) {
    const flagKey = label.toLowerCase();
    const delay = msUntilHourUTC(hourUTC);
    console.log(`⏰  ${label} post in ${Math.round(delay / 60000)} min`);
    setTimeout(function tick() {
      send(CHAT_ID, buildFn())
        .then(() => { markSentToday(flagKey); console.log(`📢 ${label} post sent`); })
        .catch(e => console.error(`${label} post failed:`, e.message));
      setTimeout(tick, msUntilHourUTC(hourUTC));
    }, delay);
  }

  scheduleLoop(9,  buildMorningPost, 'Morning');
  scheduleLoop(18, buildEveningPost, 'Evening');
}

// ─── Dedup guard — one post per type per UTC day ───────────────────────────
const fs   = require('fs');
const path = require('path');
const SENT_FLAG_FILE = path.join(__dirname, '.sent-flags.json');

function todayUTCKey() {
  return new Date().toISOString().slice(0, 10); // "2026-06-24"
}

function alreadySentToday(key) {
  try {
    const flags = JSON.parse(fs.readFileSync(SENT_FLAG_FILE, 'utf8'));
    return flags[key] === todayUTCKey();
  } catch { return false; }
}

function markSentToday(key) {
  let flags = {};
  try { flags = JSON.parse(fs.readFileSync(SENT_FLAG_FILE, 'utf8')); } catch {}
  flags[key] = todayUTCKey();
  try { fs.writeFileSync(SENT_FLAG_FILE, JSON.stringify(flags)); } catch {}
}

// ─── Startup announcement ──────────────────────────────────────────────────
async function sendStartupPost() {
  if (!CHAT_ID) return;
  if (alreadySentToday('startup')) {
    console.log('⏭  Startup post already sent today — skipping (restart guard)');
    return;
  }
  const text =
`👑 <b>Sovereign Economy — ${timeGreeting()}, Sovereigns!</b>

📅 Presale opens in <b>${daysUntil(PRESALE_OPEN)} days</b> — July 23, 2026
⚡ Rate: 750,000 KENO per BNB
🎯 Soft cap: 30 BNB | Hard cap: 60 BNB

🎓 <b>21 free courses → earn 5,250 KENO</b>
Start free: ${WEBSITE}

Type /courses · /presale · /liquidity · /trivia

<i>The Sovereign Economy — Education-Fi (E-Fi)
Where Learning ends and Earning begins.</i>`;

  try {
    await send(CHAT_ID, text);
    markSentToday('startup');
    console.log('✅ Startup post sent to group');
  } catch (e) {
    console.error('Startup post failed:', e.message);
  }
}

// ─── Start ─────────────────────────────────────────────────────────────────
console.log('👑  Kings Shield Community Bot — Enhanced — online');
console.log('   Kaprekar Constant: 6174 — All paths converge.');
console.log('   Presale date: July 23, 2026');
sendStartupPost();
scheduleDailyPosts();

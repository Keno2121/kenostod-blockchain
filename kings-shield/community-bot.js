/**
 * Kings Shield Community Bot — Enhanced
 * =======================================
 * Keeps the Sovereign Economy Telegram group alive, educated, and transparent.
 *
 * Features:
 *   - Welcomes every new member with a branded message
 *   - Daily rotating posts: presale countdown + course teasers + trivia
 *   - /courses /presale /keno /about /links /liquidity commands
 *   - Transparent KENO redemption education baked in
 *   - Kaprekar Constant: 6174
 */

const TelegramBot = require('node-telegram-bot-api');

const TOKEN   = process.env.KINGS_SHIELD_BOT_TOKEN;
const CHAT_ID = process.env.SHIELD_ALERT_CHAT_ID;

if (!TOKEN) {
  console.error('❌  KINGS_SHIELD_BOT_TOKEN not set. Bot cannot start.');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── Config ────────────────────────────────────────────────────────────────
const PRESALE_OPEN  = new Date('2026-07-23T00:00:00Z');
const PRESALE_CLOSE = new Date('2026-08-06T00:00:00Z');
const WEBSITE       = 'https://kenostodblockchain.com';
const COURSES_LINK  = 'https://kenostodblockchain.com';
const PINKSALE_LINK = 'https://www.pinksale.finance';
const KENO_CONTRACT = '0x48bb049afe50b050b458624dc6233acd51024ab4';

// ─── 21 Course teasers ─────────────────────────────────────────────────────
const COURSE_TEASERS = [
  { num: 1,  title: 'What is Blockchain?',           teaser: 'Most people think blockchain is just Bitcoin. Course 1 shows you why that\'s like saying the internet is just email.' },
  { num: 2,  title: 'How Crypto Wallets Work',        teaser: 'Your wallet doesn\'t hold coins — it holds keys. Course 2 explains what you\'re actually protecting and why it matters.' },
  { num: 3,  title: 'DeFi vs Traditional Finance',   teaser: 'Banks charge you to hold your own money. Course 3 breaks down how DeFi flips that model completely.' },
  { num: 4,  title: 'Understanding Tokenomics',      teaser: 'Why do some tokens moon and others crash? Course 4 teaches you to read the math behind any token before you buy.' },
  { num: 5,  title: 'Smart Contracts Explained',     teaser: 'A smart contract is a promise written in code that executes itself. No middleman. No trust needed. Course 5 shows you how.' },
  { num: 6,  title: 'Staking & Yield Farming',       teaser: 'Your money should work while you sleep. Course 6 teaches you how staking and yield farming generate passive income.' },
  { num: 7,  title: 'NFTs Beyond the Hype',          teaser: 'NFTs aren\'t just JPEGs. Course 7 shows the real utility — ownership, royalties, and digital identity.' },
  { num: 8,  title: 'Liquidity Pools Deep Dive',     teaser: 'Every DEX trade you make goes through a liquidity pool. Course 8 explains who profits from that — and how you can too.' },
  { num: 9,  title: 'Cross-Chain Bridges',           teaser: 'Value shouldn\'t be trapped on one blockchain. Course 9 shows how assets move between chains and why it matters.' },
  { num: 10, title: 'DAO Governance',                teaser: 'What if your community voted on every major decision? Course 10 explains how DAOs make that real.' },
  { num: 11, title: 'Layer 2 Solutions',             teaser: 'Gas fees killing your profits? Course 11 breaks down Layer 2 networks and how they make blockchain affordable.' },
  { num: 12, title: 'Crypto Security Fundamentals',  teaser: '95% of crypto losses are preventable. Course 12 covers the exact habits that separate safe holders from victims.' },
  { num: 13, title: 'Reading On-Chain Data',         teaser: 'Everything on blockchain is public. Course 13 teaches you to read what whales are doing before the price moves.' },
  { num: 14, title: 'Arbitrage & Trading Basics',    teaser: 'The same asset trading at different prices on two exchanges is free money — if you know how. Course 14 teaches you.' },
  { num: 15, title: 'Flash Loans & FALs',            teaser: 'Borrow millions with zero collateral for one transaction. Course 15 explains Flash Arbitrage Loans and how KENO uses them.' },
  { num: 16, title: 'Proof of Work vs Proof of Stake', teaser: 'Bitcoin mines. Ethereum stakes. KENO does both — plus PoRV. Course 16 explains why the hybrid model wins.' },
  { num: 17, title: 'The Unbanked Opportunity',      teaser: '2.4 billion people have no access to banking. Course 17 shows why that\'s the largest untapped market in human history.' },
  { num: 18, title: 'Building Wealth with KENO',     teaser: 'The Sovereign Economy isn\'t a job. It\'s a machine that pays you. Course 18 shows you how to set it up.' },
  { num: 19, title: 'PoRV — Proof of Residual Value', teaser: 'KENO\'s proprietary consensus mechanism. Course 19 explains how value compounds every time someone learns.' },
  { num: 20, title: 'Community Governance & Voting', teaser: 'You don\'t just hold KENO — you direct it. Course 20 covers your voting power in the Sovereign Economy DAO.' },
  { num: 21, title: 'Graduation & Your 5,250 KENO',  teaser: 'The final chapter. Course 21 covers what happens when you graduate, what your KENO is worth, and how redemption works.' },
];

// ─── Daily trivia ──────────────────────────────────────────────────────────
const TRIVIA = [
  { q: 'What does DeFi stand for?',                         a: 'Decentralized Finance' },
  { q: 'What is the KENO presale rate in KENO per BNB?',    a: '750,000 KENO per BNB' },
  { q: 'How many courses are in the Sovereign Economy Academy?', a: '21 courses' },
  { q: 'What does PoRV stand for?',                         a: 'Proof of Residual Value' },
  { q: 'How many KENO do graduates earn?',                  a: '5,250 KENO' },
  { q: 'What is Kaprekar\'s Constant?',                     a: '6174' },
  { q: 'What does E-Fi stand for?',                         a: 'Education-Fi' },
  { q: 'On which blockchain is KENO v2 deployed?',          a: 'Binance Smart Chain (BSC)' },
  { q: 'What is a Flash Arbitrage Loan (FAL)?',             a: 'A zero-collateral loan executed and repaid in one transaction' },
  { q: 'What is the soft cap for the KENO presale?',        a: '30 BNB' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function daysUntil(date) {
  const diff = date - new Date();
  return diff <= 0 ? 0 : Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function presaleStatus() {
  const now = new Date();
  if (now < PRESALE_OPEN)  return `opens in ${daysUntil(PRESALE_OPEN)} days (July 23)`;
  if (now < PRESALE_CLOSE) return `LIVE — closes in ${daysUntil(PRESALE_CLOSE)} days`;
  return 'closed';
}

function escMd(text) {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function todayCourse() {
  const day = new Date().getDate();
  return COURSE_TEASERS[day % COURSE_TEASERS.length];
}

function todayTrivia() {
  const day = new Date().getDate();
  return TRIVIA[day % TRIVIA.length];
}

// ─── Welcome new members ───────────────────────────────────────────────────
bot.on('new_chat_members', async (msg) => {
  const names = msg.new_chat_members
    .map(u => u.first_name || u.username || 'Sovereign')
    .join(', ');

  const welcome =
`👑 *Welcome to The Sovereign Economy\\!*

Gm ${escMd(names)} 🙌

You just joined the *Education\\-Fi \\(E\\-Fi\\)* movement\\.
Where learning ends and earning begins — there is no line\\.

🟡 *KENO* — BSC utility token \\(presale July 23\\)
⚔️ *SHIELD* — Solana community token  
👑 *QCT* — Queens Chariot multi\\-chain DEX

📚 *Did you know?* The Academy has 21 FREE courses\\.
Graduate and earn *5,250 KENO* in rewards\\.

Start your first lesson free 👇
${COURSES_LINK}

Type /courses to learn more
Type /presale for presale info
Type /liquidity to understand how KENO redemption works`;

  try {
    await bot.sendMessage(msg.chat.id, welcome, { parse_mode: 'MarkdownV2' });
  } catch (e) {
    console.error('Welcome failed:', e.message);
  }
});

// ─── Commands ──────────────────────────────────────────────────────────────
bot.onText(/\/presale/, async (msg) => {
  const text =
`🟡 *KENO Presale*

📅 Opens: July 23, 2026
📅 Closes: August 6, 2026
⚡ Rate: 750,000 KENO per BNB
🎯 Soft cap: 30 BNB \\| Hard cap: 60 BNB

🔗 PinkSale: ${escMd(PINKSALE_LINK)}
🌐 Website: ${WEBSITE}

_The Sovereign Economy — Education\\-Fi \\(E\\-Fi\\)_`;

  try {
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'MarkdownV2' });
  } catch (e) {
    console.error('/presale failed:', e.message);
  }
});

bot.onText(/\/courses/, async (msg) => {
  const c = todayCourse();
  const text =
`📚 *The Sovereign Economy Academy*

21 courses\\. All FREE right now\\.
After presale, access requires KENO\\.

🎓 Graduate all 21 → earn *5,250 KENO*

*Today's spotlight — Course ${c.num}: ${escMd(c.title)}*
_${escMd(c.teaser)}_

👉 Start Course 1 FREE: ${COURSES_LINK}

Complete a course and drop a screenshot here\\.
First 10 graduates get priority presale allocation 🎯`;

  try {
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'MarkdownV2' });
  } catch (e) {
    console.error('/courses failed:', e.message);
  }
});

bot.onText(/\/liquidity/, async (msg) => {
  const text =
`💧 *How KENO Redemption Works — Full Transparency*

When you graduate the Academy you earn:
→ *5,250 KENO* \\(target value: \\$5,250 at \\$1/KENO\\)

Here's what you need to know 👇

*Can I cash out \\$5,250 immediately?*
Not if the liquidity pool is small\\.
A low\\-liquidity pool can't absorb large sells without crashing the price for everyone\\.

*So how do I access my value?*
→ Use *FALs* \\(Flash Arbitrage Loans\\) to generate yield while the pool grows
→ Partial sells as liquidity deepens
→ Full redemption once pool supports it

*What grows the pool?*
→ Every presale participant adds liquidity
→ Every KENO holder who stakes adds depth
→ Bot arbitrage profits recycle back in

*The honest timeline:*
Early graduates → FAL strategy first
As community grows → full cashout unlocks

This is how DeFi actually works\\.
We tell you upfront so there are no surprises\\.

Questions? Ask in the group 🤜`;

  try {
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'MarkdownV2' });
  } catch (e) {
    console.error('/liquidity failed:', e.message);
  }
});

bot.onText(/\/keno/, async (msg) => {
  const text =
`🟡 *KENO Token \\(v2 — Active\\)*

📍 Network: Binance Smart Chain \\(BSC\\)
📋 Contract: \`${escMd(KENO_CONTRACT)}\`
💰 Presale Rate: 750,000 KENO per BNB
🔒 Soft cap: 30 BNB \\| Hard cap: 60 BNB
📅 Presale: July 23 – August 6, 2026

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
The convergence of education and finance\\.
Where learning ends and earning begins — there is no line\\.

🎓 21 courses with KENO rewards
💳 KUTL Card \\(BNB\\-compatible, in development\\)
🤖 VLAT 4\\-platform arbitrage protocol
🌍 Built for 2\\.4B unbanked worldwide

3\\-token ecosystem:
🟡 KENO · ⚔️ SHIELD · 👑 QCT

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
`🔗 *Official Links*

🌐 Website: ${WEBSITE}
📚 Academy: ${COURSES_LINK}
🐦 Twitter/X: https://twitter\\.com/kenostod
📋 PinkSale: ${escMd(PINKSALE_LINK)}
🔍 KENO Contract \\(BSCScan\\): https://bscscan\\.com/token/${KENO_CONTRACT}`;

  try {
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'MarkdownV2' });
  } catch (e) {
    console.error('/links failed:', e.message);
  }
});

bot.onText(/\/trivia/, async (msg) => {
  const t = todayTrivia();
  const text =
`🧠 *Daily Crypto Trivia*

${escMd(t.q)}

Reply with your answer\\!
The answer drops in 1 hour 👀

_Brought to you by the Sovereign Economy Academy_
_${COURSES_LINK}_`;

  try {
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'MarkdownV2' });
  } catch (e) {
    console.error('/trivia failed:', e.message);
  }
});

// ─── Daily scheduler ───────────────────────────────────────────────────────
function scheduleDailyPost() {
  if (!CHAT_ID) {
    console.log('⚠️  SHIELD_ALERT_CHAT_ID not set — daily posts disabled.');
    return;
  }

  function msUntilNextPost(hourUTC) {
    const now    = new Date();
    const target = new Date();
    target.setUTCHours(hourUTC, 0, 0, 0);
    if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
    return target - now;
  }

  function postMorning() {
    const c = todayCourse();
    const daysLeft = daysUntil(PRESALE_OPEN);
    const msg =
`☀️ *Good morning, Sovereign Economy fam\\!*

📅 Presale in *${daysLeft} days* \\(July 23\\)

📚 *Course of the Day — Course ${c.num}: ${escMd(c.title)}*
_${escMd(c.teaser)}_

👉 Start free: ${COURSES_LINK}

Complete a course → screenshot → drop it here
First 10 graduates get priority presale allocation 🎯

Type /courses · /presale · /liquidity · /trivia`;

    bot.sendMessage(CHAT_ID, msg, { parse_mode: 'MarkdownV2' })
      .then(() => console.log('📢 Morning post sent'))
      .catch(e => console.error('Morning post failed:', e.message));

    setTimeout(postMorning, msUntilNextPost(9));
  }

  function postEvening() {
    const t = todayTrivia();
    const msg =
`🌙 *Evening check\\-in*

🧠 *Trivia time\\!*
${escMd(t.q)}

Reply with your answer — winner gets a shoutout 👑

💡 Hint: The answer is in one of our 21 courses\\.
Start free at ${COURSES_LINK}`;

    bot.sendMessage(CHAT_ID, msg, { parse_mode: 'MarkdownV2' })
      .then(() => console.log('📢 Evening trivia sent'))
      .catch(e => console.error('Evening post failed:', e.message));

    setTimeout(postEvening, msUntilNextPost(18));
  }

  console.log(`⏰  Morning post in ${Math.round(msUntilNextPost(9) / 60000)} min`);
  console.log(`⏰  Evening post in ${Math.round(msUntilNextPost(18) / 60000)} min`);
  setTimeout(postMorning, msUntilNextPost(9));
  setTimeout(postEvening, msUntilNextPost(18));
}

// ─── Start ─────────────────────────────────────────────────────────────────
console.log('👑  Kings Shield Community Bot — Enhanced — online');
console.log('   Kaprekar Constant: 6174 — All paths converge.');
console.log('   Presale date: July 23, 2026');
scheduleDailyPost();

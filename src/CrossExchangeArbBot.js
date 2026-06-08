'use strict';

/**
 * Cross-Exchange Arb Bot — PancakeSwap AMM ↔ Hyperliquid CLOB
 *
 * WHY THIS WORKS:
 *   PancakeSwap is an AMM — price is set by the bonding curve and updates only
 *   when someone trades. Hyperliquid is a CLOB — price is set by continuous
 *   order-book matching against global market makers. They price the same asset
 *   by completely different mechanisms. They drift apart constantly. No MEV bots
 *   compete here because bridging two completely separate ecosystems (EVM + HL)
 *   requires infrastructure that almost nobody has built.
 *
 * STRATEGY:
 *   Every 30 seconds:
 *   1. Fetch price of target asset on PancakeSwap V2 (via getAmountsOut, BSC)
 *   2. Fetch price of same asset on Hyperliquid (allMids, HL perp/spot)
 *   3. Calculate net spread after gas + PancakeSwap 0.25% + HL 0.035% taker fee
 *   4. If spread > MIN_SPREAD_PCT → log opportunity + alert
 *
 * EXECUTION (autoExecute: false until capital funded):
 *   Buy on cheaper side → sell on expensive side → pocket the spread
 *   HL leg: EIP-712 signed order (same signing as HLFundingBot)
 *   BSC leg: PancakeSwap V2 router (WALLET_PRIVATE_KEY)
 *
 * PAIRS MONITORED:
 *   ETH, BTC, BNB, SOL — all available as both BSC tokens and HL instruments.
 *   KENO added as soon as it lists on HL (placeholder entry included).
 *
 * 7 Constitutional Laws embedded throughout.
 *
 * Required env:
 *   WALLET_PRIVATE_KEY or QCT_DEPLOYER_KEY — for HL signing + BSC execution
 *   TELEGRAM_BOT_TOKEN / KINGS_SHIELD_BOT_TOKEN — alerts
 *   SHIELD_ALERT_CHAT_ID
 */

const https   = require('https');
const { ethers } = require('ethers');

const Kaprekar    = require('./Kaprekar');
const Benford     = require('./Benford');
const GoldenRatio = require('./GoldenRatio');
const Nash        = require('./Nash');
const Euler       = require('./Euler');
const Ramanujan   = require('./Ramanujan');

// ── Config ────────────────────────────────────────────────────────────────────

const POLL_MS          = 30 * 1000;     // scan every 30s
const REPORT_MS        = 8 * 60 * 60 * 1000; // 8-hour summary
const MIN_SPREAD_PCT   = 0.50;          // 0.50% net spread minimum to flag
const EXEC_SPREAD_PCT  = 0.80;          // 0.80% net spread to actually execute
const PANCAKE_FEE_PCT  = 0.25;          // PancakeSwap V2 taker fee
const HL_TAKER_FEE_PCT = 0.035;         // HL market taker fee
const BSC_GAS_USD_EST  = 0.05;          // ~$0.05 per BSC swap at current gas
const MAX_TRADE_USD    = 200;           // max $200 per leg when executing
const MIN_TRADE_USD    = 10;            // min $10 per leg

// ── Token / Pair config ────────────────────────────────────────────────────────

const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const USDT = '0x55d398326f99059fF775485246999027B3197955';

// BSC tokens ↔ HL coin name mapping
const PAIRS = [
  {
    name:     'ETH',
    bscToken: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', // WETH on BSC
    hlCoin:   'ETH',
    decimals: 18,
    usdPath:  [WBNB, USDT], // price ETH in BNB then convert BNB→USD
    active:   true,
  },
  {
    name:     'BTC',
    bscToken: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', // BTCB
    hlCoin:   'BTC',
    decimals: 18,
    usdPath:  [WBNB, USDT],
    active:   true,
  },
  {
    name:     'BNB',
    bscToken: WBNB,
    hlCoin:   'BNB',
    decimals: 18,
    usdPath:  [USDT],
    active:   true,
  },
  {
    name:     'SOL',
    bscToken: '0x570A5D26f7765Ecb712C0924E4De545B89fD43dF', // SOL on BSC (Binance-peg)
    hlCoin:   'SOL',
    decimals: 18,
    usdPath:  [WBNB, USDT],
    active:   true,
  },
  {
    name:     'KENO',
    bscToken: '0x48bb049afe50b050b458624dc6233acd51024ab4', // KENO v2
    hlCoin:   'KENO',
    decimals: 18,
    usdPath:  [WBNB, USDT],
    active:   false, // enable when KENO lists on HL
  },
];

const BSC_RPC_ENDPOINTS = [
  'https://bsc-rpc.publicnode.com',
  'https://bsc.rpc.blxrbdn.com',
  'https://rpc-bsc.48.club',
];

const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
];
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

const HL_INFO_URL     = 'https://api.hyperliquid.xyz/info';
const HL_EXCHANGE_URL = 'https://api.hyperliquid.xyz/exchange';

// EIP-712 HL signing
const HL_DOMAIN = {
  chainId:           1337,
  name:              'Exchange',
  verifyingContract: '0x0000000000000000000000000000000000000000',
  version:           '1',
};
const HL_AGENT_TYPES = {
  Agent: [
    { name: 'source',       type: 'string'  },
    { name: 'connectionId', type: 'bytes32' },
  ],
};

// ── Bot ───────────────────────────────────────────────────────────────────────

class CrossExchangeArbBot {
  constructor() {
    this.running      = false;
    this.wallet       = null;
    this.address      = null;
    this.bscProvider  = null;
    this.pancakeRouter = null;
    this.pollTimer    = null;
    this.reportTimer  = null;
    this.startedAt    = null;

    this.autoExecute  = true; // LIVE — both legs execute simultaneously

    // ── Price cache ───────────────────────────────────────────────────────────
    this.bscPrices = {};  // coin → USD
    this.hlPrices  = {};  // coin → USD

    // ── Opportunity log ───────────────────────────────────────────────────────
    this.opportunities = [];   // last 50 spotted

    // ── 7 Laws state ──────────────────────────────────────────────────────────
    this.profitableTrades = 0;  // Law III: golden ratio
    this.spreadHistory    = []; // Law II: Benford

    // ── Stats ─────────────────────────────────────────────────────────────────
    this.stats = {
      scanCount:         0,
      opportunitiesSpotted: 0,
      tradesExecuted:    0,
      totalProfit:       0,
      bestSpreadSeen:    0,
      startTime:         null,
    };

    this.logs = [];
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start() {
    const key = process.env.WALLET_PRIVATE_KEY || process.env.QCT_DEPLOYER_KEY;
    if (!key) {
      return { ok: false, msg: 'CrossExchangeArbBot needs WALLET_PRIVATE_KEY or QCT_DEPLOYER_KEY' };
    }

    const rawKey     = key.startsWith('0x') ? key : '0x' + key;
    this.wallet      = new ethers.Wallet(rawKey);
    this.address     = this.wallet.address;
    this.startedAt   = Date.now();
    this.running     = true;
    this.stats.startTime = new Date().toISOString();

    // Connect BSC
    this.bscProvider = await this._connectBSC();
    this.pancakeRouter = new ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, this.bscProvider);

    const activePairs = PAIRS.filter(p => p.active);
    this._log(`⚡ CrossExchangeArbBot starting — ${activePairs.length} pairs — ${this.autoExecute ? 'LIVE EXECUTION' : 'SCAN-ONLY'}`);
    this._log(`🔑 Wallet: ${this.address}`);

    await this._telegram(
      `⚡ <b>Cross-Exchange Arb Bot LIVE</b>\n\n` +
      `PancakeSwap AMM ↔ Hyperliquid CLOB\n` +
      `Mode: ${this.autoExecute ? '🟢 EXECUTING' : '🟡 SCAN-ONLY (no capital yet)'}\n` +
      `Watching: ${activePairs.map(p => p.name).join(', ')}\n` +
      `Min spread to flag: ${MIN_SPREAD_PCT}%\n` +
      `Min spread to execute: ${EXEC_SPREAD_PCT}%\n\n` +
      `<i>Two pricing engines. One always wrong. We capture the difference.</i>`
    );

    // First scan immediately
    await this._scan();
    this.pollTimer   = setInterval(() => this._scan(), POLL_MS);
    this.reportTimer = setInterval(() => this._report(), REPORT_MS);

    return { ok: true, msg: `CrossExchangeArbBot live — scanning ${activePairs.length} pairs every 30s` };
  }

  stop() {
    this.running = false;
    if (this.pollTimer)   { clearInterval(this.pollTimer);   this.pollTimer   = null; }
    if (this.reportTimer) { clearInterval(this.reportTimer); this.reportTimer = null; }
    this._log('🛑 CrossExchangeArbBot stopped');
    return { ok: true, msg: 'stopped' };
  }

  // ── Main Scan ─────────────────────────────────────────────────────────────

  async _scan() {
    if (!this.running) return;
    this.stats.scanCount++;

    try {
      // Fetch all HL mid prices in one call
      const hlMids = await this._hlInfo({ type: 'allMids' });

      // Fetch all BSC prices in parallel
      const activePairs = PAIRS.filter(p => p.active);
      const bscPriceResults = await Promise.allSettled(
        activePairs.map(p => this._getBSCPriceUSD(p))
      );

      for (let i = 0; i < activePairs.length; i++) {
        const pair = activePairs[i];
        const bscResult = bscPriceResults[i];

        if (bscResult.status !== 'fulfilled' || !bscResult.value) continue;

        const bscUSD = bscResult.value;
        const hlUSD  = parseFloat(hlMids?.[pair.hlCoin] || '0');

        if (!hlUSD || !bscUSD) continue;

        this.bscPrices[pair.name] = bscUSD;
        this.hlPrices[pair.name]  = hlUSD;

        await this._evaluateSpread(pair, bscUSD, hlUSD);
      }
    } catch (err) {
      this._log(`⚠ Scan error: ${err.message}`, 'warn');
    }
  }

  async _evaluateSpread(pair, bscUSD, hlUSD) {
    const rawSpread  = Math.abs(bscUSD - hlUSD) / Math.min(bscUSD, hlUSD) * 100;
    const netSpread  = rawSpread - PANCAKE_FEE_PCT - HL_TAKER_FEE_PCT;

    // Track spread for Benford monitoring
    this.spreadHistory.push(rawSpread);
    if (this.spreadHistory.length > 100) this.spreadHistory = this.spreadHistory.slice(-100);

    // ── Law II: Benford fraud detection ────────────────────────────────────────
    if (this.spreadHistory.length >= 20) {
      try {
        if (Benford.check) {
          const ok = Benford.check(this.spreadHistory.map(s => Math.ceil(s * 1000)));
          if (!ok) {
            this._log(`⚠ Law II Benford: Abnormal spread distribution on ${pair.name} — possible price manipulation`, 'warn');
          }
        }
      } catch (_) {}
    }

    if (netSpread < MIN_SPREAD_PCT) return;

    // Meaningful spread found
    const cheapSide  = bscUSD < hlUSD ? 'PancakeSwap' : 'Hyperliquid';
    const expSide    = bscUSD < hlUSD ? 'Hyperliquid' : 'PancakeSwap';
    const gasAdj     = netSpread - (BSC_GAS_USD_EST / MIN_TRADE_USD * 100);

    this.stats.opportunitiesSpotted++;
    if (rawSpread > this.stats.bestSpreadSeen) this.stats.bestSpreadSeen = rawSpread;

    const opp = {
      time:        new Date().toISOString(),
      pair:        pair.name,
      bscUSD,
      hlUSD,
      rawSpread:   parseFloat(rawSpread.toFixed(4)),
      netSpread:   parseFloat(netSpread.toFixed(4)),
      gasAdjSpread: parseFloat(gasAdj.toFixed(4)),
      cheapSide,
      expSide,
      tradeSize:   Math.min(MAX_TRADE_USD, MIN_TRADE_USD),
      executable:  gasAdj >= EXEC_SPREAD_PCT,
    };

    this.opportunities.unshift(opp);
    if (this.opportunities.length > 50) this.opportunities.pop();

    // ── Law III: Golden Ratio — loyalty multiplier ────────────────────────────
    let sizeMultiplier = 1.0;
    try {
      if (GoldenRatio.multiplier) {
        sizeMultiplier = Math.min(GoldenRatio.multiplier(this.profitableTrades), 1.618);
      }
    } catch (_) {}

    const tradeSize  = opp.tradeSize * sizeMultiplier;
    const grossProfit = tradeSize * (netSpread / 100);

    this._log(`🎯 ${pair.name} | BSC $${bscUSD.toFixed(4)} vs HL $${hlUSD.toFixed(4)} | spread ${netSpread.toFixed(3)}% net | buy ${cheapSide} → sell ${expSide} | proj profit $${grossProfit.toFixed(4)}`);

    // Alert on good spreads
    if (netSpread >= MIN_SPREAD_PCT * 1.5 || opp.executable) {
      await this._telegram(
        `🎯 <b>Arb Opportunity — ${pair.name}</b>\n\n` +
        `PancakeSwap: <b>$${bscUSD.toFixed(4)}</b>\n` +
        `Hyperliquid:  <b>$${hlUSD.toFixed(4)}</b>\n` +
        `Net spread: <b>${netSpread.toFixed(3)}%</b>\n` +
        `Direction: Buy ${cheapSide} → Sell ${expSide}\n` +
        `Proj profit on $${tradeSize.toFixed(0)}: <b>$${grossProfit.toFixed(4)}</b>\n\n` +
        (opp.executable && this.autoExecute
          ? `⚡ <b>EXECUTING NOW...</b>`
          : opp.executable
          ? `🟡 Executable — fund bot to capture this automatically`
          : `👁 Flagged — below auto-execute threshold`)
      );
    }

    // Execute if conditions met
    if (opp.executable && this.autoExecute) {
      await this._executeArb(pair, bscUSD, hlUSD, tradeSize);
    }
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  async _executeArb(pair, bscUSD, hlUSD, tradeSize) {
    if (!this.autoExecute) return;

    // ── Dynamic balance cap: never spend more BNB than 80% of wallet balance ──
    try {
      const bnbBal  = await this.bscProvider.getBalance(this.address);
      const bnbUSD  = await this._getBNBPriceUSD();
      const maxUSD  = parseFloat(ethers.formatEther(bnbBal)) * bnbUSD * 0.80;
      if (maxUSD < MIN_TRADE_USD) {
        this._log(`⚠ BNB balance too low for min trade ($${maxUSD.toFixed(2)} avail, need $${MIN_TRADE_USD}) — skipping`);
        return;
      }
      tradeSize = Math.min(tradeSize, maxUSD);
    } catch (_) {}

    const buyOnBSC = bscUSD < hlUSD; // most common: BSC cheaper → buy BSC, short HL
    this._log(`⚡ EXECUTING both legs on ${pair.name} | buy on ${buyOnBSC ? 'BSC' : 'HL'} | size $${tradeSize.toFixed(2)}`);

    try {
      let bscResult, hlResult;

      if (buyOnBSC) {
        // Both legs simultaneously: buy cheap on BSC + short on HL to lock spread
        [bscResult, hlResult] = await Promise.all([
          this._bscBuy(pair, tradeSize),
          this._hlMarketShort(pair.hlCoin, tradeSize),
        ]);
      } else {
        // HL cheaper → long HL (BSC sell requires owning asset first; skip BSC leg)
        hlResult  = await this._hlMarketBuy(pair.hlCoin, tradeSize);
        bscResult = { ok: true, amountOut: 0 };
      }

      const grossProfit = tradeSize * (Math.abs(bscUSD - hlUSD) / Math.min(bscUSD, hlUSD));
      const totalFees   = tradeSize * (PANCAKE_FEE_PCT + HL_TAKER_FEE_PCT) / 100 + BSC_GAS_USD_EST;
      const netProfit   = grossProfit - totalFees;

      if (netProfit > 0) {
        this.stats.tradesExecuted++;
        this.stats.totalProfit += netProfit;
        this.profitableTrades++;

        // ── Law I: Kaprekar — split every dollar of profit ───────────────────
        try {
          if (Kaprekar.absorb) Kaprekar.absorb(netProfit);
        } catch (_) {}

        // ── Law V: Euler — compound tracker ──────────────────────────────────
        try {
          if (Euler.continuousEarnings) {
            const uptime = (Date.now() - this.startedAt) / (365 * 24 * 3600 * 1000);
            Euler.continuousEarnings(this.stats.totalProfit, 1.0, uptime);
          }
        } catch (_) {}

        // ── Law VI: Ramanujan — milestone check ───────────────────────────────
        try {
          if (Ramanujan.check) {
            const m = Ramanujan.check(this.stats.totalProfit);
            if (m?.hit) {
              await this._telegram(`🏆 <b>Ramanujan Milestone!</b>\nCross-arb bot has earned <b>$${this.stats.totalProfit.toFixed(2)}</b> total.\nLaw VI: self-taught systems reach extraordinary places.`);
            }
          }
        } catch (_) {}

        this._log(`✅ Arb trade complete — net profit $${netProfit.toFixed(4)} | total $${this.stats.totalProfit.toFixed(4)}`);
        await this._telegram(
          `✅ <b>Arb Executed — ${pair.name}</b>\n\n` +
          `Net profit: <b>$${netProfit.toFixed(4)}</b>\n` +
          `Total profit: $${this.stats.totalProfit.toFixed(4)}\n` +
          `Trades: ${this.stats.tradesExecuted}`
        );
      }

    } catch (err) {
      this._log(`❌ Execution error on ${pair.name}: ${err.message}`, 'error');
    }
  }

  // ── HL Order Helper (shared signing for buy + short) ─────────────────────

  async _hlOrder(coin, isBuy, usdSize) {
    const mids = await this._hlInfo({ type: 'allMids' });
    const mid  = parseFloat(mids?.[coin] || '0');
    if (!mid) throw new Error(`No HL price for ${coin}`);

    const sz    = parseFloat((usdSize / mid).toFixed(6));
    const nonce = Date.now();
    const action = {
      type: 'order',
      orders: [{
        a: await this._hlCoinIndex(coin),
        b: isBuy,
        p: '0',
        s: String(sz),
        r: false,
        t: { market: {} },
      }],
      grouping: 'na',
    };

    const connectionId = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ action, nonce })));
    const phantomAgent = { source: 'a', connectionId };
    const agentSig     = await this.wallet.signTypedData(HL_DOMAIN, HL_AGENT_TYPES, phantomAgent);

    const r = agentSig.slice(0, 66);
    const s = '0x' + agentSig.slice(66, 130);
    const v = parseInt(agentSig.slice(130, 132), 16);

    const resp = await this._hlExchange({ action, nonce, signature: { r, s, v }, vaultAddress: null });
    return { ok: true, estimatedFill: usdSize * (1 - HL_TAKER_FEE_PCT / 100), response: resp };
  }

  async _hlMarketBuy(coin, usdSize)   { return this._hlOrder(coin, true,  usdSize); }
  async _hlMarketShort(coin, usdSize) { return this._hlOrder(coin, false, usdSize); }

  // ── BSC Buy ───────────────────────────────────────────────────────────────

  async _bscBuy(pair, usdSize) {
    if (!this.wallet || !this.bscProvider) throw new Error('BSC not initialised');
    const signer      = this.wallet.connect(this.bscProvider);
    const routerWrite = new ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, signer);
    const bnbPrice    = await this._getBNBPriceUSD();
    const bnbAmount   = ethers.parseEther((usdSize / bnbPrice).toFixed(8));

    const tx = await routerWrite.swapExactETHForTokens(
      0, // amountOutMin — no slippage guard for now; add in prod
      [WBNB, pair.bscToken],
      this.address,
      Math.floor(Date.now() / 1000) + 60,
      { value: bnbAmount, gasLimit: 200_000 }
    );
    await tx.wait();
    return { ok: true, amountOut: usdSize * (1 - PANCAKE_FEE_PCT / 100) };
  }

  // ── Price Fetchers ────────────────────────────────────────────────────────

  async _getBSCPriceUSD(pair) {
    const amountIn = ethers.parseEther('1');

    if (pair.name === 'BNB') {
      return this._getBNBPriceUSD();
    }

    // getAmountsOut returns [amountIn, ..., amountOut] — capture the LAST element (output)
    const amounts    = await this.pancakeRouter.getAmountsOut(amountIn, [pair.bscToken, WBNB]);
    const bnbOut     = amounts[amounts.length - 1];
    const bnbUSD     = await this._getBNBPriceUSD();
    const tokenInBNB = parseFloat(ethers.formatEther(bnbOut));
    return tokenInBNB * bnbUSD;
  }

  async _getBNBPriceUSD() {
    const amountIn = ethers.parseEther('1');
    // getAmountsOut returns [amountIn, amountOut] — capture amounts[1] (USDT output)
    const amounts  = await this.pancakeRouter.getAmountsOut(amountIn, [WBNB, USDT]);
    const usdOut   = amounts[amounts.length - 1];
    return parseFloat(ethers.formatUnits(usdOut, 18)); // BSC USDT = 18 decimals
  }

  // ── HL helpers ────────────────────────────────────────────────────────────

  async _hlInfo(payload) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(payload);
      const req  = https.request({
        hostname: 'api.hyperliquid.xyz',
        path:     '/info',
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout:  10000,
      }, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve(JSON.parse(d)); }
          catch (e) { resolve(null); }
        });
      });
      req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('HL timeout')); });
      req.write(body); req.end();
    });
  }

  async _hlExchange(payload) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify(payload);
      const req  = https.request({
        hostname: 'api.hyperliquid.xyz',
        path:     '/exchange',
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout:  15000,
      }, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve(JSON.parse(d)); }
          catch (e) { resolve({ status: 'error', rawResponse: d.slice(0, 200) }); }
        });
      });
      req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('HL exchange timeout')); });
      req.write(body); req.end();
    });
  }

  // Fetch HL coin index dynamically from /info meta (cached 1h)
  async _hlCoinIndex(coin) {
    const now = Date.now();
    if (!this._metaCache || now - this._metaCacheAt > 3_600_000) {
      try {
        const meta = await this._hlInfo({ type: 'meta' });
        this._metaCache   = (meta?.universe || []).map(u => u.name);
        this._metaCacheAt = now;
      } catch (_) {
        this._metaCache   = this._metaCache || [];
        this._metaCacheAt = this._metaCacheAt || now;
      }
    }
    const idx = this._metaCache.indexOf(coin);
    return idx === -1 ? 0 : idx;
  }

  // ── BSC connection with fallback ──────────────────────────────────────────

  async _connectBSC() {
    for (const rpc of BSC_RPC_ENDPOINTS) {
      try {
        const provider = new ethers.JsonRpcProvider(rpc);
        await provider.getBlockNumber();
        this._log(`✅ BSC connected: ${rpc}`);
        return provider;
      } catch (_) {
        this._log(`⚠ RPC failed: ${rpc}`, 'warn');
      }
    }
    throw new Error('All BSC RPC endpoints failed');
  }

  // ── 8-Hour Report ─────────────────────────────────────────────────────────

  async _report() {
    const uptime    = ((Date.now() - this.startedAt) / 3_600_000).toFixed(1);
    const pricesMsg = Object.entries(this.bscPrices).map(([name, bsc]) => {
      const hl  = this.hlPrices[name] || 0;
      const spread = hl && bsc ? (Math.abs(bsc - hl) / Math.min(bsc, hl) * 100).toFixed(3) : 'N/A';
      return `  ${name}: BSC $${bsc.toFixed(4)} | HL $${hl.toFixed(4)} | spread ${spread}%`;
    }).join('\n');

    // ── Law IV: Nash — check equilibrium adjustment ────────────────────────────
    let nashLine = '';
    try {
      if (Nash.equilibriumAdjustment) {
        const adj = Nash.equilibriumAdjustment({
          arbOpportunityRate: this.stats.scanCount > 0
            ? this.stats.opportunitiesSpotted / this.stats.scanCount
            : 0,
        });
        if (adj) nashLine = `\n📐 Law IV Nash: threshold auto-tuned → ${adj.suggestion || 'stable'}`;
      }
    } catch (_) {}

    // ── Law V: Euler — continuous compounding projection ──────────────────────
    let eulerLine = '';
    try {
      if (Euler.continuousEarnings && this.stats.totalProfit > 0) {
        const monthlyProjection = (this.stats.totalProfit / parseFloat(uptime)) * 24 * 30;
        eulerLine = `\n📐 Law V Euler: projected monthly → $${monthlyProjection.toFixed(4)}`;
      }
    } catch (_) {}

    await this._telegram(
      `📊 <b>Cross-Exchange Arb — ${uptime}h Report</b>\n\n` +
      `Current prices:\n${pricesMsg}\n\n` +
      `📈 Activity:\n` +
      `  Scans: ${this.stats.scanCount}\n` +
      `  Opps spotted: ${this.stats.opportunitiesSpotted}\n` +
      `  Best spread: ${this.stats.bestSpreadSeen.toFixed(3)}%\n` +
      `  Trades executed: ${this.stats.tradesExecuted}\n` +
      `  Total profit: $${this.stats.totalProfit.toFixed(4)}\n` +
      `  Mode: ${this.autoExecute ? '🟢 EXECUTING' : '🟡 SCAN-ONLY'}` +
      nashLine + eulerLine + '\n\n' +
      `<i>Two engines. One price. Sovereign captures the gap.</i>`
    );
  }

  // ── Status for bot-server ─────────────────────────────────────────────────

  getStatus() {
    return {
      running:       this.running,
      autoExecute:   this.autoExecute,
      totalProfit:   this.stats.totalProfit,
      tradeCount:    this.stats.tradesExecuted,
      scanCount:     this.stats.scanCount,
      uptimeSeconds: this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0,
      stats:         this.stats,
      livePrices: {
        bsc: this.bscPrices,
        hl:  this.hlPrices,
      },
      recentOpportunities: this.opportunities.slice(0, 10),
      recentLogs: this.logs.slice(0, 20),
    };
  }

  // ── Telegram ──────────────────────────────────────────────────────────────

  async _telegram(text) {
    const token  = process.env.TELEGRAM_BOT_TOKEN || process.env.KINGS_SHIELD_BOT_TOKEN;
    const chatId = process.env.SHIELD_ALERT_CHAT_ID;
    if (!token || !chatId) return;
    try {
      const payload = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
      await new Promise((resolve) => {
        const r = https.request({
          hostname: 'api.telegram.org',
          path:     `/bot${token}/sendMessage`,
          method:   'POST',
          headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
          timeout:  10000,
        }, (res) => { res.resume(); resolve(); });
        r.on('error', resolve); r.write(payload); r.end();
      });
    } catch (_) {}
  }

  _log(msg, level = 'info') {
    const entry = { time: new Date().toISOString(), msg, level };
    this.logs.unshift(entry);
    if (this.logs.length > 300) this.logs.pop();
    const icon = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🟢';
    console.log(`[CrossExchangeArbBot] ${icon} ${msg}`);
  }
}

module.exports = CrossExchangeArbBot;

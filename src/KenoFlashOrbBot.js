/**
 * ⚡ KENO FLASH ORB BOT — BSC Mainnet
 * =====================================
 * Pure flash loan arbitrage. Zero capital required — just gas.
 * Tries all 5 Kaprekar-anchored flash amounts, picks the most profitable.
 *
 * Flash amounts (Law VI — Kaprekar Constant, BSC edition):
 *   0.05 BNB  | 0.1 BNB  | 0.5 BNB  | 1 BNB  | 2 BNB
 *
 * Safety: Profitable-or-revert. The FlashArbLoan2 contract reverts the entire
 * transaction if repayment is not possible — gas is the only possible loss.
 *
 * The 7 Constitutional Laws:
 *   Law I   — The Inversion Principle:   Scan all DEX pairs simultaneously; act on best spread
 *   Law II  — The Aegis Covenant:        Check gas reserve BEFORE every trade
 *   Law III — The Sovereign Threshold:   Net profit ≥ $0.25 before any trade executes
 *   Law IV  — The Atomic Guarantee:      quoteBest() simulation BEFORE executeFlashArb()
 *   Law V   — The Treasury Mandate:      Every profit logged + Kaprekar split applied
 *   Law VI  — The Kaprekar Constant:     Flash amounts = 0.05/0.1/0.5/1/2 BNB; scan = 30s
 *   Law VII — The Founder's Seal:        Only founder's wallet key starts the bot
 *
 * Kaprekar Profit Split (Law V — applied to every profit):
 *   60% → Reinvest (bot capital grows — Euler continuous compounding)
 *   25% → Founder's pocket (your $3k/month goal)
 *   15% → KENOAutoBurn (buy + burn KENO on PancakeSwap)
 *
 * Daily target (PDF): 5–15 trades/day × $0.30 avg = $1.50–$4.50/day
 * Monthly: ~$45–$135/month at seed capital. Scales with Euler compounding.
 */

'use strict';

const { ethers } = require('ethers');
const https      = require('https');
const fs         = require('fs');
const path       = require('path');

// ── BSC Mainnet Contracts ─────────────────────────────────────────────────
const FLASH_ARB_LOAN2 = '0x24428f4c0A1FCEd87e84241F103f4aa4FFaD51Be';
const PANCAKE_ROUTER  = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const BISWAP_ROUTER   = '0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8';
const UTL_FARM        = '0x37D320A881CcF553F6cd757f0A33743ae01A2644';

const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const USDT = '0x55d398326f99059fF775485246999027B3197955';
const BUSD = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
const KENO = '0x48bb049afe50b050b458624dc6233acd51024ab4'; // KENO v2 — pool disabled for PinkSale, burn skipped until re-listed

// ── Law VI: Kaprekar flash amounts (BNB) ──────────────────────────────────
const FLASH_AMOUNTS_BNB = ['0.05', '0.1', '0.5', '1', '2'];

// ── ABIs ──────────────────────────────────────────────────────────────────
const FLASH_ARB_ABI = [
  'function quoteBest(uint256 testAmountBNB) external view returns (bool profitable, address sellRouter, address buyRouter, address repayPair, uint256 grossProfitBNB, uint256 repayAmountWBNB)',
  'function executeFlashArb(address borrowPair, address sellRouter, address buyRouter, address stableToken, uint256 borrowAmountWBNB) external',
];

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
];

const BSC_RPC_ENDPOINTS = [
  'https://bsc-rpc.publicnode.com',
  'https://bsc.rpc.blxrbdn.com',
  'https://rpc-bsc.48.club',
];

// ── Profit log path (Law V) ───────────────────────────────────────────────
const PROFIT_LOG = path.join(__dirname, '../flash-orb-profits.json');

class KenoFlashOrbBot {
  constructor() {
    this.provider  = null;
    this.wallet    = null;
    this.flashArb  = null;
    this.running   = false;
    this.paused    = false;

    // ── Law VI: Kaprekar scan interval = 30s (BSC) ─────────────────────
    this.config = {
      autoExecute:    false,        // must be enabled via /api/flash-orb/config
      minProfitUSD:   0.25,         // Law III — Sovereign Threshold
      checkIntervalMs: 30_000,      // Law VI — 30s BSC scan (61.74s on Solana)
      gasPrice:       ethers.parseUnits('1', 'gwei'),
      gasLimitFlash:  600_000,      // flash arb uses more gas (borrow + 2 swaps + repay)
      gasLimitBurn:   130_000,
      bnbPriceUSD:    600,          // updated dynamically from price check
      // Kaprekar profit split (Law V)
      splitReinvest:  0.60,         // 60% → bot capital
      splitFounder:   0.25,         // 25% → your pocket
      splitBurn:      0.15,         // 15% → KENOAutoBurn
    };

    this.stats = {
      scansRun:           0,
      quotesChecked:      0,
      tradesExecuted:     0,
      profitBNB:          0,
      profitUSD:          0,
      kenoBurned:         0,
      founderPocketUSD:   0,
      reinvestedUSD:      0,
      lastScan:           null,
      lastOpportunity:    null,
      lastTrade:          null,
      uptime:             Date.now(),
    };

    this.logs          = [];
    this.opportunities = [];
    this._timer        = null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Law VII — Founder's Seal: only founder's key starts the bot
  // ═══════════════════════════════════════════════════════════════════════
  async init() {
    const key = process.env.WALLET_PRIVATE_KEY;
    if (!key) {
      this.log('❌ Law VII: WALLET_PRIVATE_KEY not set — bot cannot start', 'error');
      return false;
    }

    for (const rpc of BSC_RPC_ENDPOINTS) {
      try {
        this.provider = new ethers.JsonRpcProvider(rpc);
        await this.provider.getBlockNumber();
        this.wallet   = new ethers.Wallet(key, this.provider);
        this.flashArb = new ethers.Contract(FLASH_ARB_LOAN2, FLASH_ARB_ABI, this.wallet);

        this.log(`✅ BSC connected: ${rpc}`);
        this.log(`👛 Wallet: ${this.wallet.address}`);
        this.log(`⚡ FlashArbLoan2: ${FLASH_ARB_LOAN2}`);
        this.log(`📐 Law VI — Flash amounts: ${FLASH_AMOUNTS_BNB.join(' / ')} BNB`);
        this.log(`📐 Law VI — Scan interval: ${this.config.checkIntervalMs / 1000}s`);
        this.log(`📐 Law III — Min profit: $${this.config.minProfitUSD}`);
        return true;
      } catch (_) { continue; }
    }

    this.log('❌ All BSC RPC endpoints failed', 'error');
    return false;
  }

  async start() {
    if (this.running) return { ok: false, msg: 'Already running' };
    const ready = await this.init();
    if (!ready)  return { ok: false, msg: 'Wallet/RPC init failed — check WALLET_PRIVATE_KEY' };

    this.running = true;
    this.log('🤖 KENO Flash Orb Bot STARTED — scanning BSC flash arb opportunities');
    this._scan();
    this._timer = setInterval(() => this._scan(), this.config.checkIntervalMs);
    return { ok: true, msg: 'Flash Orb Bot started' };
  }

  stop() {
    this.running = false;
    clearInterval(this._timer);
    this.log('⏹ Flash Orb Bot stopped');
    return { ok: true };
  }

  pause()  { this.paused = true;  this.log('⏸ Bot paused'); }
  resume() { this.paused = false; this.log('▶️ Bot resumed'); }

  // ═══════════════════════════════════════════════════════════════════════
  //  Law II — Aegis Covenant: check gas reserve before every scan
  // ═══════════════════════════════════════════════════════════════════════
  async _checkGasReserve() {
    const bal = await this.provider.getBalance(this.wallet.address);
    const minGasWei = ethers.parseEther('0.005'); // 5× gas cost for 1 flash trade at 1 gwei
    if (bal < minGasWei) {
      this.log(`⚠️ Law II: BNB balance ${ethers.formatEther(bal)} < 0.005 gas reserve — skipping scan`, 'warn');
      return false;
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Law I + IV: scan all amounts simultaneously, pick best, simulate first
  // ═══════════════════════════════════════════════════════════════════════
  async _quoteAllAmounts() {
    // Law I: scan all 5 flash amounts simultaneously (parallel, not sequential)
    const quotes = await Promise.allSettled(
      FLASH_AMOUNTS_BNB.map(async (amtBNB) => {
        const amtWei = ethers.parseEther(amtBNB);
        const q = await this.flashArb.quoteBest(amtWei);
        if (!q.profitable) return null;
        return { amtBNB, amtWei, q };
      })
    );

    // Filter to profitable quotes only
    const profitable = quotes
      .filter(r => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value);

    this.stats.quotesChecked += FLASH_AMOUNTS_BNB.length;

    if (!profitable.length) return null;

    // Pick the highest grossProfitBNB (Law I — best spread first)
    profitable.sort((a, b) =>
      Number(b.q.grossProfitBNB - a.q.grossProfitBNB)
    );

    return profitable[0];
  }

  async _buildOpportunity(best) {
    const { amtBNB, q } = best;
    const grossBNB = parseFloat(ethers.formatEther(q.grossProfitBNB));
    const gasCostBNB = (this.config.gasLimitFlash * parseFloat(ethers.formatUnits(this.config.gasPrice, 'gwei'))) / 1e9;

    // Update BNB price from on-chain stable ratio
    try {
      const router  = new ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, this.provider);
      const outs    = await router.getAmountsOut(ethers.parseEther('1'), [WBNB, USDT]);
      this.config.bnbPriceUSD = parseFloat(ethers.formatUnits(outs[1], 18));
    } catch (_) {}

    const bnbPrice     = this.config.bnbPriceUSD;
    const netProfitBNB = grossBNB - gasCostBNB;
    const netProfitUSD = netProfitBNB * bnbPrice;
    const spread       = ((grossBNB / parseFloat(amtBNB)) * 100).toFixed(4);

    // Kaprekar profit split preview (Law V)
    const founderUSD  = netProfitUSD * this.config.splitFounder;
    const reinvestUSD = netProfitUSD * this.config.splitReinvest;
    const burnUSD     = netProfitUSD * this.config.splitBurn;

    return {
      time:           new Date().toISOString(),
      flashAmountBNB: amtBNB,
      sellRouter:     q.sellRouter,
      buyRouter:      q.buyRouter,
      repayPair:      q.repayPair,
      grossProfitBNB: grossBNB.toFixed(8),
      gasCostBNB:     gasCostBNB.toFixed(8),
      netProfitBNB:   netProfitBNB.toFixed(8),
      netProfitUSD,
      bnbPriceUSD:    bnbPrice.toFixed(2),
      spread,
      kaprekarSplit: {
        founder:  founderUSD.toFixed(4),
        reinvest: reinvestUSD.toFixed(4),
        burn:     burnUSD.toFixed(4),
      },
      executable: netProfitUSD >= this.config.minProfitUSD,
    };
  }

  async _scan() {
    if (!this.running || this.paused) return;
    this.stats.scansRun++;
    this.stats.lastScan = new Date().toISOString();

    try {
      // Law II — gas check first
      const gasOk = await this._checkGasReserve();
      if (!gasOk) return;

      // Law IV — quote before executing
      const best = await this._quoteAllAmounts();

      if (!best) {
        this.log(`🔍 No flash profit found (scan #${this.stats.scansRun})`);
        return;
      }

      const opp = await this._buildOpportunity(best);
      this.opportunities.unshift(opp);
      if (this.opportunities.length > 100) this.opportunities.pop();
      this.stats.lastOpportunity = opp;

      this.log(
        `⚡ Flash opp: ${opp.flashAmountBNB} BNB | spread ${opp.spread}% | ` +
        `net ~$${opp.netProfitUSD.toFixed(3)} | ` +
        `founder +$${opp.kaprekarSplit.founder} | burn +$${opp.kaprekarSplit.burn}`
      );

      // Law III — Sovereign Threshold
      if (!opp.executable) {
        this.log(`🔒 Law III: $${opp.netProfitUSD.toFixed(3)} < $${this.config.minProfitUSD} threshold — not submitting`);
        return;
      }

      if (!this.config.autoExecute) {
        this.log(`🔒 AUTO-EXECUTE OFF — opp logged. Enable via dashboard to trade.`);
        return;
      }

      await this._executeFlash(opp);
    } catch (e) {
      this.log(`⚠️ Scan error: ${e.message}`, 'warn');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Execute + Kaprekar split (Law V)
  // ═══════════════════════════════════════════════════════════════════════
  async _executeFlash(opp) {
    try {
      this.log(`🚀 Pre-flight: ${opp.flashAmountBNB} BNB flash | est. +$${opp.netProfitUSD.toFixed(3)}`);

      const borrowAmt = ethers.parseEther(opp.flashAmountBNB);

      // ── Pre-flight simulation — zero gas wasted if opportunity is gone ──
      try {
        await this.flashArb.executeFlashArb.estimateGas(
          opp.repayPair, opp.sellRouter, opp.buyRouter, USDT, borrowAmt
        );
      } catch (simErr) {
        this.log(`⛔ Pre-flight failed — opportunity gone (front-run/price moved). No gas spent.`, 'warn');
        this.stats.skippedPreflight = (this.stats.skippedPreflight || 0) + 1;
        return;
      }

      this.log(`✅ Pre-flight passed — submitting flash arb`);
      const tx = await this.flashArb.executeFlashArb(
        opp.repayPair,
        opp.sellRouter,
        opp.buyRouter,
        USDT,
        borrowAmt,
        { gasPrice: this.config.gasPrice, gasLimit: this.config.gasLimitFlash }
      );

      this.log(`📤 Flash tx sent: ${tx.hash}`);
      const receipt = await tx.wait();

      if (receipt.status === 0) {
        this.log(`❌ Flash tx reverted (no profit on-chain) — gas only lost`, 'warn');
        return;
      }

      this.log(`✅ Flash arb confirmed: block ${receipt.blockNumber}`);

      // Law V — Kaprekar split: 60% reinvest / 25% founder / 15% burn
      const profitBNB  = parseFloat(opp.netProfitBNB);
      const profitUSD  = opp.netProfitUSD;
      const founderUSD = profitUSD * this.config.splitFounder;
      const burnBNB    = profitBNB * this.config.splitBurn;

      this.stats.tradesExecuted++;
      this.stats.profitBNB        += profitBNB;
      this.stats.profitUSD        += profitUSD;
      this.stats.founderPocketUSD += founderUSD;
      this.stats.reinvestedUSD    += profitUSD * this.config.splitReinvest;
      this.stats.lastTrade = {
        time:      new Date().toISOString(),
        txHash:    receipt.hash,
        amountBNB: opp.flashAmountBNB,
        profitUSD: profitUSD.toFixed(4),
        block:     receipt.blockNumber,
      };

      // Persist to profit log (Law V)
      this._logProfit({ ...opp, txHash: receipt.hash, block: receipt.blockNumber });

      // Law V — 15% burn: buy KENO on PancakeSwap and send to dead address
      if (burnBNB > 0.0001) await this._burnKeno(burnBNB);

      this.sendTelegramAlert(
        `⚡ <b>Flash Orb Bot — Trade Executed!</b>\n\n` +
        `Amount: <b>${opp.flashAmountBNB} BNB</b> flash loan\n` +
        `Spread: <b>${opp.spread}%</b>\n` +
        `Net profit: <b>+$${profitUSD.toFixed(3)}</b>\n\n` +
        `📐 Kaprekar Split (Law V):\n` +
        `  ♻️ Reinvest (60%): +$${(profitUSD * 0.6).toFixed(3)}\n` +
        `  💰 Your pocket (25%): +$${founderUSD.toFixed(3)}\n` +
        `  🔥 KENO burn (15%): $${(profitUSD * 0.15).toFixed(3)}\n\n` +
        `<a href="https://bscscan.com/tx/${receipt.hash}">View on BSCScan</a>`
      );

      const totalTrades = this.stats.tradesExecuted;
      const totalUSD    = this.stats.profitUSD.toFixed(2);
      this.log(`💰 Flash profit: +$${profitUSD.toFixed(3)} | Total: $${totalUSD} (${totalTrades} trades)`);

    } catch (e) {
      this.log(`❌ Flash execution failed: ${e.message}`, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Law V — 15% KENOAutoBurn: buy KENO → send to 0x...dead
  //  Skipped until KENO/WBNB pool is re-added post-PinkSale.
  //  Profit accumulates in BNB in the meantime.
  // ═══════════════════════════════════════════════════════════════════════
  async _burnKeno(burnBNB) {
    // Check if KENO/WBNB pair exists before attempting burn
    try {
      const FACTORY_ABI = ['function getPair(address,address) view returns (address)'];
      const factory = new ethers.Contract(
        '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', FACTORY_ABI, this.provider
      );
      const pair = await factory.getPair(KENO, WBNB);
      if (pair === '0x0000000000000000000000000000000000000000') {
        this.log(`⏭ KENO burn skipped — pool not yet live (PinkSale pre-launch). 15% accumulates in BNB.`);
        return;
      }
    } catch (_) {
      this.log(`⏭ KENO burn skipped — pool check failed. 15% stays in BNB.`);
      return;
    }

    try {
      const DEAD = '0x000000000000000000000000000000000000dEaD';
      const router = new ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, this.wallet);
      const burnWei = ethers.parseEther(burnBNB.toFixed(18));
      const outs = await router.getAmountsOut(burnWei, [WBNB, KENO]);
      const minKeno = outs[outs.length - 1] * 95n / 100n;
      const deadline = Math.floor(Date.now() / 1000) + 60;

      const tx = await router.swapExactETHForTokens(
        minKeno, [WBNB, KENO], DEAD, deadline,
        { value: burnWei, gasPrice: this.config.gasPrice, gasLimit: this.config.gasLimitBurn }
      );
      const receipt = await tx.wait();
      const kenoAmt = parseFloat(ethers.formatEther(minKeno));
      this.stats.kenoBurned += kenoAmt;
      this.log(`🔥 KENO burn: ${kenoAmt.toLocaleString()} KENO → 0x...dead (Tx: ${receipt.hash})`);
    } catch (e) {
      this.log(`⚠️ KENO burn failed (non-critical): ${e.message}`, 'warn');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Law V — Treasury Mandate: profit log
  // ═══════════════════════════════════════════════════════════════════════
  _logProfit(opp) {
    try {
      let data = { trades: [], totalProfitUSD: 0, totalProfitBNB: 0, count: 0 };
      if (fs.existsSync(PROFIT_LOG)) {
        try { data = JSON.parse(fs.readFileSync(PROFIT_LOG, 'utf8')); } catch (_) {}
      }
      data.trades.push({
        time:         opp.time,
        txHash:       opp.txHash,
        block:        opp.block,
        amountBNB:    opp.flashAmountBNB,
        spread:       opp.spread,
        grossBNB:     opp.grossProfitBNB,
        netBNB:       opp.netProfitBNB,
        netUSD:       opp.netProfitUSD.toFixed(4),
        kaprekarSplit: opp.kaprekarSplit,
      });
      data.totalProfitUSD = (parseFloat(data.totalProfitUSD) + opp.netProfitUSD).toFixed(4);
      data.totalProfitBNB = (parseFloat(data.totalProfitBNB) + parseFloat(opp.netProfitBNB)).toFixed(8);
      data.count = data.trades.length;
      fs.writeFileSync(PROFIT_LOG, JSON.stringify(data, null, 2));
    } catch (e) {
      this.log(`⚠️ Profit log write failed: ${e.message}`, 'warn');
    }
  }

  getProfitLog() {
    try {
      if (fs.existsSync(PROFIT_LOG)) return JSON.parse(fs.readFileSync(PROFIT_LOG, 'utf8'));
    } catch (_) {}
    return { trades: [], totalProfitUSD: 0, totalProfitBNB: 0, count: 0 };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  API surface
  // ═══════════════════════════════════════════════════════════════════════
  async getWalletInfo() {
    try {
      const bnbBal  = await this.provider.getBalance(this.wallet.address);
      const kenoC   = new ethers.Contract(KENO, ERC20_ABI, this.provider);
      const kenoBal = await kenoC.balanceOf(this.wallet.address);
      return {
        address: this.wallet.address,
        bnb:  parseFloat(ethers.formatEther(bnbBal)).toFixed(6),
        keno: parseFloat(ethers.formatEther(kenoBal)).toLocaleString(),
        bnbUSD: (parseFloat(ethers.formatEther(bnbBal)) * this.config.bnbPriceUSD).toFixed(2),
      };
    } catch (_) {
      return { address: this.wallet?.address, bnb: '?', keno: '?', bnbUSD: '?' };
    }
  }

  getStatus() {
    const upSec = Math.floor((Date.now() - this.stats.uptime) / 1000);
    return {
      running:         this.running,
      paused:          this.paused,
      uptimeSeconds:   upSec,
      stats: {
        ...this.stats,
        profitBNB:        this.stats.profitBNB.toFixed(8),
        profitUSD:        this.stats.profitUSD.toFixed(4),
        founderPocketUSD: this.stats.founderPocketUSD.toFixed(4),
        reinvestedUSD:    this.stats.reinvestedUSD.toFixed(4),
        kenoBurned:       this.stats.kenoBurned.toLocaleString(),
      },
      recentLogs:      this.logs.slice(0, 30),
      lastOpportunity: this.stats.lastOpportunity,
      config: {
        autoExecute:      this.config.autoExecute,
        minProfitUSD:     this.config.minProfitUSD,
        scanIntervalSec:  this.config.checkIntervalMs / 1000,
        flashAmountsBNB:  FLASH_AMOUNTS_BNB,
        bnbPriceUSD:      this.config.bnbPriceUSD.toFixed(2),
        kaprekarSplit:    '60% reinvest / 25% founder / 15% burn',
      },
      profitLog: this.getProfitLog(),
    };
  }

  updateConfig(updates) {
    const allowed = ['autoExecute', 'minProfitUSD', 'checkIntervalMs'];
    for (const [k, v] of Object.entries(updates)) {
      if (allowed.includes(k)) {
        this.config[k] = v;
        this.log(`⚙️ Config updated: ${k} = ${v}`);
      }
    }
    if (updates.checkIntervalMs) {
      clearInterval(this._timer);
      this._timer = setInterval(() => this._scan(), this.config.checkIntervalMs);
    }
    return { ok: true, config: this.config };
  }

  sendTelegramAlert(msg) {
    const token  = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.FAL_ALERT_CHAT_ID;
    if (!token || !chatId) return;
    try {
      const payload = JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' });
      const opts = {
        hostname: 'api.telegram.org',
        path:     `/bot${token}/sendMessage`,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      };
      const r = https.request(opts);
      r.write(payload);
      r.end();
    } catch (_) {}
  }

  log(msg, level = 'info') {
    const entry = { time: new Date().toISOString(), msg, level };
    this.logs.unshift(entry);
    if (this.logs.length > 200) this.logs.pop();
    const prefix = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🟢';
    console.log(`[FlashOrb] ${prefix} ${msg}`);
  }
}

module.exports = KenoFlashOrbBot;

if (require.main === module) {
  const bot = new KenoFlashOrbBot();
  async function tryStart() {
    try {
      const result = await bot.start();
      if (!result.ok) {
        console.error('[FlashOrb] Start failed, retrying in 90s:', result.msg);
        setTimeout(tryStart, 90_000);
      }
    } catch (err) {
      console.error('[FlashOrb] Startup error, retrying in 90s:', err.message);
      setTimeout(tryStart, 90_000);
    }
  }
  tryStart();
  process.on('SIGTERM', () => { bot.stop(); process.exit(0); });
  process.on('SIGINT',  () => { bot.stop(); process.exit(0); });
}

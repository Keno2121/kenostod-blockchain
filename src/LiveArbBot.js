const { ethers } = require('ethers');
const https = require('https');

// ── Deployed UTL contracts (BSC Mainnet) ──────────────────────────────────
const FLASH_ARB_LOAN2    = '0x24428f4c0A1FCEd87e84241F103f4aa4FFaD51Be';

const PANCAKE_ROUTER  = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const BISWAP_ROUTER   = '0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8';
const UTL_FARM        = '0x37D320A881CcF553F6cd757f0A33743ae01A2644'; // v1.1 active contract

const FLASH_ARB_ABI = [
  'function quoteBest(uint256 testAmountBNB) external view returns (bool profitable, address sellRouter, address buyRouter, address repayPair, uint256 grossProfitBNB, uint256 repayAmountWBNB)',
  'function executeFlashArb(address borrowPair, address sellRouter, address buyRouter, address stableToken, uint256 borrowAmountWBNB) external',
];

const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const USDT = '0x55d398326f99059fF775485246999027B3197955';
const BUSD = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
const ETH  = '0x2170Ed0880ac9A755fd29B2688956BD959F933F8'; // WETH on BSC
const BTCB = '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c'; // BTCB on BSC
const CAKE = '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82'; // CAKE on BSC
const KENO = '0x48bb049afe50b050b458624dc6233acd51024ab4'; // KENO v2 — added back post-PinkSale

// ── Multi-pair scan list — all use BNB as capital, round-trip back to BNB ──
// KENO commented out until pool is re-added post-PinkSale launch
const ARB_PAIRS = [
  { name: 'WBNB/USDT',  token: USDT,  bnbAmount: '0.10' },
  { name: 'WBNB/BUSD',  token: BUSD,  bnbAmount: '0.10' },
  { name: 'WBNB/ETH',   token: ETH,   bnbAmount: '0.10' },
  { name: 'WBNB/BTCB',  token: BTCB,  bnbAmount: '0.10' },
  { name: 'WBNB/CAKE',  token: CAKE,  bnbAmount: '0.10' },
  // { name: 'WBNB/KENO', token: KENO,  bnbAmount: '0.10' }, // re-enable post-PinkSale
];

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

const FARM_ABI = [
  'function stake(uint256 amount) external',
  'function unstake(uint256 amount) external',
  'function harvest() external',
  'function pendingRewards(address account) external view returns (uint256)',
  'function aprBasisPoints() external view returns (uint256)',
  'function userInfo(address) external view returns (uint256 staked, uint256 rewardPerTokenPaid, uint256 pendingHarvest)',
  'function totalStaked() external view returns (uint256)',
  'function rewardBalance() external view returns (uint256)',
  'function rewardRate() external view returns (uint256)',
  'function lpToken() external view returns (address)',
  'function paused() external view returns (bool)'
];

const BSC_RPC_ENDPOINTS = [
  'https://bsc-rpc.publicnode.com',
  'https://bsc.rpc.blxrbdn.com',
  'https://rpc-bsc.48.club',
];

class LiveArbBot {
  constructor() {
    this.provider = null;
    this.wallet   = null;
    this.running  = false;
    this.paused   = false;

    this.config = {
      autoExecute:       false,         // SCAN ONLY — no transactions until private mempool is live
      minProfitUSD:     0.25,          // $0.25 minimum — only log real opportunities
      arbTradeAmountBNB: '0.10',       // 0.10 BNB per trade — lower break-even spread to 0.26%
      kenoVolBNB:        '0.001',
      checkIntervalMs:   15_000,
      kenoVolIntervalMs: 3_600_000,
      maxSlippage:       0.02,
      gasPrice:          ethers.parseUnits('1', 'gwei'),  // BSC accepts 1 gwei — cuts gas cost 5x
      gasLimitArb:       130_000,      // realistic single-swap gas on BSC
      gasLimitVol:       130_000,
    };

    this.stats = {
      tradesExecuted:   0,
      profitBNB:        0,
      profitUSD:        0,
      lastCheck:        null,
      lastOpportunity:  null,
      lastTrade:        null,
      uptime:           Date.now(),
    };

    this.logs = [];
    this.opportunities = [];
    this._priceTimer = null;
  }

  async init() {
    const key = process.env.WALLET_PRIVATE_KEY;
    if (!key) {
      this.log('❌ WALLET_PRIVATE_KEY not set — bot cannot start', 'error');
      return false;
    }
    for (const rpc of BSC_RPC_ENDPOINTS) {
      try {
        this.provider = new ethers.JsonRpcProvider(rpc);
        await this.provider.getBlockNumber();
        this.wallet = new ethers.Wallet(key, this.provider);
        this.flashArb = new ethers.Contract(FLASH_ARB_LOAN2, FLASH_ARB_ABI, this.wallet);
        this.log(`✅ Connected to BSC via ${rpc}`);
        this.log(`👛 Wallet: ${this.wallet.address}`);
        this.log(`⚡ FlashArbLoan2: ${FLASH_ARB_LOAN2}`);
        return true;
      } catch (_) {
        continue;
      }
    }
    this.log('❌ All BSC RPC endpoints failed', 'error');
    return false;
  }

  async start() {
    if (this.running) return { ok: false, msg: 'Already running' };
    const ready = await this.init();
    if (!ready) return { ok: false, msg: 'Wallet/RPC init failed' };

    this.running = true;
    this.log(`🤖 Multi-Pair Arb Bot STARTED — scanning ${ARB_PAIRS.length} pairs on PancakeSwap ↔ BiSwap every 15s`);
    this.log(`📊 Pairs: ${ARB_PAIRS.map(p => p.name).join(' | ')}`);

    this._priceTimer = setInterval(() => this._priceLoop(), this.config.checkIntervalMs);
    this._priceLoop();
    return { ok: true, msg: `Bot started — scanning ${ARB_PAIRS.length} pairs` };
  }

  stop() {
    this.running = false;
    clearInterval(this._priceTimer);
    this.log('⏹ Multi-Pair Arb Bot stopped');
    return { ok: true };
  }

  pause()  { this.paused = true;  this.log('⏸ Bot paused'); }
  resume() { this.paused = false; this.log('▶️ Bot resumed'); }

  async _priceLoop() {
    if (!this.running || this.paused) return;
    try {
      const opp = await this.detectOpportunity();
      this.stats.lastCheck = new Date().toISOString();

      if (opp) {
        this.opportunities.unshift(opp);
        if (this.opportunities.length > 50) this.opportunities.pop();
        this.stats.lastOpportunity = opp;

        if (opp.netProfitUSD >= this.config.minProfitUSD) {
          this.log(`⚡ [${opp.pair}] Profitable: ${opp.spread}% spread → ~$${opp.netProfitUSD.toFixed(3)} net profit`);
          if (!this.config.autoExecute) {
            this.log(`🔒 AUTO-EXECUTE DISABLED — opportunity logged but no trade fired.`);
          } else if (opp.flash) {
            await this.executeFlashArb(opp);
          } else {
            await this.executeArb(opp);
          }
        } else {
          this.log(`👀 [${opp.pair}] Spread ${opp.spread}% — below threshold ($${opp.netProfitUSD.toFixed(3)})`);
        }
      } else {
        this.log(`🔍 Scanned ${ARB_PAIRS.length} pairs — no opportunity (${new Date().toLocaleTimeString()})`);
      }
    } catch (e) {
      this.log(`⚠️ Price loop error: ${e.message}`, 'warn');
    }
  }

  async getAmountsOut(routerAddr, amountIn, path) {
    const router = new ethers.Contract(routerAddr, ROUTER_ABI, this.provider);
    try {
      const amounts = await router.getAmountsOut(amountIn, path);
      return amounts[amounts.length - 1];
    } catch (_) {
      return 0n;
    }
  }

  async _checkPair(tradeAmountBNB, stableToken, pairName) {
    const [pancakeOut, biswapOut] = await Promise.all([
      this.getAmountsOut(PANCAKE_ROUTER, tradeAmountBNB, [WBNB, stableToken]),
      this.getAmountsOut(BISWAP_ROUTER,  tradeAmountBNB, [WBNB, stableToken]),
    ]);
    if (!pancakeOut || !biswapOut || pancakeOut === 0n || biswapOut === 0n) return null;

    const pancakeUSD = parseFloat(ethers.formatUnits(pancakeOut, 18));
    const biswapUSD  = parseFloat(ethers.formatUnits(biswapOut,  18));
    const tradeBNB   = parseFloat(this.config.arbTradeAmountBNB);

    let buyDex, sellDex, buyRouter, sellRouter, buyOut, sellOut;
    if (biswapUSD > pancakeUSD) {
      buyDex = 'PancakeSwap'; sellDex = 'BiSwap';
      buyRouter = PANCAKE_ROUTER; sellRouter = BISWAP_ROUTER;
      buyOut = pancakeUSD; sellOut = biswapUSD;
    } else {
      buyDex = 'BiSwap'; sellDex = 'PancakeSwap';
      buyRouter = BISWAP_ROUTER; sellRouter = PANCAKE_ROUTER;
      buyOut = biswapUSD; sellOut = pancakeUSD;
    }

    const grossProfit = sellOut - buyOut;
    const spread = ((grossProfit / buyOut) * 100).toFixed(3);
    if (parseFloat(spread) < 0.1) return null;

    const bnbPriceUSD = (pancakeUSD + biswapUSD) / 2 / tradeBNB;
    const gasPriceGwei = parseFloat(ethers.formatUnits(this.config.gasPrice, 'gwei'));
    const gasCostBNB   = (this.config.gasLimitArb * 2 * gasPriceGwei) / 1e9;
    const gasCostUSD   = gasCostBNB * bnbPriceUSD;
    const netProfitUSD = grossProfit - gasCostUSD;

    return {
      time: new Date().toISOString(),
      pair: pairName,
      stableToken,
      buyDex, sellDex, buyRouter, sellRouter,
      tradeBNB,
      pancakeUSD: pancakeUSD.toFixed(4),
      biswapUSD:  biswapUSD.toFixed(4),
      grossProfitUSD: grossProfit.toFixed(4),
      netProfitUSD,
      spread,
      executable: netProfitUSD >= this.config.minProfitUSD
    };
  }

  async detectOpportunity() {
    const tradeAmountBNB = ethers.parseEther(this.config.arbTradeAmountBNB);

    // ── Primary: FlashArbLoan2.quoteBest() — scans 4 DEXes × 4 pairs for free ──
    if (this.flashArb) {
      try {
        const q = await this.flashArb.quoteBest(tradeAmountBNB);
        if (q.profitable) {
          const grossBNB     = parseFloat(ethers.formatEther(q.grossProfitBNB));
          const gasCostBNB   = (500_000 * 0.05) / 1e9;
          const bnbPrice     = 600;
          const netProfitUSD = (grossBNB - gasCostBNB) * bnbPrice;
          return {
            time: new Date().toISOString(),
            pair: 'FLASH (4-DEX multi-pair)',
            flash: true,
            sellRouter:      q.sellRouter,
            buyRouter:       q.buyRouter,
            repayPair:       q.repayPair,
            borrowAmountBNB: this.config.arbTradeAmountBNB,
            grossProfitBNB:  grossBNB.toFixed(6),
            netProfitUSD,
            spread: ((grossBNB / parseFloat(this.config.arbTradeAmountBNB)) * 100).toFixed(3),
            executable: netProfitUSD >= this.config.minProfitUSD
          };
        }
      } catch (e) {
        this.log(`⚠️ quoteBest() error: ${e.message}`, 'warn');
      }
    }

    // ── Multi-pair manual scan — all 5 pairs in parallel ──────────────────
    const results = await Promise.all(
      ARB_PAIRS.map(p => this._checkPair(ethers.parseEther(p.bnbAmount), p.token, p.name))
    );

    const opps = results.filter(Boolean);
    if (opps.length === 0) return null;

    // Log all pairs with any spread for transparency
    for (const o of opps) {
      if (parseFloat(o.spread) >= 0.05) {
        this.log(`📊 [${o.pair}] ${o.buyDex}→${o.sellDex}: ${o.spread}% spread | net $${o.netProfitUSD.toFixed(4)}`);
      }
    }

    // Return the most profitable opportunity
    return opps.reduce((best, o) => o.netProfitUSD > best.netProfitUSD ? o : best);
  }

  async executeFlashArb(opp) {
    try {
      this.log(`⚡ Pre-flight simulation for flash arb...`);
      const borrowAmt = ethers.parseEther(opp.borrowAmountBNB);

      // ── Pre-flight: simulate before sending — zero gas wasted on reverts ──
      try {
        await this.flashArb.executeFlashArb.estimateGas(
          opp.repayPair, opp.sellRouter, opp.buyRouter, USDT, borrowAmt
        );
      } catch (simErr) {
        this.log(`⛔ Pre-flight failed — opportunity gone (front-run/price moved). No gas spent. ${simErr.message?.slice(0, 80)}`, 'warn');
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
        { gasPrice: this.config.gasPrice, gasLimit: 500_000 }
      );
      this.log(`📤 Flash arb tx sent: ${tx.hash}`);
      const receipt = await tx.wait();
      this.log(`✅ Flash arb confirmed: block ${receipt.blockNumber}`);
      this.stats.tradesExecuted++;
      this.stats.profitBNB  += parseFloat(opp.grossProfitBNB);
      this.stats.profitUSD  += opp.netProfitUSD;
      this.stats.lastTrade   = new Date().toISOString();
      this.sendTelegramAlert(
        `⚡ <b>Flash Arb Executed! (LiveArbBot)</b>\n\n` +
        `Route: ${opp.spread}% spread | Zero capital used\n` +
        `Est. profit: ~$${opp.netProfitUSD.toFixed(3)}\n` +
        `<a href="https://bscscan.com/tx/${tx.hash}">View on BSCScan</a>`
      );
    } catch (e) {
      this.log(`❌ Flash arb failed: ${e.message}`, 'error');
    }
  }

  async executeArb(opp) {
    try {
      const bnbBalance = await this.provider.getBalance(this.wallet.address);
      const tradeWei = ethers.parseEther(this.config.arbTradeAmountBNB);
      const gasBuffer = ethers.parseEther('0.005');

      if (bnbBalance < tradeWei + gasBuffer) {
        this.log(`⚠️ Insufficient BNB for arb (have ${ethers.formatEther(bnbBalance)} BNB, need ${parseFloat(this.config.arbTradeAmountBNB) + 0.005})`, 'warn');
        return;
      }

      const stableAddr = opp.stableToken || USDT;
      const stableName = stableAddr === BUSD ? 'BUSD' : 'USDT';

      // ── On-chain profit simulation (fresh quotes at execution time) ──────
      const simBuyRouter  = new ethers.Contract(opp.buyRouter,  ROUTER_ABI, this.provider);
      const simSellRouter = new ethers.Contract(opp.sellRouter, ROUTER_ABI, this.provider);
      const [, simStableOut] = await simBuyRouter.getAmountsOut(tradeWei, [WBNB, stableAddr]);
      const [, simBnbBack]   = await simSellRouter.getAmountsOut(simStableOut, [stableAddr, WBNB]);
      const gasCostBNB = (this.config.gasLimitArb * 2 * parseFloat(ethers.formatUnits(this.config.gasPrice, 'gwei'))) / 1e9;
      const gasCostWei = ethers.parseEther(gasCostBNB.toFixed(18));
      const simProfitBNB = (Number(simBnbBack) - Number(tradeWei) - Number(gasCostWei)) / 1e18;
      if (simProfitBNB < 0.0001) {
        this.log(`⛔ On-chain sim: profit ${simProfitBNB.toFixed(6)} BNB after gas — not worth executing`, 'warn');
        return;
      }
      this.log(`✅ On-chain sim: +${simProfitBNB.toFixed(6)} BNB profit — proceeding`);

      const deadline = Math.floor(Date.now() / 1000) + 60;
      // leg-1 min: 99% of simulated stable output (tight — deep pools)
      const minOut    = BigInt(Math.floor(Number(simStableOut) * 0.99));
      // leg-2 min: must return AT LEAST trade amount + gas cost (no loss allowed)
      const minBNBOut = tradeWei + gasCostWei + ethers.parseEther('0.0001'); // trade + gas + $0.06 min profit

      const buyRouter = new ethers.Contract(opp.buyRouter, ROUTER_ABI, this.wallet);

      this.log(`🔄 Step 1: Buy ${stableName} on ${opp.buyDex} with ${this.config.arbTradeAmountBNB} BNB [${opp.pair}]`);
      const buyTx = await buyRouter.swapExactETHForTokens(
        minOut,
        [WBNB, stableAddr],
        this.wallet.address,
        deadline,
        { value: tradeWei, gasPrice: this.config.gasPrice, gasLimit: this.config.gasLimitArb }
      );
      const buyReceipt = await buyTx.wait();
      this.log(`✅ Buy tx: ${buyReceipt.hash}`);

      const stableContract = new ethers.Contract(stableAddr, ERC20_ABI, this.wallet);
      const stableBal      = await stableContract.balanceOf(this.wallet.address);

      const currentAllowance = await stableContract.allowance(this.wallet.address, opp.sellRouter);
      if (currentAllowance < stableBal) {
        const approveTx = await stableContract.approve(opp.sellRouter, ethers.MaxUint256, { gasPrice: this.config.gasPrice });
        await approveTx.wait();
      }

      const sellRouter = new ethers.Contract(opp.sellRouter, ROUTER_ABI, this.wallet);
      this.log(`🔄 Step 2: Sell ${stableName} on ${opp.sellDex} for BNB`);
      const sellTx = await sellRouter.swapExactTokensForETH(
        stableBal,
        minBNBOut,
        [stableAddr, WBNB],
        this.wallet.address,
        deadline,
        { gasPrice: this.config.gasPrice, gasLimit: this.config.gasLimitArb }
      );
      const sellReceipt = await sellTx.wait();
      this.log(`✅ Sell tx: ${sellReceipt.hash}`);

      this.stats.tradesExecuted++;
      this.stats.profitUSD += parseFloat(opp.netProfitUSD);
      this.stats.lastTrade = {
        time: new Date().toISOString(),
        buyTx: buyReceipt.hash,
        sellTx: sellReceipt.hash,
        netProfitUSD: opp.netProfitUSD,
        spread: opp.spread
      };

      this.log(`💰 Arb complete! Est. net profit: $${opp.netProfitUSD.toFixed(3)}`);
      this.sendTelegramAlert(
        `🔄 <b>Direct Arb Executed! (LiveArbBot)</b>\n\n` +
        `Pair: ${opp.pair} | ${opp.buyDex} → ${opp.sellDex}\n` +
        `Spread: <b>${opp.spread}%</b> | Amount: ${this.config.arbTradeAmountBNB} BNB\n` +
        `Est. profit: ~$${opp.netProfitUSD.toFixed(3)}\n` +
        `<a href="https://bscscan.com/tx/${sellReceipt.hash}">View on BSCScan</a>`
      );
    } catch (e) {
      this.log(`❌ Arb execution failed: ${e.message}`, 'error');
    }
  }

  // KENO volume generation disabled — pool removed for PinkSale compliance.
  // Will be re-enabled post-launch when KENO/WBNB pool is re-added to PancakeSwap.
  // async generateKenoVolume() { ... }

  async getWalletInfo() {
    try {
      const bnbBal = await this.provider.getBalance(this.wallet.address);
      const pairsScanning = ARB_PAIRS.map(p => p.name).join(', ');
      return {
        address:      this.wallet.address,
        bnb:          parseFloat(ethers.formatEther(bnbBal)).toFixed(5),
        pairsScanning,
        pairCount:    ARB_PAIRS.length,
      };
    } catch (_) {
      return { address: this.wallet?.address, bnb: '?', pairCount: ARB_PAIRS.length };
    }
  }

  async getFarmStatus() {
    try {
      // Use a fresh read-only provider if bot hasn't started yet
      const readProvider = this.provider || new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
      const farm = new ethers.Contract(UTL_FARM, FARM_ABI, readProvider);
      const addr = this.wallet ? this.wallet.address : ethers.ZeroAddress;

      const [userInfo, pending, totalStaked, rewardBal, rewardRate, apr, farmPaused, lpAddr] = await Promise.all([
        farm.userInfo(addr),
        farm.pendingRewards(addr),
        farm.totalStaked(),
        farm.rewardBalance(),
        farm.rewardRate(),
        farm.aprBasisPoints(),
        farm.paused(),
        farm.lpToken()
      ]);

      let lpWalletBal = 0n;
      if (this.wallet) {
        const lp = new ethers.Contract(lpAddr, ERC20_ABI, readProvider);
        lpWalletBal = await lp.balanceOf(this.wallet.address);
      }

      return {
        ok: true,
        farmAddress:    UTL_FARM,
        lpTokenAddress: lpAddr,
        farmPaused,
        totalStaked:    ethers.formatEther(totalStaked),
        rewardBalance:  ethers.formatEther(rewardBal),
        rewardRatePerSec: ethers.formatEther(rewardRate),
        aprPercent:     (Number(apr) / 100).toFixed(2),
        user: {
          stakedLP:      ethers.formatEther(userInfo.staked),
          pendingKENO:   ethers.formatEther(pending),
          walletLP:      ethers.formatEther(lpWalletBal)
        }
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async stakeLPTokens(amountEther) {
    if (!this.wallet) throw new Error('Bot not started');
    const farm    = new ethers.Contract(UTL_FARM, FARM_ABI, this.wallet);
    const lpAddr  = await farm.lpToken();
    const lp      = new ethers.Contract(lpAddr, ERC20_ABI, this.wallet);
    const amount  = amountEther === 'all'
      ? await lp.balanceOf(this.wallet.address)
      : ethers.parseEther(amountEther.toString());

    if (amount === 0n) throw new Error('No LP tokens in wallet');

    this.log(`🌾 Staking ${ethers.formatEther(amount)} LP tokens into UTLFarm...`);

    const allowance = await lp.allowance(this.wallet.address, UTL_FARM);
    if (allowance < amount) {
      const approveTx = await lp.approve(UTL_FARM, ethers.MaxUint256, { gasPrice: this.config.gasPrice });
      await approveTx.wait();
      this.log('✅ LP token approved for UTLFarm');
    }

    const tx = await farm.stake(amount, { gasPrice: this.config.gasPrice, gasLimit: 250_000 });
    const receipt = await tx.wait();
    this.log(`✅ Staked! Tx: ${receipt.hash}`);
    return { ok: true, txHash: receipt.hash, amount: ethers.formatEther(amount) };
  }

  async harvestFarm() {
    if (!this.wallet) throw new Error('Bot not started');
    const farm    = new ethers.Contract(UTL_FARM, FARM_ABI, this.wallet);
    const pending = await farm.pendingRewards(this.wallet.address);

    if (pending === 0n) {
      this.log('⚠️ No KENO rewards to harvest yet');
      return { ok: false, msg: 'No pending rewards' };
    }

    this.log(`🌿 Harvesting ${ethers.formatEther(pending)} KENO from UTLFarm...`);
    const tx = await farm.harvest({ gasPrice: this.config.gasPrice, gasLimit: 200_000 });
    const receipt = await tx.wait();
    this.log(`✅ Harvested ${ethers.formatEther(pending)} KENO! Tx: ${receipt.hash}`);
    return { ok: true, txHash: receipt.hash, kenoHarvested: ethers.formatEther(pending) };
  }

  async unstakeLPTokens(amountEther) {
    if (!this.wallet) throw new Error('Bot not started');
    const farm   = new ethers.Contract(UTL_FARM, FARM_ABI, this.wallet);
    const info   = await farm.userInfo(this.wallet.address);
    const amount = amountEther === 'all' ? info.staked : ethers.parseEther(amountEther.toString());

    if (amount === 0n) throw new Error('No LP tokens staked');

    this.log(`🔓 Unstaking ${ethers.formatEther(amount)} LP tokens from UTLFarm...`);
    const tx = await farm.unstake(amount, { gasPrice: this.config.gasPrice, gasLimit: 250_000 });
    const receipt = await tx.wait();
    this.log(`✅ Unstaked! (auto-harvested any pending KENO) Tx: ${receipt.hash}`);
    return { ok: true, txHash: receipt.hash, amount: ethers.formatEther(amount) };
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
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
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
    console.log(`[LiveArbBot] ${prefix} ${msg}`);
  }

  getStatus() {
    return {
      running:         this.running,
      paused:          this.paused,
      uptimeSeconds:   Math.floor((Date.now() - this.stats.uptime) / 1000),
      stats:           this.stats,
      recentLogs:      this.logs.slice(0, 30),
      lastOpportunity: this.stats.lastOpportunity,
      config: {
        checkIntervalSec:    this.config.checkIntervalMs / 1000,
        kenoVolIntervalMin:  this.config.kenoVolIntervalMs / 60000,
        minProfitUSD:        this.config.minProfitUSD,
        arbTradeAmountBNB:   this.config.arbTradeAmountBNB,
        kenoVolBNB:          this.config.kenoVolBNB,
      }
    };
  }
}

module.exports = LiveArbBot;

if (require.main === module) {
  process.on('unhandledRejection', (err) => {
    console.error('[LiveArbBot] Unhandled rejection (process stays alive):', err && err.message);
  });
  const bot = new LiveArbBot();
  async function tryStart() {
    try {
      const result = await bot.start();
      if (!result.ok) {
        console.error('[LiveArbBot] Start failed, retrying in 90s:', result.msg);
        setTimeout(tryStart, 90_000);
      }
    } catch (err) {
      console.error('[LiveArbBot] Startup error, retrying in 90s:', err.message);
      setTimeout(tryStart, 90_000);
    }
  }
  tryStart();
  process.on('SIGTERM', () => { bot.stop(); process.exit(0); });
  process.on('SIGINT',  () => { bot.stop(); process.exit(0); });
}

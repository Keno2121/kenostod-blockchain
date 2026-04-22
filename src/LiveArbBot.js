const { ethers } = require('ethers');

const PANCAKE_ROUTER  = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const BISWAP_ROUTER   = '0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8';
const UTL_FARM        = '0xaf991D0A2b4Ab522Adc6766fc0FdCbAfFA541094';

const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const USDT = '0x55d398326f99059fF775485246999027B3197955';
const BUSD = '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56';
const KENO = '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E';

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
  'https://bsc-dataseed1.binance.org/',
  'https://bsc-dataseed2.binance.org/',
  'https://bsc-dataseed3.binance.org/'
];

class LiveArbBot {
  constructor() {
    this.provider = null;
    this.wallet   = null;
    this.running  = false;
    this.paused   = false;

    this.config = {
      minProfitUSD:     0.05,          // lowered — gas at 1 gwei is ~$0.16, needs $0.05 net above that
      arbTradeAmountBNB: '0.08',       // increased from 0.05 → bigger gross profit per spread
      kenoVolBNB:        '0.001',
      checkIntervalMs:   15_000,
      kenoVolIntervalMs: 3_600_000,
      maxSlippage:       0.02,
      gasPrice:          ethers.parseUnits('1', 'gwei'),  // BSC accepts 1 gwei — cuts gas cost 5x
      gasLimitArb:       130_000,      // realistic single-swap gas on BSC
      gasLimitVol:       130_000,
    };

    this.stats = {
      tradesExecuted:       0,
      profitBNB:            0,
      profitUSD:            0,
      kenoSwapsExecuted:    0,
      kenoVolumeUSD:        0,
      lastCheck:            null,
      lastOpportunity:      null,
      lastTrade:            null,
      uptime:               Date.now(),
    };

    this.logs = [];
    this.opportunities = [];
    this._priceTimer = null;
    this._volTimer   = null;
  }

  async init() {
    const key = process.env.NEW_WALLET_PRIVATE_KEY;
    if (!key) {
      this.log('❌ NEW_WALLET_PRIVATE_KEY not set — bot cannot start', 'error');
      return false;
    }
    for (const rpc of BSC_RPC_ENDPOINTS) {
      try {
        this.provider = new ethers.JsonRpcProvider(rpc);
        await this.provider.getBlockNumber();
        this.wallet = new ethers.Wallet(key, this.provider);
        this.log(`✅ Connected to BSC via ${rpc}`);
        this.log(`👛 Wallet: ${this.wallet.address}`);
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
    this.log('🤖 Live Arb Bot STARTED — monitoring BSC DEX prices');

    this._priceTimer = setInterval(() => this._priceLoop(), this.config.checkIntervalMs);
    this._volTimer   = setInterval(() => this._kenoVolLoop(), this.config.kenoVolIntervalMs);

    this._priceLoop();
    return { ok: true, msg: 'Bot started' };
  }

  stop() {
    this.running = false;
    clearInterval(this._priceTimer);
    clearInterval(this._volTimer);
    this.log('⏹ Live Arb Bot stopped');
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
          this.log(`⚡ Profitable opp: ${opp.spread}% spread → ~$${opp.netProfitUSD.toFixed(3)} net profit`);
          await this.executeArb(opp);
        } else {
          this.log(`👀 Spread ${opp.spread}% detected — below min profit threshold ($${opp.netProfitUSD.toFixed(3)} < $${this.config.minProfitUSD})`);
        }
      } else {
        this.log(`🔍 No arb opportunity (check ${new Date().toLocaleTimeString()})`);
      }
    } catch (e) {
      this.log(`⚠️ Price loop error: ${e.message}`, 'warn');
    }
  }

  async _kenoVolLoop() {
    if (!this.running || this.paused) return;
    try {
      await this.generateKenoVolume();
    } catch (e) {
      this.log(`⚠️ KENO volume error: ${e.message}`, 'warn');
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

    // Check both WBNB/USDT and WBNB/BUSD pairs simultaneously
    const [usdtOpp, busdOpp] = await Promise.all([
      this._checkPair(tradeAmountBNB, USDT, 'WBNB/USDT'),
      this._checkPair(tradeAmountBNB, BUSD, 'WBNB/BUSD'),
    ]);

    // Return the more profitable opportunity
    if (!usdtOpp && !busdOpp) return null;
    if (!usdtOpp) return busdOpp;
    if (!busdOpp) return usdtOpp;
    return usdtOpp.netProfitUSD >= busdOpp.netProfitUSD ? usdtOpp : busdOpp;
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

      const deadline = Math.floor(Date.now() / 1000) + 60;
      const minOut = BigInt(Math.floor(parseFloat(opp.pancakeUSD < opp.biswapUSD ? opp.pancakeUSD : opp.biswapUSD) * (1 - this.config.maxSlippage) * 1e18));

      const stableAddr = opp.stableToken || USDT;
      const stableName = stableAddr === BUSD ? 'BUSD' : 'USDT';
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
      const minBNBOut      = BigInt(Math.floor(parseFloat(this.config.arbTradeAmountBNB) * (1 - this.config.maxSlippage) * 1e18));

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
    } catch (e) {
      this.log(`❌ Arb execution failed: ${e.message}`, 'error');
    }
  }

  async generateKenoVolume() {
    try {
      const bnbBalance = await this.provider.getBalance(this.wallet.address);
      const volWei = ethers.parseEther(this.config.kenoVolBNB);
      const gasBuffer = ethers.parseEther('0.003');

      if (bnbBalance < volWei + gasBuffer) {
        this.log(`⚠️ Insufficient BNB for KENO volume trade`, 'warn');
        return;
      }

      const deadline = Math.floor(Date.now() / 1000) + 120;
      const router = new ethers.Contract(PANCAKE_ROUTER, ROUTER_ABI, this.wallet);

      const amountsOut = await this.getAmountsOut(PANCAKE_ROUTER, volWei, [WBNB, KENO]);
      const minKeno = amountsOut * 95n / 100n;

      this.log(`📊 Generating KENO volume: ${this.config.kenoVolBNB} BNB → KENO`);
      const buyTx = await router.swapExactETHForTokens(
        minKeno,
        [WBNB, KENO],
        this.wallet.address,
        deadline,
        { value: volWei, gasPrice: this.config.gasPrice, gasLimit: this.config.gasLimitVol }
      );
      const buyReceipt = await buyTx.wait();
      this.log(`✅ KENO buy tx: ${buyReceipt.hash}`);

      const kenoContract = new ethers.Contract(KENO, ERC20_ABI, this.wallet);
      const kenoBal = await kenoContract.balanceOf(this.wallet.address);

      if (kenoBal > 0n) {
        const currentAllowance = await kenoContract.allowance(this.wallet.address, PANCAKE_ROUTER);
        if (currentAllowance < kenoBal) {
          const approveTx = await kenoContract.approve(PANCAKE_ROUTER, ethers.MaxUint256, { gasPrice: this.config.gasPrice });
          await approveTx.wait();
        }

        const minBNB = volWei * 90n / 100n;
        const sellTx = await router.swapExactTokensForETH(
          kenoBal,
          minBNB,
          [KENO, WBNB],
          this.wallet.address,
          deadline,
          { gasPrice: this.config.gasPrice, gasLimit: this.config.gasLimitVol }
        );
        const sellReceipt = await sellTx.wait();
        this.log(`✅ KENO sell tx: ${sellReceipt.hash}`);
      }

      const kenoUSD = parseFloat(this.config.kenoVolBNB) * 600;
      this.stats.kenoSwapsExecuted++;
      this.stats.kenoVolumeUSD += kenoUSD * 2;
      this.log(`📈 KENO volume generated: ~$${(kenoUSD * 2).toFixed(2)} on DexScreener`);
    } catch (e) {
      this.log(`❌ KENO volume trade failed: ${e.message}`, 'error');
    }
  }

  async getWalletInfo() {
    try {
      const bnbBal = await this.provider.getBalance(this.wallet.address);
      const kenoContract = new ethers.Contract(KENO, ERC20_ABI, this.provider);
      const kenoBalance  = await kenoContract.balanceOf(this.wallet.address);
      return {
        address: this.wallet.address,
        bnb: parseFloat(ethers.formatEther(bnbBal)).toFixed(5),
        keno: parseFloat(ethers.formatEther(kenoBalance)).toLocaleString()
      };
    } catch (_) {
      return { address: this.wallet?.address, bnb: '?', keno: '?' };
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

/**
 * Diagnose why addLiquidityETH keeps reverting.
 * Simulates each step and captures revert reasons.
 */
require('dotenv').config();
const { ethers } = require('ethers');

const RPC          = process.env.BSC_RPC_PRIMARY || 'https://bsc-dataseed.binance.org/';
const KENO_ADDR    = '0x48bb049afe50b050b458624dc6233acd51024ab4';
const ROUTER_ADDR  = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const WBNB         = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const botRaw = process.env.BOT_WALLET_PRIVATE_KEY || '';
const botKey = botRaw.startsWith('0x') ? botRaw : '0x' + botRaw;

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet   = new ethers.Wallet(botKey, provider);

  // ── 1. Check known state ──────────────────────────────────────────────────
  const KENO_ABI = [
    'function owner() view returns (address)',
    'function whitelistEnabled() view returns (bool)',
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address,address) view returns (uint256)',
    'function decimals() view returns (uint8)',
  ];
  const keno = new ethers.Contract(KENO_ADDR, KENO_ABI, provider);
  const [owner, wl, bal, allowance, decimals] = await Promise.all([
    keno.owner(),
    keno.whitelistEnabled(),
    keno.balanceOf(wallet.address),
    keno.allowance(wallet.address, ROUTER_ADDR),
    keno.decimals(),
  ]);
  console.log('owner()          :', owner);
  console.log('whitelistEnabled :', wl);
  console.log('KENO balance     :', ethers.formatUnits(bal, decimals));
  console.log('Router allowance :', ethers.formatUnits(allowance, decimals), allowance >= ethers.parseUnits('3000', decimals) ? '✅' : '❌ too low');
  console.log('decimals         :', decimals);

  // ── 2. Try known-paused selectors ─────────────────────────────────────────
  const pausedSelectors = {
    'paused()':            '0x5c975abb',
    'isPaused()':          '0xb187bd26',
    'tradingEnabled()':    '0xca1cce37',
    'tradingOpen()':       '0x6496cb93',
    'swapEnabled()':       '0xdae5f2a0',
  };
  console.log('\n── Checking state flags ─────────────────────────────────────');
  for (const [name, sel] of Object.entries(pausedSelectors)) {
    try {
      const result = await provider.call({ to: KENO_ADDR, data: sel });
      const val = result === '0x' ? '(empty)' : BigInt(result).toString();
      console.log(`${name.padEnd(20)}: ${val} (${result})`);
    } catch(e) {
      console.log(`${name.padEnd(20)}: REVERTS — ${e.reason || e.shortMessage || 'unknown'}`);
    }
  }

  // ── 3. Simulate a simple KENO transfer to the router ─────────────────────
  console.log('\n── Simulating KENO transferFrom (router path) ────────────────');
  const KENO_AMOUNT = ethers.parseUnits('3000', decimals);
  const FACTORY     = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
  const factoryAbi  = ['function getPair(address,address) view returns (address)'];
  const factory     = new ethers.Contract(FACTORY, factoryAbi, provider);
  const pair        = await factory.getPair(KENO_ADDR, WBNB);
  const pairOrRouter = pair === ethers.ZeroAddress ? ROUTER_ADDR : pair;
  console.log('Pair address     :', pair === ethers.ZeroAddress ? 'not yet created' : pair);

  // encode transferFrom(wallet, router, amount) to simulate what PancakeSwap does
  const iface = new ethers.Interface([
    'function transferFrom(address from, address to, uint256 amount) returns (bool)'
  ]);
  const transferFromData = iface.encodeFunctionData('transferFrom', [
    wallet.address, pairOrRouter, KENO_AMOUNT
  ]);
  try {
    await provider.call({ to: KENO_ADDR, data: transferFromData, from: ROUTER_ADDR });
    console.log('transferFrom sim : ✅ OK');
  } catch(e) {
    console.log('transferFrom sim : ❌ REVERTS —', e.reason || e.data || e.shortMessage || 'unknown');
  }

  // ── 4. Simulate addLiquidityETH ───────────────────────────────────────────
  console.log('\n── Simulating addLiquidityETH ────────────────────────────────');
  const ROUTER_ABI = [
    'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint,uint,uint)',
  ];
  const router   = new ethers.Contract(ROUTER_ADDR, ROUTER_ABI, provider);
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const BNB_AMT  = ethers.parseEther('0.25');
  const KENO_MIN = ethers.parseUnits('2985', decimals); // 0.5% slip
  const BNB_MIN  = ethers.parseEther('0.24875');

  try {
    await router.addLiquidityETH.staticCall(
      KENO_ADDR, KENO_AMOUNT, KENO_MIN, BNB_MIN, wallet.address, deadline,
      { value: BNB_AMT, from: wallet.address }
    );
    console.log('addLiquidityETH  : ✅ simulation OK — safe to send');
  } catch(e) {
    console.log('addLiquidityETH  : ❌ REVERTS —', e.reason || e.data || e.shortMessage || e.message.slice(0, 120));
  }

})().catch(e => { console.error('❌', e.shortMessage || e.message); process.exit(1); });

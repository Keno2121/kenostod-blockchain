/**
 * KENO Go-Live Script
 * 1. Disable whitelist  (bot wallet is now owner)
 * 2. Add KENO/BNB liquidity on PancakeSwap V2
 * 3. Print pair address + links
 *
 * Run: node scripts/go-live.js
 */
require('dotenv').config();
const { ethers } = require('ethers');

const RPC          = process.env.BSC_RPC_PRIMARY || 'https://bsc-dataseed.binance.org/';
const KENO_ADDR    = '0x48bb049afe50b050b458624dc6233acd51024ab4';
const ROUTER_ADDR  = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const FACTORY_ADDR = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const WBNB         = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const KENO_AMOUNT  = ethers.parseEther('3000');
const BNB_AMOUNT   = ethers.parseEther('0.25');
const SLIPPAGE     = 50n; // 0.5%

const botRaw = process.env.BOT_WALLET_PRIVATE_KEY || '';
const botKey = botRaw.startsWith('0x') ? botRaw : '0x' + botRaw;

const KENO_ABI = [
  'function whitelistEnabled() view returns (bool)',
  'function toggleWhitelistEnabled(bool enabled)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function owner() view returns (address)',
];
const ROUTER_ABI = [
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)',
];
const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) view returns (address)',
];

function fmt(n, d = 18) { return (Number(n) / 10 ** d).toFixed(4); }

async function waitTx(tx, label) {
  console.log(`       Tx: ${tx.hash}`);
  const r = await tx.wait(2);
  if (r.status !== 1) throw new Error(`${label} reverted`);
  console.log(`       ✅ ${label} confirmed (block ${r.blockNumber})`);
  return r;
}

(async () => {
  const provider  = new ethers.JsonRpcProvider(RPC);
  const wallet    = new ethers.Wallet(botKey, provider);
  const keno      = new ethers.Contract(KENO_ADDR,    KENO_ABI,    wallet);
  const router    = new ethers.Contract(ROUTER_ADDR,  ROUTER_ABI,  wallet);
  const factory   = new ethers.Contract(FACTORY_ADDR, FACTORY_ABI, provider);

  const feeData  = await provider.getFeeData();
  const gasPrice = feeData.gasPrice;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  KENO Go-Live: Whitelist Off → Add Liquidity');
  console.log('═══════════════════════════════════════════════════════\n');

  const [bnb, kenoBalance, wlEnabled, contractOwner, existingPair] = await Promise.all([
    provider.getBalance(wallet.address),
    keno.balanceOf(wallet.address),
    keno.whitelistEnabled(),
    keno.owner(),
    factory.getPair(KENO_ADDR, WBNB),
  ]);

  console.log(`  Wallet       : ${wallet.address}`);
  console.log(`  Is owner     : ${contractOwner.toLowerCase() === wallet.address.toLowerCase() ? '✅ YES' : '❌ NO — abort'}`);
  console.log(`  BNB          : ${fmt(bnb)}`);
  console.log(`  KENO         : ${fmt(kenoBalance)}`);
  console.log(`  Whitelist    : ${wlEnabled ? 'ENABLED ⚠️' : 'DISABLED ✅'}`);
  console.log(`  Existing pair: ${existingPair === ethers.ZeroAddress ? 'None (will be created)' : existingPair}`);
  console.log(`  Gas price    : ${ethers.formatUnits(gasPrice, 'gwei')} gwei\n`);

  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error('Bot wallet is not the KENO owner — cannot proceed');
  }

  // ── Step 1: Disable whitelist ─────────────────────────────────────────────
  if (wlEnabled) {
    console.log('  [1/3] Disabling whitelist…');
    const tx = await keno.toggleWhitelist(false, { gasLimit: 80000n, gasPrice });
    await waitTx(tx, 'toggleWhitelist(false)');
  } else {
    console.log('  [1/3] Whitelist already disabled ✅');
  }

  // ── Step 2: Approve router ────────────────────────────────────────────────
  console.log('\n  [2/3] Approving PancakeSwap router…');
  const allowance = await keno.allowance(wallet.address, ROUTER_ADDR);
  if (allowance < KENO_AMOUNT) {
    const tx = await keno.approve(ROUTER_ADDR, ethers.MaxUint256, { gasLimit: 80000n, gasPrice });
    await waitTx(tx, 'approve');
  } else {
    console.log('       ✅ Already approved');
  }

  // ── Step 3: Add liquidity ─────────────────────────────────────────────────
  console.log('\n  [3/3] Adding liquidity to PancakeSwap V2…');
  const minKeno = KENO_AMOUNT - (KENO_AMOUNT * SLIPPAGE / 10000n);
  const minBNB  = BNB_AMOUNT  - (BNB_AMOUNT  * SLIPPAGE / 10000n);
  const deadline = Math.floor(Date.now() / 1000) + 600;

  const liqTx = await router.addLiquidityETH(
    KENO_ADDR, KENO_AMOUNT, minKeno, minBNB,
    wallet.address, deadline,
    { value: BNB_AMOUNT, gasLimit: 500000n, gasPrice }
  );
  await waitTx(liqTx, 'addLiquidityETH');

  // ── Result ────────────────────────────────────────────────────────────────
  const pair = await factory.getPair(KENO_ADDR, WBNB);
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ✅  KENO IS LIVE ON PANCAKESWAP V2!');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Pair      : ${pair}`);
  console.log(`  Chart     : https://dexscreener.com/bsc/${pair}`);
  console.log(`  Swap      : https://pancakeswap.finance/swap?outputCurrency=${KENO_ADDR}`);
  console.log(`  BscScan   : https://bscscan.com/address/${pair}`);
  console.log('');

})().catch(e => { console.error('\n❌', e.shortMessage || e.message); process.exit(1); });

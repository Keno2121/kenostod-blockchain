/**
 * Add KENO/BNB liquidity to PancakeSwap V2.
 * Simulation already confirmed this works — using explicit 3 gwei gas price.
 */
require('dotenv').config();
const { ethers } = require('ethers');

const RPC          = process.env.BSC_RPC_PRIMARY || 'https://bsc-dataseed.binance.org/';
const KENO_ADDR    = '0x48bb049afe50b050b458624dc6233acd51024ab4';
const ROUTER_ADDR  = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const FACTORY_ADDR = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const WBNB         = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const KENO_AMOUNT = ethers.parseEther('3000');
const BNB_AMOUNT  = ethers.parseEther('0.25');
const SLIPPAGE    = 50n; // 0.5%
const GAS_PRICE   = ethers.parseUnits('3', 'gwei'); // explicit — well above BSC minimum

const botRaw = process.env.BOT_WALLET_PRIVATE_KEY || '';
const botKey = botRaw.startsWith('0x') ? botRaw : '0x' + botRaw;

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet   = new ethers.Wallet(botKey, provider);

  const ROUTER_ABI  = ['function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint,uint,uint)'];
  const FACTORY_ABI = ['function getPair(address,address) view returns (address)'];
  const KENO_ABI    = ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'];

  const router  = new ethers.Contract(ROUTER_ADDR,  ROUTER_ABI,  wallet);
  const factory = new ethers.Contract(FACTORY_ADDR, FACTORY_ABI, provider);
  const keno    = new ethers.Contract(KENO_ADDR,    KENO_ABI,    wallet);

  const [bnb, kenoBalance, allowance, existingPair] = await Promise.all([
    provider.getBalance(wallet.address),
    keno.balanceOf(wallet.address),
    keno.allowance(wallet.address, ROUTER_ADDR),
    factory.getPair(KENO_ADDR, WBNB),
  ]);

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  KENO/BNB → PancakeSwap V2 Liquidity Add');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Wallet       : ${wallet.address}`);
  console.log(`  BNB          : ${ethers.formatEther(bnb)}`);
  console.log(`  KENO         : ${ethers.formatEther(kenoBalance)}`);
  console.log(`  Allowance OK : ${allowance >= KENO_AMOUNT ? '✅' : '❌'}`);
  console.log(`  Pair exists  : ${existingPair === ethers.ZeroAddress ? 'No (will create)' : existingPair}`);
  console.log(`  Gas price    : 3 gwei\n`);

  // Approve if needed
  if (allowance < KENO_AMOUNT) {
    console.log('  Approving router…');
    const appTx = await keno.approve(ROUTER_ADDR, ethers.MaxUint256, { gasLimit: 80000n, gasPrice: GAS_PRICE });
    console.log('  Approve tx:', appTx.hash);
    await appTx.wait(2);
    console.log('  ✅ Approved\n');
  }

  // Simulate first
  const minKeno  = KENO_AMOUNT - (KENO_AMOUNT * SLIPPAGE / 10000n);
  const minBNB   = BNB_AMOUNT  - (BNB_AMOUNT  * SLIPPAGE / 10000n);
  const deadline = Math.floor(Date.now() / 1000) + 600;

  console.log('  Simulating addLiquidityETH…');
  try {
    await router.addLiquidityETH.staticCall(
      KENO_ADDR, KENO_AMOUNT, minKeno, minBNB, wallet.address, deadline,
      { value: BNB_AMOUNT }
    );
    console.log('  ✅ Simulation OK\n');
  } catch(e) {
    console.error('  ❌ Simulation failed:', e.reason || e.shortMessage || e.message);
    process.exit(1);
  }

  console.log('  Sending addLiquidityETH…');
  const tx = await router.addLiquidityETH(
    KENO_ADDR, KENO_AMOUNT, minKeno, minBNB, wallet.address, deadline,
    { value: BNB_AMOUNT, gasLimit: 600000n, gasPrice: GAS_PRICE }
  );
  console.log('  Tx:', tx.hash);
  const r = await tx.wait(2);

  if (r.status !== 1) throw new Error('addLiquidityETH reverted on-chain');

  const pair = await factory.getPair(KENO_ADDR, WBNB);
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  ✅  KENO IS LIVE ON PANCAKESWAP V2!');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Pair    : ${pair}`);
  console.log(`  Chart   : https://dexscreener.com/bsc/${pair}`);
  console.log(`  Swap    : https://pancakeswap.finance/swap?outputCurrency=${KENO_ADDR}`);
  console.log(`  BscScan : https://bscscan.com/address/${pair}`);
  console.log('');

})().catch(e => { console.error('\n❌', e.shortMessage || e.message); process.exit(1); });

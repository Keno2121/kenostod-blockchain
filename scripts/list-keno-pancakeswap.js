/**
 * KENO/BNB PancakeSwap V2 Self-Listing Script
 * 
 * Creates the initial KENO/BNB liquidity pool on PancakeSwap V2.
 * Run once — after this the pool exists permanently on-chain.
 * 
 * Usage: node scripts/list-keno-pancakeswap.js
 */

require('dotenv').config();
const { ethers } = require('ethers');

// ── Config ────────────────────────────────────────────────────────────────────
const KENO_ADDRESS       = '0x48bb049afe50b050b458624dc6233acd51024ab4';
const PANCAKE_ROUTER_V2  = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const PANCAKE_FACTORY_V2 = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';

// ── Listing Parameters ────────────────────────────────────────────────────────
// Adjust these before running if BNB price changes significantly.
// Current target: $0.05/KENO
const KENO_AMOUNT = ethers.parseEther('3000');   // 3,000 KENO
const BNB_AMOUNT  = ethers.parseEther('0.25');   // 0.25 BNB  →  price ≈ $0.05/KENO at $600/BNB

// Slippage on initial add can be 0 since there is no existing price to reference
const KENO_MIN = ethers.parseEther('2850');      // 5% slippage tolerance on KENO
const BNB_MIN  = ethers.parseEther('0.2375');    // 5% slippage tolerance on BNB

// ── ABIs ─────────────────────────────────────────────────────────────────────
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

const ROUTER_ABI = [
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)',
];

const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) view returns (address)',
];

const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095C';

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const rpc = process.env.BSC_RPC_PRIMARY || 'https://bsc-dataseed.binance.org/';
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(process.env.BOT_WALLET_PRIVATE_KEY, provider);

  console.log('\n══════════════════════════════════════════════════');
  console.log('  KENO/BNB PancakeSwap V2 — Self Listing');
  console.log('══════════════════════════════════════════════════\n');
  console.log(`  Wallet  : ${wallet.address}`);

  // ── Balance checks ──────────────────────────────────────────────────────────
  const bnbBalance  = await provider.getBalance(wallet.address);
  const keno        = new ethers.Contract(KENO_ADDRESS, ERC20_ABI, wallet);
  const kenoBalance = await keno.balanceOf(wallet.address);

  const bnbRequired = BNB_AMOUNT + ethers.parseEther('0.015'); // add gas buffer
  console.log(`  BNB     : ${ethers.formatEther(bnbBalance)} (need ${ethers.formatEther(bnbRequired)})`);
  console.log(`  KENO    : ${ethers.formatEther(kenoBalance)} (depositing ${ethers.formatEther(KENO_AMOUNT)})`);

  if (bnbBalance < bnbRequired) {
    console.error('\n❌ Insufficient BNB. Top up the wallet before listing.');
    process.exit(1);
  }
  if (kenoBalance < KENO_AMOUNT) {
    console.error('\n❌ Insufficient KENO balance.');
    process.exit(1);
  }

  // ── Check pool doesn't already exist ───────────────────────────────────────
  const factory = new ethers.Contract(PANCAKE_FACTORY_V2, FACTORY_ABI, provider);
  const existingPair = await factory.getPair(KENO_ADDRESS, WBNB);
  if (existingPair !== ethers.ZeroAddress) {
    console.log(`\n⚠️  Pool already exists at ${existingPair}`);
    console.log('   Adding liquidity to existing pool instead.\n');
  } else {
    console.log('\n  Pool    : None yet — will be created on first add\n');
  }

  // ── Implied price ───────────────────────────────────────────────────────────
  // Fetch live BNB price from PancakeSwap WBNB/BUSD pair
  let bnbUsd = 600;
  try {
    const priceRes = await fetch(
      'https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT'
    );
    const priceData = await priceRes.json();
    bnbUsd = parseFloat(priceData.price);
  } catch { /* use fallback */ }

  const impliedPrice = (parseFloat(ethers.formatEther(BNB_AMOUNT)) * bnbUsd)
                     / parseFloat(ethers.formatEther(KENO_AMOUNT));
  console.log(`  BNB/USD : $${bnbUsd.toFixed(2)}`);
  console.log(`  KENO    : depositing ${ethers.formatEther(KENO_AMOUNT)} KENO`);
  console.log(`  BNB     : depositing ${ethers.formatEther(BNB_AMOUNT)} BNB`);
  console.log(`  Price   : $${impliedPrice.toFixed(4)}/KENO`);
  console.log(`  Depth   : ~$${(parseFloat(ethers.formatEther(BNB_AMOUNT)) * bnbUsd * 2).toFixed(0)} total\n`);

  // ── Confirm ─────────────────────────────────────────────────────────────────
  console.log('  Proceeding in 5 seconds... (Ctrl+C to abort)\n');
  await new Promise(r => setTimeout(r, 5000));

  // ── Step 1: Approve router ──────────────────────────────────────────────────
  const currentAllowance = await keno.allowance(wallet.address, PANCAKE_ROUTER_V2);
  if (currentAllowance < KENO_AMOUNT) {
    console.log('  [1/2] Approving PancakeSwap router for KENO...');
    const approveTx = await keno.approve(PANCAKE_ROUTER_V2, ethers.MaxUint256, {
      gasPrice: ethers.parseUnits('3', 'gwei'),
      gasLimit: 80000,
    });
    console.log(`        Tx: ${approveTx.hash}`);
    await approveTx.wait();
    console.log('        ✅ Approved\n');
  } else {
    console.log('  [1/2] Router already approved ✅\n');
  }

  // ── Step 2: Add liquidity ───────────────────────────────────────────────────
  console.log('  [2/2] Adding liquidity to PancakeSwap V2...');
  const router   = new ethers.Contract(PANCAKE_ROUTER_V2, ROUTER_ABI, wallet);
  const deadline = Math.floor(Date.now() / 1000) + 600; // 10 minutes

  const tx = await router.addLiquidityETH(
    KENO_ADDRESS,
    KENO_AMOUNT,
    KENO_MIN,
    BNB_MIN,
    wallet.address,   // LP tokens go to bot wallet
    deadline,
    {
      value    : BNB_AMOUNT,
      gasPrice : ethers.parseUnits('3', 'gwei'),
      gasLimit : 300000,
    }
  );

  console.log(`        Tx: ${tx.hash}`);
  console.log('        Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log(`        ✅ Confirmed in block ${receipt.blockNumber}\n`);

  // ── Result ──────────────────────────────────────────────────────────────────
  const pairAddress = await factory.getPair(KENO_ADDRESS, WBNB);
  console.log('══════════════════════════════════════════════════');
  console.log('  🚀 KENO IS NOW LIVE ON PANCAKESWAP V2');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Pool    : ${pairAddress}`);
  console.log(`  Price   : $${impliedPrice.toFixed(4)}/KENO`);
  console.log(`  Chart   : https://poocoin.app/tokens/${KENO_ADDRESS}`);
  console.log(`  Trade   : https://pancakeswap.finance/swap?outputCurrency=${KENO_ADDRESS}`);
  console.log('\n  ⚠️  Save the pool address above — add it to the dashboard.\n');
}

main().catch(err => {
  console.error('\n❌ Error:', err.message || err);
  process.exit(1);
});

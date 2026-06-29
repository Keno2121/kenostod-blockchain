#!/usr/bin/env node
/**
 * bridge-to-hl.js
 * Bridges BSC USDC → Hyperliquid in 3 steps:
 *   1. Bridge 0.002 BNB → Arbitrum ETH via LiFi GasZip (gas money)
 *   2. Bridge 50 USDC (BSC) → Arbitrum USDC via LiFi Eco bridge
 *   3. Deposit Arbitrum USDC → HL Bridge2 → credited to same address on HL
 *
 * Wallet: 0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2 (WALLET_PRIVATE_KEY)
 */

const { ethers } = require('ethers');

const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const ARB_RPC = 'https://arb1.arbitrum.io/rpc';

const USDC_BSC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'; // Binance-Peg USDC (18 dec)
const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'; // Native USDC on Arbitrum (6 dec)
const LIFI_ROUTER = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';

// HL Bridge2 contract on Arbitrum One
const HL_BRIDGE = '0x2Df1c51E09aECF9A0c42523B9b2FBbb2Fc06c3';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

const HL_BRIDGE_ABI = [
  'function deposit(uint64 usd) external',
  'function sendToArb(uint64 usd) external',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getLifiQuote({ fromChain, toChain, fromToken, toToken, fromAmount, fromAddress, toAddress }) {
  const params = new URLSearchParams({ fromChain, toChain, fromToken, toToken, fromAmount, fromAddress, toAddress });
  const url = `https://li.quest/v1/quote?${params}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.message && !data.transactionRequest) throw new Error(`LiFi: ${data.message}`);
  return data;
}

async function main() {
  const rawKey = process.env.WALLET_PRIVATE_KEY;
  if (!rawKey) throw new Error('WALLET_PRIVATE_KEY not set');
  const key = rawKey.startsWith('0x') ? rawKey : '0x' + rawKey;

  const bscProvider = new ethers.JsonRpcProvider(BSC_RPC);
  const arbProvider = new ethers.JsonRpcProvider(ARB_RPC);
  const bscWallet = new ethers.Wallet(key, bscProvider);
  const arbWallet = new ethers.Wallet(key, arbProvider);

  const address = bscWallet.address;
  console.log(`\n🔑 Wallet: ${address}`);

  // ── Check balances ──────────────────────────────────────────────────────────
  const usdcBsc = new ethers.Contract(USDC_BSC, ERC20_ABI, bscProvider);
  const usdcArb = new ethers.Contract(USDC_ARB, ERC20_ABI, arbProvider);

  const [bnbBal, bscUsdcBal, arbEthBal, arbUsdcBal] = await Promise.all([
    bscProvider.getBalance(address),
    usdcBsc.balanceOf(address),
    arbProvider.getBalance(address),
    usdcArb.balanceOf(address),
  ]);

  const bnb = parseFloat(ethers.formatEther(bnbBal));
  const bscUsdc = parseFloat(ethers.formatUnits(bscUsdcBal, 18));
  const arbEth = parseFloat(ethers.formatEther(arbEthBal));
  const arbUsdc = parseFloat(ethers.formatUnits(arbUsdcBal, 6));

  console.log(`\n📊 Balances:`);
  console.log(`  BSC: ${bnb.toFixed(4)} BNB | ${bscUsdc.toFixed(2)} USDC`);
  console.log(`  Arbitrum: ${arbEth.toFixed(6)} ETH | ${arbUsdc.toFixed(2)} USDC`);

  if (bscUsdc < 1) {
    console.log('❌ Not enough USDC on BSC to bridge');
    process.exit(1);
  }

  // Amount to bridge: 50 USDC (leave a tiny buffer)
  const usdcToBridge = Math.min(bscUsdc - 0.1, 50);
  const usdcAmountWei = ethers.parseUnits(usdcToBridge.toFixed(6), 18).toString();
  console.log(`\n💰 Will bridge: ${usdcToBridge.toFixed(2)} USDC BSC → Arbitrum → HL`);

  // ── STEP 1: Bridge BNB → Arbitrum ETH for gas (if needed) ──────────────────
  if (arbEth < 0.00005) {
    console.log('\n⛽ Step 1: Bridging BNB → Arbitrum ETH for gas...');
    const gasAmount = '2000000000000000'; // 0.002 BNB

    try {
      const quote = await getLifiQuote({
        fromChain: '56', toChain: '42161',
        fromToken: '0x0000000000000000000000000000000000000000',
        toToken:   '0x0000000000000000000000000000000000000000',
        fromAmount: gasAmount,
        fromAddress: address, toAddress: address,
      });

      const tr = quote.transactionRequest;
      console.log(`  Tool: ${quote.toolDetails?.name} | Receive: ${parseFloat(ethers.formatEther(quote.estimate?.toAmount || '0')).toFixed(6)} ETH on Arb`);

      const gasTx = await bscWallet.sendTransaction({
        to: tr.to,
        data: tr.data,
        value: tr.value || gasAmount,
        gasLimit: BigInt(tr.gasLimit || '500000'),
        gasPrice: ethers.parseUnits('3', 'gwei'),
      });
      console.log(`  ✅ Gas bridge tx: ${gasTx.hash}`);
      console.log(`  ⏳ Waiting for confirmation...`);
      await gasTx.wait(1);
      console.log(`  ✅ Gas bridge confirmed! ETH will arrive on Arbitrum in ~2-5 min`);
    } catch (e) {
      console.log(`  ⚠️  Gas bridge failed: ${e.message}`);
      console.log(`  → Continuing anyway (will use small existing ETH if any)`);
    }
  } else {
    console.log(`\n✅ Step 1: Already have ${arbEth.toFixed(6)} ETH on Arbitrum — skipping gas bridge`);
  }

  // ── STEP 2: Bridge BSC USDC → Arbitrum USDC ────────────────────────────────
  console.log(`\n🌉 Step 2: Bridging ${usdcToBridge.toFixed(2)} USDC BSC → Arbitrum...`);

  const usdcQuote = await getLifiQuote({
    fromChain: '56', toChain: '42161',
    fromToken: USDC_BSC,
    toToken:   USDC_ARB,
    fromAmount: usdcAmountWei,
    fromAddress: address, toAddress: address,
  });

  const receive = parseFloat(ethers.formatUnits(usdcQuote.estimate?.toAmount || '0', 6));
  console.log(`  Tool: ${usdcQuote.toolDetails?.name} | Receive: ${receive.toFixed(2)} USDC on Arbitrum`);

  const usdcTr = usdcQuote.transactionRequest;

  // Approve USDC to LiFi router
  const currentAllowance = await usdcBsc.allowance(address, LIFI_ROUTER);
  if (currentAllowance < BigInt(usdcAmountWei)) {
    console.log(`  Approving USDC...`);
    const approveTx = await (new ethers.Contract(USDC_BSC, ERC20_ABI, bscWallet)).approve(
      LIFI_ROUTER, ethers.MaxUint256,
      { gasPrice: ethers.parseUnits('3', 'gwei') }
    );
    await approveTx.wait(1);
    console.log(`  ✅ USDC approved`);
  } else {
    console.log(`  ✅ USDC already approved`);
  }

  // Execute bridge
  const bridgeTx = await bscWallet.sendTransaction({
    to: usdcTr.to,
    data: usdcTr.data,
    value: usdcTr.value || '0x0',
    gasLimit: BigInt(usdcTr.gasLimit || '1000000'),
    gasPrice: ethers.parseUnits('3', 'gwei'),
  });
  console.log(`  ✅ Bridge tx: ${bridgeTx.hash}`);
  console.log(`  🔗 Track: https://scan.li.fi/tx/${bridgeTx.hash}`);
  await bridgeTx.wait(1);
  console.log(`  ✅ Bridge confirmed on BSC — USDC in transit to Arbitrum (~5-15 min)`);

  // ── STEP 3: Wait for USDC on Arbitrum, then deposit to HL ──────────────────
  console.log(`\n⏳ Step 3: Waiting for USDC to arrive on Arbitrum...`);
  console.log(`  (Polling every 30s, timeout 25 min)`);

  let arbUsdcFinal = 0;
  for (let i = 0; i < 50; i++) {
    await sleep(30_000);
    try {
      const bal = await usdcArb.balanceOf(address);
      arbUsdcFinal = parseFloat(ethers.formatUnits(bal, 6));
      const ethBal = parseFloat(ethers.formatEther(await arbProvider.getBalance(address)));
      console.log(`  [${i + 1}/50] Arbitrum: ${arbUsdcFinal.toFixed(4)} USDC | ${ethBal.toFixed(6)} ETH`);

      if (arbUsdcFinal >= receive * 0.95) {
        console.log(`  ✅ USDC arrived on Arbitrum!`);
        break;
      }
    } catch (e) {
      console.log(`  [${i + 1}/50] RPC error: ${e.message.slice(0, 60)}`);
    }
  }

  if (arbUsdcFinal < 1) {
    console.log('❌ USDC did not arrive on Arbitrum within 25 min. Check https://scan.li.fi');
    console.log(`   BSC tx: ${bridgeTx.hash}`);
    process.exit(1);
  }

  // Check ETH on Arbitrum for gas
  const finalArbEth = parseFloat(ethers.formatEther(await arbProvider.getBalance(address)));
  console.log(`\n⛽ Arbitrum ETH available: ${finalArbEth.toFixed(6)}`);

  if (finalArbEth < 0.00003) {
    console.log('⚠️  Low ETH on Arbitrum for gas. Waiting up to 5 more min for gas bridge...');
    for (let i = 0; i < 10; i++) {
      await sleep(30_000);
      const eth = parseFloat(ethers.formatEther(await arbProvider.getBalance(address)));
      console.log(`  ETH check: ${eth.toFixed(6)}`);
      if (eth >= 0.00003) break;
    }
  }

  // ── STEP 4: Deposit USDC → HL Bridge2 on Arbitrum ──────────────────────────
  console.log(`\n🚀 Step 4: Depositing ${arbUsdcFinal.toFixed(2)} USDC → Hyperliquid...`);

  const arbUsdcBal2 = await usdcArb.balanceOf(address);
  const depositAmount = arbUsdcBal2;

  // Approve USDC to HL bridge
  const usdcArbContract = new ethers.Contract(USDC_ARB, ERC20_ABI, arbWallet);
  const hlAllowance = await usdcArbContract.allowance(address, HL_BRIDGE);

  if (hlAllowance < depositAmount) {
    console.log(`  Approving USDC to HL bridge...`);
    const approveTx = await usdcArbContract.approve(HL_BRIDGE, ethers.MaxUint256, {
      gasLimit: 100_000n,
    });
    await approveTx.wait(1);
    console.log(`  ✅ Approved`);
  }

  // Try deposit() function first, fallback to direct transfer
  try {
    const hlBridge = new ethers.Contract(HL_BRIDGE, HL_BRIDGE_ABI, arbWallet);
    const usd64 = BigInt(ethers.formatUnits(depositAmount, 6).split('.')[0]);
    const depositTx = await hlBridge.deposit(usd64, { gasLimit: 200_000n });
    console.log(`  ✅ HL deposit tx: ${depositTx.hash}`);
    await depositTx.wait(1);
    console.log(`\n🎉 SUCCESS! ${arbUsdcFinal.toFixed(2)} USDC deposited to Hyperliquid!`);
    console.log(`   Your HL account (${address}) should show USDC balance within 1-2 min`);
    console.log(`   HL Funding Bot will auto-detect and open positions!`);
  } catch (e) {
    console.log(`  deposit() failed (${e.message.slice(0, 80)}), trying direct transfer...`);
    try {
      const transferTx = await usdcArbContract.transfer(HL_BRIDGE, depositAmount, {
        gasLimit: 150_000n,
      });
      console.log(`  ✅ Transfer tx: ${transferTx.hash}`);
      await transferTx.wait(1);
      console.log(`\n🎉 SUCCESS! ${arbUsdcFinal.toFixed(2)} USDC sent to HL Bridge!`);
    } catch (e2) {
      console.log(`  ❌ Transfer also failed: ${e2.message}`);
      console.log(`  USDC is safe on Arbitrum at: ${address}`);
      console.log(`  Manual deposit: https://app.hyperliquid.xyz/portfolio`);
    }
  }
}

main().catch(e => {
  console.error('\n❌ Fatal error:', e.message);
  process.exit(1);
});

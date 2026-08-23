/**
 * Test UTLBDEXWrapper — live mainnet swap
 * ════════════════════════════════════════
 * Swaps 0.1 BOT → USDT through the UTLBDEXWrapper on BOT Chain mainnet.
 * Verifies that:
 *   1. 0.001 BOT (0.1%) reaches the UTL FeeCollector
 *   2. USDT arrives in the sender's wallet
 *
 * Usage:
 *   node utl/scripts/test-bdex-wrapper-swap.js
 */

require("dotenv").config();
const { ethers } = require("ethers");

const RPC          = "https://rpc.botchain.ai";
const WRAPPER      = "0x829658BE065C75C174639701672dE820E4683ca7";
const USDT         = "0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C";
const FEE_COLLECTOR = "0xBb44a52b2B69D820cA1792Ca9a496e9F00B2F9E7";
const POOL_FEE     = 3000;
const SWAP_AMOUNT  = ethers.parseEther("0.1");   // 0.1 BOT

const WRAPPER_ABI = [
  "function swapExactBOTForTokens(address tokenOut, uint256 amountOutMin, uint24 poolFee, uint256 deadline) payable returns (uint256)"
];
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function main() {
  const rawKey = process.env.BOT_WALLET_PRIVATE_KEY || "";
  const key    = rawKey.startsWith("0x") ? rawKey : "0x" + rawKey;
  if (key.length < 66) throw new Error("BOT_WALLET_PRIVATE_KEY not set");

  const provider = new ethers.JsonRpcProvider(RPC);
  const signer   = new ethers.Wallet(key, provider);
  const wrapper  = new ethers.Contract(WRAPPER, WRAPPER_ABI, signer);
  const usdt     = new ethers.Contract(USDT, ERC20_ABI, provider);

  const decimals     = Number(await usdt.decimals());
  const deadline     = Math.floor(Date.now() / 1000) + 300;  // 5 min
  const expectedFee  = SWAP_AMOUNT * 10n / 10000n;           // 0.1%

  console.log("\n══════════════════════════════════════════════");
  console.log("  UTL BDEX Wrapper — Live Test Swap");
  console.log("  Swapping: 0.1 BOT → USDT");
  console.log(`  Wrapper:  ${WRAPPER}`);
  console.log(`  Expected UTL fee: ${ethers.formatEther(expectedFee)} BOT`);
  console.log("══════════════════════════════════════════════\n");

  // ── Snapshot before ─────────────────────────────────────────────────────
  const [botBefore, usdtBefore, fcBotBefore] = await Promise.all([
    provider.getBalance(signer.address),
    usdt.balanceOf(signer.address),
    provider.getBalance(FEE_COLLECTOR),
  ]);

  console.log("Before:");
  console.log(`  Wallet BOT:       ${ethers.formatEther(botBefore)}`);
  console.log(`  Wallet USDT:      ${ethers.formatUnits(usdtBefore, decimals)}`);
  console.log(`  FeeCollector BOT: ${ethers.formatEther(fcBotBefore)}`);

  // ── Execute swap ─────────────────────────────────────────────────────────
  console.log("\n  Sending swap...");
  const tx = await wrapper.swapExactBOTForTokens(
    USDT,
    0n,         // amountOutMin = 0 for test (no slippage guard)
    POOL_FEE,
    deadline,
    { value: SWAP_AMOUNT, gasLimit: 400_000 }
  );
  console.log(`  TX: ${tx.hash}`);
  console.log("  Waiting for receipt...");
  const receipt = await tx.wait();
  console.log(`  Confirmed block: ${receipt.blockNumber}  gas: ${receipt.gasUsed}`);

  // ── Snapshot after ───────────────────────────────────────────────────────
  const [botAfter, usdtAfter, fcBotAfter] = await Promise.all([
    provider.getBalance(signer.address),
    usdt.balanceOf(signer.address),
    provider.getBalance(FEE_COLLECTOR),
  ]);

  const fcIncrease = fcBotAfter - fcBotBefore;
  const usdtGain   = usdtAfter - usdtBefore;

  console.log("\nAfter:");
  console.log(`  Wallet BOT:       ${ethers.formatEther(botAfter)}`);
  console.log(`  Wallet USDT:      ${ethers.formatUnits(usdtAfter, decimals)}`);
  console.log(`  FeeCollector BOT: ${ethers.formatEther(fcBotAfter)}`);

  console.log("\n══ RESULT ══════════════════════════════════════");
  console.log(`  USDT received:    ${ethers.formatUnits(usdtGain, decimals)}`);
  console.log(`  UTL fee collected:${ethers.formatEther(fcIncrease)} BOT`);
  console.log(`  Expected fee:     ${ethers.formatEther(expectedFee)} BOT`);
  const feeMatch = fcIncrease === expectedFee;
  console.log(`  Fee correct:      ${feeMatch ? "✅ YES" : "❌ NO — got " + ethers.formatEther(fcIncrease)}`);
  console.log(`  Explorer: https://scan.botchain.ai/tx/${tx.hash}`);
  console.log("════════════════════════════════════════════════\n");

  if (!feeMatch) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });

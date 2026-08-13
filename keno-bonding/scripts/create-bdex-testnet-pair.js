/**
 * Create KENO/WBOT V3 Pool on BOT Chain Testnet
 * ═══════════════════════════════════════════════
 * 1. Wraps tBOT → WBOT
 * 2. Creates & initialises KENO/WBOT 0.3% V3 pool
 * 3. Mints a full-range liquidity position
 *
 * Usage:
 *   cd keno-bonding
 *   npx hardhat run scripts/create-bdex-testnet-pair.js --network botchainTestnet
 *
 * Testnet contracts (same addresses as mainnet — confirmed by nonce check):
 *   WBOT:               0xD5452816194a3784dBa983426cCe7c122F4abd30
 *   V3 Factory:         0x1C51c173323ec11BB4e3C4fD2314c225Dc4b5419
 *   NftPositionManager: 0xDAc3FcFF004d8a8675b94E44941A1a2e3b240090
 */

const { ethers, network } = require("hardhat");

// ── Constants ────────────────────────────────────────────────────────────────
const KENO_ADDR    = "0x137a5Fc22a76Ec42490F2421a81935d124baE714"; // testnet
const WBOT_ADDR    = "0xD5452816194a3784dBa983426cCe7c122F4abd30";
const NFT_PM_ADDR  = "0xDAc3FcFF004d8a8675b94E44941A1a2e3b240090";
const V3_FEE       = 3000;   // 0.3%
const TICK_SPACING = 60;     // for 3000 fee tier

// KENO is token0 (0x13... < 0xD5...)
// Price = WBOT per KENO = ~0.00682 (KENO $0.0663 / BOT $9.72)
// sqrtPriceX96 = sqrt(0.00682) * 2^96
const PRICE_RATIO   = 0.00682;
const Q96           = 2n ** 96n;
const sqrtPrice     = Math.sqrt(PRICE_RATIO);
const sqrtPriceX96  = BigInt(Math.floor(sqrtPrice * Number(Q96)));

const TICK_LOWER = -887220n; // max range for 0.3% fee tier (multiple of 60)
const TICK_UPPER =  887220n;

const WBOT_ABI = [
  "function deposit() payable",
  "function approve(address,uint256) returns(bool)",
  "function balanceOf(address) view returns(uint256)"
];

const KENO_ABI = [
  "function approve(address,uint256) returns(bool)",
  "function balanceOf(address) view returns(uint256)"
];

const NFT_PM_ABI = [
  "function createAndInitializePoolIfNecessary(address,address,uint24,uint160) payable returns(address)",
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) returns(uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)"
];

async function main() {
  const [signer] = await ethers.getSigners();

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  KENO/WBOT V3 Pool — BOT Chain Testnet");
  console.log(`  Signer:  ${signer.address}`);
  console.log("══════════════════════════════════════════════════════════\n");

  const chainId = (await ethers.provider.getNetwork()).chainId;
  if (chainId !== 968n) throw new Error(`Expected chainId 968, got ${chainId}`);

  const wbot = new ethers.Contract(WBOT_ADDR, WBOT_ABI, signer);
  const keno = new ethers.Contract(KENO_ADDR, KENO_ABI, signer);
  const nftpm = new ethers.Contract(NFT_PM_ADDR, NFT_PM_ABI, signer);

  // ── Step 1: Wrap 3 tBOT → WBOT ─────────────────────────────────────────
  const wrapAmount = ethers.parseEther("3");
  console.log("  Step 1: Wrapping 3 tBOT → WBOT...");
  const wrapTx = await wbot.deposit({ value: wrapAmount, gasLimit: 100_000 });
  console.log(`  TX: https://scan.bohr.life/tx/${wrapTx.hash}`);
  await wrapTx.wait();
  const wbotBal = await wbot.balanceOf(signer.address);
  console.log(`  ✅ WBOT balance: ${ethers.formatEther(wbotBal)}`);

  // ── Step 2: Approve both tokens to NftPositionManager ──────────────────
  const kenoBal = await keno.balanceOf(signer.address);
  console.log(`\n  KENO balance: ${ethers.formatEther(kenoBal)}`);

  console.log("  Step 2: Approving KENO to NftPositionManager...");
  const approvKeno = await keno.approve(NFT_PM_ADDR, kenoBal, { gasLimit: 100_000 });
  await approvKeno.wait();
  console.log("  Approving WBOT to NftPositionManager...");
  const approvWbot = await wbot.approve(NFT_PM_ADDR, wbotBal, { gasLimit: 100_000 });
  await approvWbot.wait();
  console.log("  ✅ Approved");

  // ── Step 3: Create & initialise pool ───────────────────────────────────
  console.log(`\n  Step 3: Creating KENO/WBOT pool (fee=3000, sqrtPriceX96=${sqrtPriceX96})...`);
  const createTx = await nftpm.createAndInitializePoolIfNecessary(
    KENO_ADDR,
    WBOT_ADDR,
    V3_FEE,
    sqrtPriceX96,
    { gasLimit: 1_000_000 }
  );
  console.log(`  TX: https://scan.bohr.life/tx/${createTx.hash}`);
  const createReceipt = await createTx.wait();
  // Pool address is in logs
  const poolAddr = createReceipt.logs[0]?.address || "check explorer";
  console.log(`  ✅ Pool created (or already existed)`);
  console.log(`  Pool address: ${poolAddr}`);

  // ── Step 4: Mint full-range liquidity position ─────────────────────────
  const kenoLiq  = ethers.parseEther("500000");   // 500k KENO
  const wbotLiq  = ethers.parseEther("3");         // 3 WBOT
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

  console.log(`\n  Step 4: Minting liquidity position...`);
  console.log(`  KENO: 500,000 | WBOT: 3 | tick range: [${TICK_LOWER}, ${TICK_UPPER}]`);

  const mintTx = await nftpm.mint({
    token0:          KENO_ADDR,
    token1:          WBOT_ADDR,
    fee:             V3_FEE,
    tickLower:       TICK_LOWER,
    tickUpper:       TICK_UPPER,
    amount0Desired:  kenoLiq,
    amount1Desired:  wbotLiq,
    amount0Min:      0n,
    amount1Min:      0n,
    recipient:       signer.address,
    deadline
  }, { gasLimit: 2_000_000 });

  console.log(`  TX: https://scan.bohr.life/tx/${mintTx.hash}`);
  const mintReceipt = await mintTx.wait();
  console.log(`  ✅ Liquidity position minted!`);

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("\n  ══════════════════════════════════════════════════════");
  console.log("  KENO/WBOT POOL LIVE ON BOT CHAIN TESTNET");
  console.log(`  KENO:       https://scan.bohr.life/address/${KENO_ADDR}`);
  console.log(`  Pool:       ${poolAddr}`);
  console.log(`  DEX:        https://dex.botchain.ai/#/swap`);
  console.log(`  Network:    BOT Chain Testnet | Chain ID: 968 | RPC: https://rpc.bohr.life`);
  console.log("  ══════════════════════════════════════════════════════\n");
}

main().catch(err => { console.error(err); process.exit(1); });

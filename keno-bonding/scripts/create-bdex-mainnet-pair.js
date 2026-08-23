/**
 * Create KENO/WBOT pool on BDEX (BOT Chain Mainnet)
 * ══════════════════════════════════════════════════
 * 1. Creates the V3 pool via the factory
 * 2. Initialises at the BSC reference price
 * 3. Wraps BOT → WBOT
 * 4. Seeds an initial full-range LP position
 *
 * Usage:
 *   node keno-bonding/scripts/create-bdex-mainnet-pair.js
 *
 * Addresses (same on mainnet and testnet)
 *   KENO      0x137a5Fc22a76Ec42490F2421a81935d124baE714
 *   WBOT      0xD5452816194a3784dBa983426cCe7c122F4abd30
 *   Factory   0x1C51c173323ec11BB4e3C4fD2314c225Dc4b5419
 *   NftPM     0xDAc3FcFF004d8a8675b94E44941A1a2e3b240090
 */

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const { ethers } = require("ethers");

// ── Config ───────────────────────────────────────────────────────────────────
const RPC      = "https://rpc.botchain.ai";
const KENO     = "0x137a5Fc22a76Ec42490F2421a81935d124baE714";  // token0
const WBOT     = "0xD5452816194a3784dBa983426cCe7c122F4abd30";  // token1
const FACTORY  = "0x1C51c173323ec11BB4e3C4fD2314c225Dc4b5419";
const NFT_PM   = "0xDAc3FcFF004d8a8675b94E44941A1a2e3b240090";

const POOL_FEE     = 3000;  // 0.3 % — standard V3 fee tier
const TICK_SPACING = 60;    // spacing for fee=3000
// Full-range ticks, rounded to tick spacing
const TICK_LOWER   = -887220;  // floor(-887272/60)*60
const TICK_UPPER   =  887220;  // floor(887272/60)*60

// ── Price ────────────────────────────────────────────────────────────────────
// KENO BSC price ≈ $0.014115  |  BOT price ≈ $9.71
// => 1 KENO = 0.014115/9.71 ≈ 0.001454 BOT
// pool price = token1/token0 = WBOT per KENO = 0.001454
// sqrtPriceX96 = sqrt(price) * 2^96
const KENO_PRICE_USD = 0.014115;
const BOT_PRICE_USD  = 9.71;
const PRICE_WBOT_PER_KENO = KENO_PRICE_USD / BOT_PRICE_USD;

// Compute sqrtPriceX96 with BigInt precision
function computeSqrtPriceX96(price) {
  // price as rational: numerator/denominator with 18 dp
  const SCALE  = 10n ** 18n;
  const Q96    = 2n ** 96n;
  const priceScaled = BigInt(Math.round(price * 1e18));
  // sqrt(priceScaled / 1e18) * 2^96
  // = sqrt(priceScaled) * 2^96 / sqrt(1e18)
  // Use integer sqrt: sqrt(priceScaled * Q96^2 / SCALE)
  const radicand = priceScaled * Q96 * Q96 / SCALE;
  // integer sqrt via Newton–Raphson
  let x = radicand;
  let y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (y + radicand / y) / 2n; }
  return x;
}

// ── Initial liquidity seed ───────────────────────────────────────────────────
// Provide ~500 KENO and matching WBOT at current price
// (very thin bootstrap — real liquidity added after presale)
const KENO_SEED = ethers.parseUnits("500", 18);   // 500 KENO
// WBOT side: 500 * 0.001454 ≈ 0.727 — we cap at 0.5 BOT to keep gas buffer
const WBOT_SEED = ethers.parseEther("0.5");        // 0.5 WBOT

// ── ABIs ─────────────────────────────────────────────────────────────────────
const FACTORY_ABI = [
  "function createPool(address tokenA, address tokenB, uint24 fee) returns (address pool)",
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)"
];

const POOL_ABI = [
  "function initialize(uint160 sqrtPriceX96) external",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)"
];

const WBOT_ABI = [
  ...ERC20_ABI,
  "function deposit() payable",
  "function withdraw(uint256)"
];

const NFT_PM_ABI = [
  `function mint((
    address token0,
    address token1,
    uint24  fee,
    int24   tickLower,
    int24   tickUpper,
    uint256 amount0Desired,
    uint256 amount1Desired,
    uint256 amount0Min,
    uint256 amount1Min,
    address recipient,
    uint256 deadline
  ) params) returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)`
];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function poll(provider, hash, label) {
  process.stdout.write(`  Waiting for ${label}...`);
  let receipt;
  for (let i = 0; i < 60; i++) {
    receipt = await provider.getTransactionReceipt(hash);
    if (receipt) break;
    await new Promise(r => setTimeout(r, 2000));
    process.stdout.write(".");
  }
  if (!receipt) throw new Error(`${label} not confirmed after 120s`);
  console.log(` confirmed (block ${receipt.blockNumber})`);
  return receipt;
}

async function main() {
  const rawKey = process.env.BOT_WALLET_PRIVATE_KEY || "";
  const key    = rawKey.startsWith("0x") ? rawKey : "0x" + rawKey;
  if (key.length < 66) throw new Error("BOT_WALLET_PRIVATE_KEY not set");

  const provider = new ethers.JsonRpcProvider(RPC);
  const signer   = new ethers.Wallet(key, provider);
  const chainId  = (await provider.getNetwork()).chainId;

  const factory  = new ethers.Contract(FACTORY, FACTORY_ABI, signer);
  const kenoC    = new ethers.Contract(KENO,    ERC20_ABI,   signer);
  const wbotC    = new ethers.Contract(WBOT,    WBOT_ABI,    signer);
  const nftPm    = new ethers.Contract(NFT_PM,  NFT_PM_ABI,  signer);

  const sqrtPriceX96 = computeSqrtPriceX96(PRICE_WBOT_PER_KENO);

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  KENO/WBOT Pool — BDEX BOT Chain Mainnet");
  console.log(`  Chain ID:        ${chainId}`);
  console.log(`  Signer:          ${signer.address}`);
  console.log(`  KENO (token0):   ${KENO}`);
  console.log(`  WBOT (token1):   ${WBOT}`);
  console.log(`  Fee tier:        ${POOL_FEE} (${POOL_FEE/10000}%)`);
  console.log(`  Seed price:      1 KENO = ${PRICE_WBOT_PER_KENO.toFixed(6)} WBOT`);
  console.log(`  sqrtPriceX96:    ${sqrtPriceX96.toString()}`);
  console.log(`  KENO seed:       ${ethers.formatUnits(KENO_SEED,18)} KENO`);
  console.log(`  WBOT seed:       ${ethers.formatEther(WBOT_SEED)} WBOT`);
  console.log("══════════════════════════════════════════════════════════\n");

  const botBalance = await provider.getBalance(signer.address);
  console.log(`  BOT balance:     ${ethers.formatEther(botBalance)} BOT`);
  if (botBalance < ethers.parseEther("0.1")) throw new Error("Insufficient BOT for gas + seed");

  // ── Step 1: Create or fetch pool ────────────────────────────────────────
  let poolAddress = await factory.getPool(KENO, WBOT, POOL_FEE);
  if (poolAddress === ethers.ZeroAddress) {
    console.log("  [1/5] Creating KENO/WBOT pool...");
    const tx = await factory.createPool(KENO, WBOT, POOL_FEE, { gasLimit: 5_000_000 });
    console.log(`        TX: ${tx.hash}`);
    await poll(provider, tx.hash, "createPool");
    poolAddress = await factory.getPool(KENO, WBOT, POOL_FEE);
    console.log(`        Pool: ${poolAddress}`);
  } else {
    console.log(`  [1/5] Pool already exists: ${poolAddress}`);
  }

  // ── Step 2: Initialise price ────────────────────────────────────────────
  const pool = new ethers.Contract(poolAddress, POOL_ABI, signer);
  const slot0 = await pool.slot0();
  if (slot0.sqrtPriceX96 === 0n) {
    console.log("  [2/5] Initialising pool price...");
    const tx = await pool.initialize(sqrtPriceX96, { gasLimit: 200_000 });
    console.log(`        TX: ${tx.hash}`);
    await poll(provider, tx.hash, "initialize");
  } else {
    console.log(`  [2/5] Pool already initialised (sqrtPriceX96=${slot0.sqrtPriceX96})`);
  }

  // ── Step 3: Wrap BOT → WBOT ─────────────────────────────────────────────
  console.log("  [3/5] Wrapping BOT → WBOT...");
  const wbotBal = await wbotC.balanceOf(signer.address);
  const needed  = WBOT_SEED;
  if (wbotBal < needed) {
    const toWrap = needed - wbotBal;
    const tx = await wbotC.deposit({ value: toWrap, gasLimit: 60_000 });
    console.log(`        TX: ${tx.hash}`);
    await poll(provider, tx.hash, "wrap BOT→WBOT");
  } else {
    console.log(`        Already have ${ethers.formatEther(wbotBal)} WBOT`);
  }

  // ── Step 4: Approve NftPositionManager ─────────────────────────────────
  console.log("  [4/5] Approving NftPositionManager...");
  const kenoAllowance = await kenoC.allowance(signer.address, NFT_PM);
  const wbotAllowance = await wbotC.allowance(signer.address, NFT_PM);

  if (kenoAllowance < KENO_SEED) {
    const tx = await kenoC.approve(NFT_PM, ethers.MaxUint256, { gasLimit: 80_000 });
    await poll(provider, tx.hash, "approve KENO");
  } else {
    console.log("        KENO already approved");
  }

  if (wbotAllowance < WBOT_SEED) {
    const tx = await wbotC.approve(NFT_PM, ethers.MaxUint256, { gasLimit: 80_000 });
    await poll(provider, tx.hash, "approve WBOT");
  } else {
    console.log("        WBOT already approved");
  }

  // ── Step 5: Mint LP position ────────────────────────────────────────────
  console.log("  [5/5] Minting LP position (full range)...");
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const tx = await nftPm.mint(
    {
      token0:          KENO,
      token1:          WBOT,
      fee:             POOL_FEE,
      tickLower:       TICK_LOWER,
      tickUpper:       TICK_UPPER,
      amount0Desired:  KENO_SEED,
      amount1Desired:  WBOT_SEED,
      amount0Min:      0n,
      amount1Min:      0n,
      recipient:       signer.address,
      deadline
    },
    { gasLimit: 600_000 }
  );
  console.log(`        TX: ${tx.hash}`);
  const receipt = await poll(provider, tx.hash, "mint LP");

  // Decode tokenId from receipt
  const iface = new ethers.Interface([
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
  ]);
  let tokenId;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === "Transfer" && log.address.toLowerCase() === NFT_PM.toLowerCase()) {
        tokenId = parsed.args.tokenId;
      }
    } catch (_) {}
  }

  // ── Final snapshot ──────────────────────────────────────────────────────
  const [kenoAfter, wbotAfter, botAfter] = await Promise.all([
    kenoC.balanceOf(signer.address),
    wbotC.balanceOf(signer.address),
    provider.getBalance(signer.address)
  ]);
  const slot0Final = await pool.slot0();

  console.log("\n══ RESULT ═══════════════════════════════════════════════");
  console.log(`  ✅ KENO/WBOT pool LIVE on BDEX`);
  console.log(`     Pool:      ${poolAddress}`);
  if (tokenId !== undefined) console.log(`     LP NFT ID: ${tokenId}`);
  console.log(`     Explorer:  https://scan.botchain.ai/address/${poolAddress}`);
  console.log(`     BDEX:      https://dex.botchain.ai/#/swap`);
  console.log(`\n  Remaining balances:`);
  console.log(`     KENO: ${ethers.formatUnits(kenoAfter,18)}`);
  console.log(`     WBOT: ${ethers.formatEther(wbotAfter)}`);
  console.log(`     BOT:  ${ethers.formatEther(botAfter)}`);
  console.log("═════════════════════════════════════════════════════════\n");

  // ── Save record ───────────────────────────────────────────────────────
  const fs   = require("fs");
  const path = require("path");
  const rec  = JSON.parse(fs.readFileSync(path.join(__dirname,"../deployments/botchain-keno.json"),"utf8"));
  rec.bdexPool = {
    address:     poolAddress,
    feeTier:     POOL_FEE,
    token0:      KENO,
    token1:      WBOT,
    tickLower:   TICK_LOWER,
    tickUpper:   TICK_UPPER,
    lpTokenId:   tokenId?.toString() || "unknown",
    seedKeno:    ethers.formatUnits(KENO_SEED,18),
    seedWbot:    ethers.formatEther(WBOT_SEED),
    createdAt:   new Date().toISOString()
  };
  fs.writeFileSync(path.join(__dirname,"../deployments/botchain-keno.json"), JSON.stringify(rec,null,2));
  console.log("  📄 Saved to deployments/botchain-keno.json");
}

main().catch(e => { console.error(e); process.exit(1); });

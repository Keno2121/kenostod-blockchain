/**
 * Create KENO v2 / WBNB pool on PancakeSwap Infinity (v4) — BSC mainnet
 *
 * Steps:
 *   1. Wrap BNB → WBNB
 *   2. Approve CLPositionManager for KENO + WBNB
 *   3. Initialize the CL pool (with UTLHookInfinity in PoolKey)
 *   4. Mint initial liquidity position (full-range)
 *
 * Prerequisites:
 *   - UTLHookInfinity deployed; set HOOK_ADDRESS env var
 *   - Wallet has BNB and KENO v2
 *
 * Run:
 *   cd utl && HOOK_ADDRESS=0x... npx hardhat run scripts/createInfinityPool.js --network bscSafe
 */
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ── PancakeSwap Infinity BSC mainnet ──────────────────────────────────────────
const INFINITY_VAULT           = "0x238a358808379702088667322f80aC48bAd5e6c4";
const INFINITY_CL_POOL_MANAGER = "0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b";
const INFINITY_CL_POS_MANAGER  = "0x55f4c8abA71A1e923edC303eb4fEfF14608cC226";

// ── Tokens ────────────────────────────────────────────────────────────────────
const KENO_V2 = "0x48BB049Afe50B050b458624Dc6233acd51024AB4";
const WBNB    = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

// ── Pool Parameters ───────────────────────────────────────────────────────────
const POOL_FEE         = 2500;          // 0.25%
const TICK_SPACING     = 50;
const HOOK_BITMAP      = 0x0080;        // afterSwap bit (bit 7)
// parameters bytes32: bits [0-15] = hook bitmap, bits [16-39] = tickSpacing
// 0x0080 | (50 << 16) = 0x0080 | 0x320000 = 0x320080
const PARAMETERS = ethers.zeroPadValue(
  ethers.toBeHex(BigInt(HOOK_BITMAP) | (BigInt(TICK_SPACING) << 16n)),
  32
);

// ── Price: 1 BNB ≈ 10,910 KENO → price(currency1/currency0) = 9.166e-5 ───────
// KENO (0x48BB...) < WBNB (0xbb4C...) so currency0=KENO, currency1=WBNB
// sqrtPriceX96 = sqrt(9.166e-5) * 2^96
const SQRT_PRICE_X96 = 759_000_000_000_000_000_000_000_000n; // ≈ sqrt(9.166e-5) * 2^96

// ── Initial liquidity amounts ──────────────────────────────────────────────────
const KENO_INITIAL  = ethers.parseEther("100");      // 100 KENO
const WBNB_WRAP     = ethers.parseEther("0.02");     // 0.02 BNB (some used as liquidity, rest swept back)

// ── Actions enum (PancakeSwap Infinity) ───────────────────────────────────────
const Actions = {
  CL_MINT_POSITION_FROM_DELTAS: 0x05,
  SETTLE_PAIR:                  0x0d,
  SWEEP:                        0x14,
};

// ── ABIs ─────────────────────────────────────────────────────────────────────
const WBNB_ABI = [
  "function deposit() payable",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];
const CL_POS_MANAGER_ABI = [
  "function initializePool(tuple(address currency0, address currency1, address hooks, address poolManager, uint24 fee, bytes32 parameters) key, uint160 sqrtPriceX96) payable returns (int24 tick)",
  "function modifyLiquidities(bytes calldata payload, uint256 deadline) payable",
];

async function encodeModifyLiquiditiesPayload(poolKey, signer) {
  // Action: CL_MINT_POSITION_FROM_DELTAS
  // Params: (PoolKey poolKey, int24 tickLower, int24 tickUpper, uint128 amount0Max, uint128 amount1Max, address owner, bytes hookData)
  const tickLower = -887250;  // near-min for tickSpacing=50 (full range)
  const tickUpper =  887250;  // near-max for tickSpacing=50

  const mintParams = ethers.AbiCoder.defaultAbiCoder().encode(
    ["tuple(address currency0, address currency1, address hooks, address poolManager, uint24 fee, bytes32 parameters)", "int24", "int24", "uint128", "uint128", "address", "bytes"],
    [
      [poolKey.currency0, poolKey.currency1, poolKey.hooks, poolKey.poolManager, poolKey.fee, poolKey.parameters],
      tickLower,
      tickUpper,
      KENO_INITIAL,               // amount0Max (KENO)
      ethers.parseEther("0.015"), // amount1Max (WBNB) — more than enough at current price
      signer.address,
      "0x",
    ]
  );

  // Action: SETTLE_PAIR — pay both tokens from msg.sender
  const settlePairParams = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address"],
    [KENO_V2, WBNB]
  );

  // Action: SWEEP — return unused WBNB to sender
  const sweepParams = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address"],
    [WBNB, signer.address]
  );

  // Encode actions as bytes (concatenated uint8 action IDs)
  const actions = ethers.concat([
    ethers.toBeHex(Actions.CL_MINT_POSITION_FROM_DELTAS, 1),
    ethers.toBeHex(Actions.SETTLE_PAIR, 1),
    ethers.toBeHex(Actions.SWEEP, 1),
  ]);

  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes", "bytes[]"],
    [actions, [mintParams, settlePairParams, sweepParams]]
  );
}

async function main() {
  const hookAddress = process.env.HOOK_ADDRESS;
  if (!hookAddress) {
    // Try to read from deployment record
    const recordPath = path.join(__dirname, "../deployments/utlhook-infinity-bsc.json");
    if (fs.existsSync(recordPath)) {
      const record = JSON.parse(fs.readFileSync(recordPath, "utf8"));
      process.env.HOOK_ADDRESS = record.address;
      console.log("Using hook from deployment record:", record.address);
    } else {
      throw new Error("Set HOOK_ADDRESS env var or deploy the hook first");
    }
  }

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("BNB balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)));

  const hook = process.env.HOOK_ADDRESS;
  console.log("Hook address:", hook);
  console.log("parameters:  ", PARAMETERS);

  // Validate parameters encoding
  const paramsNum = BigInt(PARAMETERS);
  const bitmapFromParams = paramsNum & 0xFFFFn;
  const tsFromParams = (paramsNum >> 16n) & 0xFFFFFFn;
  console.log(`  → bitmap from params: 0x${bitmapFromParams.toString(16)} (expected 0x0080)`);
  console.log(`  → tickSpacing from params: ${tsFromParams} (expected 50)`);

  // ── Build PoolKey ──────────────────────────────────────────────────────────
  const poolKey = {
    currency0:   KENO_V2,              // lower address
    currency1:   WBNB,
    hooks:       hook,
    poolManager: INFINITY_CL_POOL_MANAGER,
    fee:         POOL_FEE,
    parameters:  PARAMETERS,
  };

  console.log("\nPoolKey:", JSON.stringify(poolKey, null, 2));

  const wbnb        = new ethers.Contract(WBNB,                   WBNB_ABI,          signer);
  const keno        = new ethers.Contract(KENO_V2,                ERC20_ABI,         signer);
  const posManager  = new ethers.Contract(INFINITY_CL_POS_MANAGER, CL_POS_MANAGER_ABI, signer);

  // ── Step 1: Wrap BNB → WBNB ───────────────────────────────────────────────
  console.log("\n[1] Wrapping", ethers.formatEther(WBNB_WRAP), "BNB → WBNB...");
  const wrapTx = await wbnb.deposit({ value: WBNB_WRAP, gasLimit: 100_000 });
  await wrapTx.wait();
  console.log("  WBNB balance:", ethers.formatEther(await wbnb.balanceOf(signer.address)));

  // ── Step 2: Approve CLPositionManager ────────────────────────────────────
  console.log("\n[2] Approving CLPositionManager for KENO + WBNB...");
  const MAX = ethers.MaxUint256;
  await (await keno.approve(INFINITY_CL_POS_MANAGER, MAX, { gasLimit: 100_000 })).wait();
  await (await wbnb.approve(INFINITY_CL_POS_MANAGER, MAX, { gasLimit: 100_000 })).wait();
  console.log("  Approvals done.");

  // ── Step 3: Initialize pool ───────────────────────────────────────────────
  console.log("\n[3] Initializing KENO/WBNB Infinity CL pool...");
  const initTx = await posManager.initializePool(poolKey, SQRT_PRICE_X96, { gasLimit: 500_000 });
  const initReceipt = await initTx.wait();
  console.log("  Pool initialized! tx:", initReceipt.hash);

  // ── Step 4: Add initial liquidity ─────────────────────────────────────────
  console.log("\n[4] Adding initial liquidity (100 KENO + up to 0.015 WBNB)...");
  const payload  = await encodeModifyLiquiditiesPayload(poolKey, signer);
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  const kenoBalance = await keno.balanceOf(signer.address);
  console.log("  KENO balance:", ethers.formatEther(kenoBalance));
  if (kenoBalance < KENO_INITIAL) {
    console.warn("  WARNING: insufficient KENO balance — adding minimal liquidity may fail");
    console.warn("  Send KENO v2 to", signer.address, "and re-run step 4");
  }

  const mintTx = await posManager.modifyLiquidities(payload, deadline, { gasLimit: 1_500_000 });
  const mintReceipt = await mintTx.wait();
  console.log("  Liquidity added! tx:", mintReceipt.hash);

  // ── Step 5: Register pool on hook ─────────────────────────────────────────
  console.log("\n[5] Registering pool on UTLHookInfinity...");
  const hookContract = new ethers.Contract(hook, [
    "function registerPool(tuple(address currency0, address currency1, address hooks, address poolManager, uint24 fee, bytes32 parameters) key) external",
    "function isPoolRegistered(tuple(address currency0, address currency1, address hooks, address poolManager, uint24 fee, bytes32 parameters) key) view returns (bool)",
  ], signer);

  const registerTx = await hookContract.registerPool(
    [poolKey.currency0, poolKey.currency1, poolKey.hooks, poolKey.poolManager, poolKey.fee, poolKey.parameters],
    { gasLimit: 100_000 }
  );
  await registerTx.wait();

  const isRegistered = await hookContract.isPoolRegistered(
    [poolKey.currency0, poolKey.currency1, poolKey.hooks, poolKey.poolManager, poolKey.fee, poolKey.parameters]
  );
  console.log("  Pool registered:", isRegistered ? "YES ✓" : "NO ✗");

  // ── Save pool record ───────────────────────────────────────────────────────
  const record = {
    network: "bsc",
    chainId: 56,
    description: "KENO v2 / WBNB — PancakeSwap Infinity CL pool",
    poolKey,
    sqrtPriceX96: SQRT_PRICE_X96.toString(),
    initTx: initReceipt.hash,
    mintTx: mintReceipt.hash,
    createdAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, "../deployments/infinity-pool-bsc.json");
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2));
  console.log("\nPool record saved to:", outPath);
  console.log("\n✓ PancakeSwap Infinity KENO/WBNB pool is LIVE.");
  console.log("  UTLHookInfinity will now intercept every swap and forward 0.09% to FeeCollector.");
}

main().catch((e) => { console.error(e); process.exit(1); });

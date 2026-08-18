/**
 * Add initial liquidity to the already-initialized KENO/WBNB Infinity pool
 * and register it on UTLHookInfinity.
 *
 * Uses CL_MINT_POSITION (0x02) with explicit liquidity — not FROM_DELTAS.
 *
 * Run:
 *   cd utl && npx hardhat run scripts/addInfinityLiquidity.js --network bscBot
 */
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ── PancakeSwap Infinity BSC mainnet ──────────────────────────────────────────
const INFINITY_CL_POS_MANAGER = "0x55f4c8abA71A1e923edC303eb4fEfF14608cC226";

// ── Tokens & addresses ────────────────────────────────────────────────────────
const KENO_V2 = "0x48BB049Afe50B050b458624Dc6233acd51024AB4";
const WBNB    = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const HOOK    = "0xD240F0f86Dd925d427D86765A7708592E57381C8";
const CL_PM   = "0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b";

// ── Pool config ───────────────────────────────────────────────────────────────
const POOL_FEE     = 2500;
const PARAMETERS   = "0x0000000000000000000000000000000000000000000000000000000000320080";

// Liquidity calculated from 100 KENO at sqrtPriceX96 ≈ 759e24
// L = amount0 * sqrtP / 2^96  →  957_992_683_300_396_736
const LIQUIDITY     = 957_992_683_300_396_736n;

// Slippage limits: max tokens we're willing to spend (add a bit of buffer)
const AMOUNT0_MAX   = ethers.parseEther("110");    // 110 KENO max
const AMOUNT1_MAX   = ethers.parseEther("0.020");  // 0.020 WBNB max

// Ticks: full range for tickSpacing=50
const TICK_LOWER    = -887250;
const TICK_UPPER    =  887250;

// ── Actions ───────────────────────────────────────────────────────────────────
const Actions = {
  CL_MINT_POSITION: 0x02,
  SETTLE_PAIR:      0x0d,
  SWEEP:            0x14,
};

// ── Permit2 ───────────────────────────────────────────────────────────────────
// CLPositionManager uses Permit2 for token transfers — not raw ERC-20 transferFrom.
// We must: (1) approve Permit2 in the ERC-20, (2) set Permit2 allowance to CLPositionManager.
const PERMIT2 = "0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768";

// ── ABIs ─────────────────────────────────────────────────────────────────────
const WBNB_ABI = [
  "function deposit() payable",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];
// Permit2 IAllowanceTransfer.approve(token, spender, amount, expiration)
const PERMIT2_ABI = [
  "function approve(address token, address spender, uint160 amount, uint48 expiration) external",
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
];
const CL_POS_ABI = [
  "function modifyLiquidities(bytes calldata payload, uint256 deadline) payable",
];
const HOOK_ABI = [
  "function registerPool(tuple(address currency0, address currency1, address hooks, address poolManager, uint24 fee, bytes32 parameters) key) external",
  "function isPoolRegistered(tuple(address currency0, address currency1, address hooks, address poolManager, uint24 fee, bytes32 parameters) key) view returns (bool)",
];

function buildPoolKeyTuple() {
  return [KENO_V2, WBNB, HOOK, CL_PM, POOL_FEE, PARAMETERS];
}

function encodePayload(ownerAddress) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  // Action 1: CL_MINT_POSITION
  // Params: (PoolKey, int24 tickLower, int24 tickUpper, uint128 liquidity,
  //          uint128 amount0Max, uint128 amount1Max, address owner, bytes hookData)
  const poolKeyType = "tuple(address currency0, address currency1, address hooks, address poolManager, uint24 fee, bytes32 parameters)";
  const mintParams = abiCoder.encode(
    [poolKeyType, "int24", "int24", "uint128", "uint128", "uint128", "address", "bytes"],
    [buildPoolKeyTuple(), TICK_LOWER, TICK_UPPER, LIQUIDITY, AMOUNT0_MAX, AMOUNT1_MAX, ownerAddress, "0x"]
  );

  // Action 2: SETTLE_PAIR (pulls currency0 + currency1 from sender)
  const settlePairParams = abiCoder.encode(["address", "address"], [KENO_V2, WBNB]);

  // Action 3: SWEEP (return excess WBNB)
  const sweepParams = abiCoder.encode(["address", "address"], [WBNB, ownerAddress]);

  // Build actions bytes (one byte per action ID)
  const actions = ethers.concat([
    ethers.toBeHex(Actions.CL_MINT_POSITION, 1),
    ethers.toBeHex(Actions.SETTLE_PAIR, 1),
    ethers.toBeHex(Actions.SWEEP, 1),
  ]);

  return abiCoder.encode(
    ["bytes", "bytes[]"],
    [actions, [mintParams, settlePairParams, sweepParams]]
  );
}

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("BNB balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)));

  const wbnb    = new ethers.Contract(WBNB,                   WBNB_ABI,   signer);
  const keno    = new ethers.Contract(KENO_V2,                ERC20_ABI,  signer);
  const posMgr  = new ethers.Contract(INFINITY_CL_POS_MANAGER, CL_POS_ABI, signer);
  const hookC   = new ethers.Contract(HOOK,                   HOOK_ABI,   signer);

  // ── Wrap extra BNB → WBNB if needed ─────────────────────────────────────────
  const wbnbBal = await wbnb.balanceOf(signer.address);
  console.log("\nWBNB balance:", ethers.formatEther(wbnbBal));
  if (wbnbBal < AMOUNT1_MAX) {
    const toWrap = AMOUNT1_MAX - wbnbBal + ethers.parseEther("0.002"); // small buffer
    console.log("Wrapping", ethers.formatEther(toWrap), "BNB → WBNB...");
    await (await wbnb.deposit({ value: toWrap, gasLimit: 100_000 })).wait();
    console.log("New WBNB balance:", ethers.formatEther(await wbnb.balanceOf(signer.address)));
  }

  // ── Step 1: Approve Permit2 in the ERC-20 contracts ──────────────────────
  // CLPositionManager pulls tokens via Permit2, not direct ERC-20 transferFrom.
  // First give Permit2 an unlimited ERC-20 allowance.
  console.log("\nEnsuring ERC-20 approvals to Permit2 contract...");
  const MAX = ethers.MaxUint256;

  const kenoAllowanceToP2 = await keno.allowance(signer.address, PERMIT2);
  if (kenoAllowanceToP2 < ethers.parseEther("1000000")) {
    console.log("  Approving KENO → Permit2...");
    await (await keno.approve(PERMIT2, MAX, { gasLimit: 100_000 })).wait();
  } else {
    console.log("  KENO → Permit2 allowance already set.");
  }

  const wbnbAllowanceToP2 = await wbnb.allowance(signer.address, PERMIT2);
  if (wbnbAllowanceToP2 < ethers.parseEther("1")) {
    console.log("  Approving WBNB → Permit2...");
    await (await wbnb.approve(PERMIT2, MAX, { gasLimit: 100_000 })).wait();
  } else {
    console.log("  WBNB → Permit2 allowance already set.");
  }

  // ── Step 2: Set Permit2 allowance for CLPositionManager ───────────────────
  // Permit2.approve(token, spender, amount, expiration)
  // amount is uint160 (max ~1.46e48), expiration is uint48 Unix timestamp.
  const permit2 = new ethers.Contract(PERMIT2, PERMIT2_ABI, signer);
  const P2_AMOUNT = (2n ** 160n) - 1n;                 // max uint160
  const P2_EXPIRY = Math.floor(Date.now() / 1000) + 365 * 24 * 3600 * 10; // ~10 years

  const [kenoP2amount] = await permit2.allowance(signer.address, KENO_V2, INFINITY_CL_POS_MANAGER);
  if (kenoP2amount === 0n) {
    console.log("  Setting Permit2 KENO → CLPositionManager...");
    await (await permit2.approve(KENO_V2, INFINITY_CL_POS_MANAGER, P2_AMOUNT, P2_EXPIRY, { gasLimit: 100_000 })).wait();
  } else {
    console.log("  Permit2 KENO → CLPositionManager already set, amount:", kenoP2amount.toString());
  }

  const [wbnbP2amount] = await permit2.allowance(signer.address, WBNB, INFINITY_CL_POS_MANAGER);
  if (wbnbP2amount === 0n) {
    console.log("  Setting Permit2 WBNB → CLPositionManager...");
    await (await permit2.approve(WBNB, INFINITY_CL_POS_MANAGER, P2_AMOUNT, P2_EXPIRY, { gasLimit: 100_000 })).wait();
  } else {
    console.log("  Permit2 WBNB → CLPositionManager already set, amount:", wbnbP2amount.toString());
  }
  console.log("Permit2 allowances set ✓");

  // ── Add liquidity (CL_MINT_POSITION with explicit liquidity) ──────────────
  console.log("\nAdding initial liquidity...");
  console.log("  Liquidity:    ", LIQUIDITY.toString());
  console.log("  KENO amount0 max:", ethers.formatEther(AMOUNT0_MAX));
  console.log("  WBNB amount1 max:", ethers.formatEther(AMOUNT1_MAX));
  console.log("  tickLower:", TICK_LOWER, " tickUpper:", TICK_UPPER);

  const payload  = encodePayload(signer.address);
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  const mintTx = await posMgr.modifyLiquidities(payload, deadline, { gasLimit: 2_000_000 });
  const receipt = await mintTx.wait();

  if (receipt.status !== 1) throw new Error("modifyLiquidities failed");
  console.log("  Liquidity added! tx:", receipt.hash);

  // ── Register pool on hook ─────────────────────────────────────────────────
  console.log("\nRegistering pool on UTLHookInfinity...");
  const poolKeyTuple = buildPoolKeyTuple();
  await (await hookC.registerPool(poolKeyTuple, { gasLimit: 100_000 })).wait();

  const registered = await hookC.isPoolRegistered(poolKeyTuple);
  console.log("  Pool registered:", registered ? "YES ✓" : "NO ✗");

  // ── Save record ───────────────────────────────────────────────────────────
  const record = {
    network: "bsc",
    chainId: 56,
    description: "KENO v2 / WBNB — PancakeSwap Infinity CL pool",
    poolKey: {
      currency0:   KENO_V2,
      currency1:   WBNB,
      hooks:       HOOK,
      poolManager: CL_PM,
      fee:         POOL_FEE,
      parameters:  PARAMETERS,
    },
    liquidity:   LIQUIDITY.toString(),
    mintTx:      receipt.hash,
    createdAt:   new Date().toISOString(),
  };
  const outPath = path.join(__dirname, "../deployments/infinity-pool-bsc.json");
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2));
  console.log("\nPool record saved to:", outPath);
  console.log("\n✓ PancakeSwap Infinity KENO/WBNB pool is LIVE with initial liquidity.");
  console.log("  Every swap now triggers UTLHookInfinity → 0.09% → UTLFeeCollector.");
}

main().catch((e) => { console.error(e); process.exit(1); });

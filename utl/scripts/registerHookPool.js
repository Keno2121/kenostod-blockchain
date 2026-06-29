/**
 * Register KENO/USDC Pool with UTLHook
 * 
 * After deploying UTLHook, run this script to register the KENO/USDC pool
 * so the hook activates for every swap.
 * 
 * Usage:
 *   HOOK_ADDRESS=0x... npx hardhat run scripts/registerHookPool.js --network bscSafe
 */

const { ethers } = require("hardhat");

// Tokens
const KENO = "0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E";
const USDC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

async function main() {
  const [owner] = await ethers.getSigners();
  
  const hookAddress = process.env.HOOK_ADDRESS;
  if (!hookAddress) throw new Error("Set HOOK_ADDRESS env var");

  console.log("=== Registering Pool with UTLHook ===");
  console.log("Owner:", owner.address);
  console.log("Hook: ", hookAddress);

  const UTLHook = await ethers.getContractFactory("UTLHook");
  const hook = UTLHook.attach(hookAddress);

  // KENO/USDC pool key — currency0 < currency1 (sort by address)
  const [currency0, currency1] = KENO.toLowerCase() < USDC.toLowerCase()
    ? [KENO, USDC]
    : [USDC, KENO];

  const poolKey = {
    currency0,
    currency1,
    fee: 500,          // 0.05% fee tier (PancakeSwap v4 standard)
    tickSpacing: 10,   // corresponds to 0.05% fee tier
    hooks: hookAddress
  };

  console.log("\nPool Key:");
  console.log("  currency0:", poolKey.currency0);
  console.log("  currency1:", poolKey.currency1);
  console.log("  fee:      ", poolKey.fee);
  console.log("  hooks:    ", poolKey.hooks);

  const tx = await hook.registerPool(poolKey);
  const receipt = await tx.wait();
  
  console.log("\n✅ Pool registered! Tx:", receipt.hash);
  
  // Also register KENO/WBNB pool if desired
  const registerWBNB = process.env.REGISTER_WBNB === "true";
  if (registerWBNB) {
    const [c0, c1] = KENO.toLowerCase() < WBNB.toLowerCase()
      ? [KENO, WBNB]
      : [WBNB, KENO];

    const wbnbPoolKey = {
      currency0: c0,
      currency1: c1,
      fee: 2500,     // 0.25% fee tier for KENO/WBNB
      tickSpacing: 50,
      hooks: hookAddress
    };

    const tx2 = await hook.registerPool(wbnbPoolKey);
    await tx2.wait();
    console.log("✅ KENO/WBNB pool also registered");
  }

  console.log("\nUTLHook is now active for registered pools.");
  console.log("Every swap will send 0.09% to UTLFeeCollector → KENO stakers.");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err.message);
    process.exit(1);
  });

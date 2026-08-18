/**
 * Deploy UTLHookInfinity to BSC mainnet
 *
 * Uses bscSafe network (NEW_WALLET_PRIVATE_KEY) so the hook owner
 * matches the wallet that will later call registerPool().
 *
 * Run:
 *   cd utl && npx hardhat run scripts/deployInfinityHook.js --network bscSafe
 */
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// PancakeSwap Infinity BSC mainnet addresses (verified April 2025)
const INFINITY_VAULT          = "0x238a358808379702088667322f80aC48bAd5e6c4";
const INFINITY_CL_POOL_MANAGER = "0xa0FfB9c1CE1Fe56963B0321B32E7A0302114058b";

// UTLFeeCollector v1.1 (already live)
const FEE_COLLECTOR = "0xb9489B33Bd9bB835139369b1dD282fB44B2273d8";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  console.log("\nDeploying UTLHookInfinity...");
  console.log("  vault:        ", INFINITY_VAULT);
  console.log("  poolManager:  ", INFINITY_CL_POOL_MANAGER);
  console.log("  feeCollector: ", FEE_COLLECTOR);

  const Factory = await ethers.getContractFactory("UTLHookInfinity");
  const hook = await Factory.deploy(
    INFINITY_VAULT,
    INFINITY_CL_POOL_MANAGER,
    FEE_COLLECTOR,
    { gasLimit: 2_000_000 }
  );
  await hook.waitForDeployment();

  const hookAddress = await hook.getAddress();
  console.log("\nUTLHookInfinity deployed at:", hookAddress);

  // Verify bitmap
  const bitmap = await hook.getHooksRegistrationBitmap();
  console.log("getHooksRegistrationBitmap():", "0x" + bitmap.toString(16).padStart(4, "0"),
    "(afterSwap bit =", (BigInt(bitmap) & 0x80n) !== 0n ? "SET ✓" : "NOT SET ✗", ")");

  // Verify addresses
  console.log("vault():       ", await hook.vault());
  console.log("poolManager(): ", await hook.poolManager());
  console.log("feeCollector():", await hook.feeCollector());
  console.log("owner():       ", await hook.owner());

  // Save deployment record
  const record = {
    network: "bsc",
    chainId: 56,
    contractName: "UTLHookInfinity",
    address: hookAddress,
    vault: INFINITY_VAULT,
    poolManager: INFINITY_CL_POOL_MANAGER,
    feeCollector: FEE_COLLECTOR,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "../deployments/utlhook-infinity-bsc.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2));
  console.log("\nDeployment record saved to:", outPath);

  console.log("\nNext step:");
  console.log("  npx hardhat run scripts/createInfinityPool.js --network bscSafe");
  console.log("  (pass HOOK_ADDRESS=" + hookAddress + " as env var)");
}

main().catch((e) => { console.error(e); process.exit(1); });

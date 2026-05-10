/**
 * UTLHook Deployment Script
 * 
 * BEFORE RUNNING:
 *   1. Run mineHookSalt.js to find a valid CREATE2 salt
 *   2. Paste the salt into HOOK_SALT below
 *   3. Make sure NEW_WALLET_PRIVATE_KEY is set in .env
 *   4. Ensure your safe wallet has enough BNB for gas (~0.01 BNB)
 * 
 * Deploy:
 *   npx hardhat run scripts/deployUTLHook.js --network bscSafe
 * 
 * Verify:
 *   npx hardhat verify --network bsc <HOOK_ADDRESS> <POOL_MANAGER> <FEE_COLLECTOR>
 */

const { ethers } = require("hardhat");

// ── Configuration ─────────────────────────────────────────────────────────────

// PancakeSwap v4 CLPoolManager on BSC Mainnet
const POOL_MANAGER = "0x28e2Ea090877bE573591Cba87A5fEB42AC4Ed9aF";

// Deployed UTLFeeCollector (BSC Mainnet)
const FEE_COLLECTOR = "0xfE537c43d202C455Cedc141B882c808287BB662f";

// Paste the salt from mineHookSalt.js here
// Example: "0xabc123..."
const HOOK_SALT = process.env.HOOK_SALT || null;

// Safe wallet (deployer)
// Make sure NEW_WALLET_PRIVATE_KEY is set for bscSafe network

// ── Deploy ────────────────────────────────────────────────────────────────────

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=== UTLHook Deployment ===");
  console.log("Deployer:     ", deployer.address);
  console.log("Pool Manager: ", POOL_MANAGER);
  console.log("Fee Collector:", FEE_COLLECTOR);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:      ", ethers.formatEther(balance), "BNB\n");

  if (balance < ethers.parseEther("0.005")) {
    throw new Error("Insufficient BNB for deployment. Need at least 0.005 BNB.");
  }

  const UTLHook = await ethers.getContractFactory("UTLHook");

  let hook;

  if (HOOK_SALT && HOOK_SALT !== "null") {
    // CREATE2 deployment with mined salt
    console.log("Deploying with CREATE2 salt:", HOOK_SALT);
    
    // Use Hardhat's built-in CREATE2 factory (deployed at 0x4e59b44847b379578588920cA78FbF26c0B4956C)
    const CREATE2_FACTORY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
    
    const initCode = UTLHook.bytecode + 
      UTLHook.interface.encodeDeploy([POOL_MANAGER, FEE_COLLECTOR]).slice(2);
    
    const saltBytes = ethers.zeroPadValue(HOOK_SALT, 32);
    const tx = await deployer.sendTransaction({
      to: CREATE2_FACTORY,
      data: saltBytes + initCode.slice(2),
      gasLimit: 3_000_000,
    });
    
    const receipt = await tx.wait();
    
    // Compute the deployed address
    const initCodeHash = ethers.keccak256(initCode);
    const packed = ethers.solidityPacked(
      ["bytes1", "address", "bytes32", "bytes32"],
      ["0xff", CREATE2_FACTORY, saltBytes, initCodeHash]
    );
    const addressHash = ethers.keccak256(packed);
    const hookAddress = ethers.getAddress("0x" + addressHash.slice(-40));
    
    console.log("\n✅ UTLHook deployed via CREATE2");
    console.log("Hook address:", hookAddress);
    console.log("Tx hash:     ", receipt.hash);
    
    hook = UTLHook.attach(hookAddress);
  } else {
    // Standard deployment (address won't have required bits — use for testing only)
    console.log("⚠️  No HOOK_SALT provided — standard deployment (testnet only)");
    hook = await UTLHook.deploy(POOL_MANAGER, FEE_COLLECTOR);
    await hook.waitForDeployment();
    console.log("\n✅ UTLHook deployed:", await hook.getAddress());
  }

  const hookAddress = await hook.getAddress();

  // Validate hook address flags
  try {
    const isValid = await hook.validateHookAddress();
    if (isValid) {
      console.log("✅ Hook address flags: VALID (0x0040 bit set)");
    } else {
      console.log("⚠️  Hook address flags: INVALID — re-mine salt before mainnet use");
    }
  } catch (e) {
    console.log("Note: Could not validate flags (contract not yet indexed)");
  }

  // Print stats
  console.log("\n=== Deployment Summary ===");
  console.log("UTLHook:       ", hookAddress);
  console.log("Pool Manager:  ", POOL_MANAGER);
  console.log("Fee Collector: ", FEE_COLLECTOR);
  console.log("Owner:         ", deployer.address);
  console.log("\nNext steps:");
  console.log("1. Create KENO/USDC pool with this hook address in the PoolKey");
  console.log("2. Call hook.registerPool(poolKey) from the owner wallet");
  console.log("3. Monitor fees flowing into UTLFeeCollector");
  console.log("4. Call UTLFeeCollector.forwardTokenFees(USDC) periodically to distribute to stakers");

  // Save deployment record
  const fs = require("fs");
  const deployment = {
    network: "bsc",
    chainId: 56,
    contractName: "UTLHook",
    address: hookAddress,
    poolManager: POOL_MANAGER,
    feeCollector: FEE_COLLECTOR,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    salt: HOOK_SALT || "standard"
  };

  const deployPath = `./deployments/utlhook-bsc.json`;
  fs.writeFileSync(deployPath, JSON.stringify(deployment, null, 2));
  console.log("\n📄 Deployment record saved to:", deployPath);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Deployment failed:", err.message);
    process.exit(1);
  });

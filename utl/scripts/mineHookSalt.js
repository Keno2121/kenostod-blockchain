/**
 * UTLHook CREATE2 Salt Miner
 * 
 * PancakeSwap v4 requires hook addresses to have specific bits set.
 * UTLHook implements afterSwap, which requires bit 0x0040 (bit 6) set.
 * 
 * This script mines a CREATE2 salt so the resulting UTLHook address
 * has the required bits set.
 * 
 * Usage:
 *   node scripts/mineHookSalt.js
 * 
 * Output: A salt value you pass to the CREATE2 deployer contract.
 */

const { ethers } = require("hardhat");
const crypto = require("crypto");

// PancakeSwap v4 afterSwap hook flag — bit 6 of the lower 2 bytes
const AFTER_SWAP_FLAG = 0x0040n;

// All hook flags that UTLHook uses (only afterSwap)
const REQUIRED_FLAGS = AFTER_SWAP_FLAG;

// Mask: only check the lower 2 bytes (bits 0-15)
const FLAGS_MASK = 0xFFFFn;

async function main() {
  console.log("=== UTLHook CREATE2 Salt Miner ===\n");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Get the UTLHook artifact for its bytecode
  const UTLHook = await ethers.getContractFactory("UTLHook");

  // Constructor args — update these to your actual addresses before mining
  const POOL_MANAGER  = "0x28E2eA090877Be573591cba87A5feB42aC4ed9AF"; // PancakeSwap v4 CLPoolManager BSC
  const FEE_COLLECTOR = "0xb9489B33Bd9bB835139369b1dD282fB44B2273d8"; // UTLFeeCollector v1.1 deployed

  const initCode = UTLHook.bytecode + 
    UTLHook.interface.encodeDeploy([POOL_MANAGER, FEE_COLLECTOR]).slice(2);

  const initCodeHash = ethers.keccak256(initCode);
  console.log("Init code hash:", initCodeHash);
  console.log("Required flags: 0x" + REQUIRED_FLAGS.toString(16).toUpperCase());
  console.log("\nMining salt...\n");

  // CREATE2 address = keccak256(0xff ++ deployer ++ salt ++ keccak256(initCode))[12:]
  // We try random salts until we get the right flags
  let attempts = 0;
  const startTime = Date.now();

  while (true) {
    const saltBytes = crypto.randomBytes(32);
    const saltHex = "0x" + saltBytes.toString("hex");

    // Compute CREATE2 address
    const packed = ethers.solidityPacked(
      ["bytes1", "address", "bytes32", "bytes32"],
      ["0xff", deployer.address, saltHex, initCodeHash]
    );
    const addressHash = ethers.keccak256(packed);
    const address = "0x" + addressHash.slice(-40);

    // Check flags
    const addrBigInt = BigInt(address);
    const addrFlags = addrBigInt & FLAGS_MASK;

    if ((addrFlags & REQUIRED_FLAGS) === REQUIRED_FLAGS) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log("✅ FOUND valid salt after", attempts.toLocaleString(), "attempts in", elapsed, "s\n");
      console.log("Salt:         ", saltHex);
      console.log("Hook address: ", ethers.getAddress(address));
      console.log("Address flags:", "0x" + addrFlags.toString(16).toUpperCase());
      console.log("\nSave this salt for the deployment script!");
      return;
    }

    attempts++;

    if (attempts % 100_000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\rAttempts: ${attempts.toLocaleString()} (${elapsed}s elapsed)...`);
    }
  }
}

main().catch(console.error);

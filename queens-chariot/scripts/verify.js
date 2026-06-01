/**
 * Queens Chariot Token (QCT) — Basescan Verification Script
 * Run: npm run verify:mainnet   (or :testnet for Sepolia)
 */

const { run, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  const chainName  = network.name;
  const recordPath = path.join(__dirname, "..", "deployments", `qct-${chainName}.json`);

  if (!fs.existsSync(recordPath)) {
    throw new Error(`No deployment found for ${chainName}. Run deploy first.`);
  }

  const record  = JSON.parse(fs.readFileSync(recordPath, "utf8"));
  const address = record.contractAddress;
  const wallets = record.wallets;

  console.log(`\nVerifying QCT on ${chainName}...`);
  console.log(`Contract: ${address}`);

  await run("verify:verify", {
    address,
    constructorArguments: [
      wallets.prosperityPool,
      wallets.liquidityFortress,
      wallets.devTreasury,
      wallets.foundingCourt,
      wallets.partnerships,
      wallets.emergencyReserve,
    ],
  });

  console.log("✅ Contract verified on Basescan");
}

main().catch((err) => {
  console.error("Verification failed:", err.message);
  process.exit(1);
});

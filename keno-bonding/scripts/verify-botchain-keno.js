/**
 * Verify the deployed KENO token on BOT Chain Scan.
 *
 * Usage:
 *   cd keno-bonding
 *   npm run verify:botchain:keno
 *
 * KenostodToken was deployed with solc 0.8.28, optimizer 200, Cancun EVM.
 * hardhat.config.js pins those settings for this source file so the artifact
 * reproduces the bytecode at the recorded BOT Chain address.
 */
const hre = require("hardhat");
const deployment = require("../deployments/botchain-keno.json");

const BOT_WALLET = "0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2";

async function main() {
  if (hre.network.name !== "botchain") {
    throw new Error(`Wrong network: expected botchain, received ${hre.network.name}`);
  }

  await hre.run("verify:verify", {
    address: deployment.address,
    constructorArguments: [
      BOT_WALLET,
      BOT_WALLET,
      BOT_WALLET,
      BOT_WALLET
    ],
    contract: "contracts/KenostodToken.sol:KenostodToken"
  });

  console.log(`Verified source: https://scan.botchain.ai/address/${deployment.address}#code`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
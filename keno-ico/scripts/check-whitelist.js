const hre = require("hardhat");

const PRESALE_CONTRACT_ADDRESS = "0xE26D6fcf7f3d560a8acEB43fa904Bef31b1fB6D0";

async function main() {
  console.log("🔍 KENO Presale Whitelist Checker\n");

  const presale = await hre.ethers.getContractAt("KENOPresale", PRESALE_CONTRACT_ADDRESS);

  const addresses = process.argv.slice(2);

  if (addresses.length === 0) {
    console.log("❌ No addresses provided!");
    console.log("\nUsage:");
    console.log("  npx hardhat run scripts/check-whitelist.js --network bsc ADDRESS1 ADDRESS2 ADDRESS3...");
    console.log("\nExample:");
    console.log("  npx hardhat run scripts/check-whitelist.js --network bsc 0x1234... 0x5678...");
    process.exit(1);
  }

  console.log(`Checking ${addresses.length} address(es)...\n`);

  for (const address of addresses) {
    if (!ethers.utils.isAddress(address)) {
      console.log(`❌ ${address} - Invalid address format`);
      continue;
    }

    try {
      const isWhitelisted = await presale.isWhitelisted(address);
      const purchased = await presale.purchasedAmountPrivate(address);
      
      if (isWhitelisted) {
        console.log(`✅ ${address}`);
        console.log(`   Status: Whitelisted`);
        console.log(`   Already Purchased: ${ethers.utils.formatEther(purchased)} BNB\n`);
      } else {
        console.log(`❌ ${address}`);
        console.log(`   Status: Not whitelisted\n`);
      }
    } catch (error) {
      console.log(`❌ ${address} - Error:`, error.message, "\n");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

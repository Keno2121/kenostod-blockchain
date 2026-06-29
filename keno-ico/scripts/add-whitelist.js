const hre = require("hardhat");

const PRESALE_CONTRACT_ADDRESS = "0xE26D6fcf7f3d560a8acEB43fa904Bef31b1fB6D0";

async function main() {
  console.log("🔐 KENO Presale Whitelist Manager\n");

  const [owner] = await hre.ethers.getSigners();
  console.log("Managing whitelist with account:", owner.address);
  console.log("Account balance:", ethers.utils.formatEther(await owner.provider.getBalance(owner.address)), "BNB\n");

  const presale = await hre.ethers.getContractAt("KENOPresale", PRESALE_CONTRACT_ADDRESS);

  const addresses = process.argv.slice(2);

  if (addresses.length === 0) {
    console.log("❌ No addresses provided!");
    console.log("\nUsage:");
    console.log("  npx hardhat run scripts/add-whitelist.js --network bsc ADDRESS1 ADDRESS2 ADDRESS3...");
    console.log("\nExample:");
    console.log("  npx hardhat run scripts/add-whitelist.js --network bsc 0x1234... 0x5678...");
    console.log("\nOr use the batch CSV method:");
    console.log("  node scripts/whitelist-from-csv.js");
    process.exit(1);
  }

  console.log(`📝 Adding ${addresses.length} address(es) to whitelist...\n`);

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    
    if (!ethers.utils.isAddress(address)) {
      console.log(`❌ Invalid address: ${address} - Skipping`);
      continue;
    }

    const isAlreadyWhitelisted = await presale.isWhitelisted(address);
    
    if (isAlreadyWhitelisted) {
      console.log(`⚠️  ${address} - Already whitelisted`);
      continue;
    }

    try {
      console.log(`➕ Adding ${address}...`);
      const tx = await presale.updateWhitelist(address, true);
      await tx.wait();
      console.log(`✅ ${address} - Whitelisted! (tx: ${tx.hash})\n`);
    } catch (error) {
      console.log(`❌ Failed to whitelist ${address}:`, error.message, "\n");
    }
  }

  console.log("✨ Whitelist update complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

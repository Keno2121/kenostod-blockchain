const hre = require("hardhat");

const PRESALE_CONTRACT_ADDRESS = "0xE26D6fcf7f3d560a8acEB43fa904Bef31b1fB6D0";

async function main() {
  console.log("🗑️  KENO Presale Whitelist Removal\n");

  const [owner] = await hre.ethers.getSigners();
  console.log("Managing whitelist with account:", owner.address);
  console.log("Account balance:", ethers.utils.formatEther(await owner.provider.getBalance(owner.address)), "BNB\n");

  const presale = await hre.ethers.getContractAt("KENOPresale", PRESALE_CONTRACT_ADDRESS);

  const addresses = process.argv.slice(2);

  if (addresses.length === 0) {
    console.log("❌ No addresses provided!");
    console.log("\nUsage:");
    console.log("  npx hardhat run scripts/remove-whitelist.js --network bsc ADDRESS1 ADDRESS2 ADDRESS3...");
    console.log("\nExample:");
    console.log("  npx hardhat run scripts/remove-whitelist.js --network bsc 0x1234... 0x5678...");
    process.exit(1);
  }

  console.log(`📝 Removing ${addresses.length} address(es) from whitelist...\n`);

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    
    if (!ethers.utils.isAddress(address)) {
      console.log(`❌ Invalid address: ${address} - Skipping`);
      continue;
    }

    const isWhitelisted = await presale.isWhitelisted(address);
    
    if (!isWhitelisted) {
      console.log(`⚠️  ${address} - Not whitelisted (already removed)`);
      continue;
    }

    try {
      console.log(`➖ Removing ${address}...`);
      const tx = await presale.updateWhitelist(address, false);
      await tx.wait();
      console.log(`✅ ${address} - Removed from whitelist! (tx: ${tx.hash})\n`);
    } catch (error) {
      console.log(`❌ Failed to remove ${address}:`, error.message, "\n");
    }
  }

  console.log("✨ Whitelist removal complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

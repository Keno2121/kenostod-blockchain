const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const PRESALE_CONTRACT_ADDRESS = "0xE26D6fcf7f3d560a8acEB43fa904Bef31b1fB6D0";
const BATCH_SIZE = 50;

async function main() {
  console.log("🔐 KENO Presale Batch Whitelist Manager\n");

  const csvFile = process.argv[2] || "whitelist.csv";
  
  if (!fs.existsSync(csvFile)) {
    console.log(`❌ File not found: ${csvFile}`);
    console.log("\nCreate a whitelist.csv file with one address per line:");
    console.log("0x1234567890123456789012345678901234567890");
    console.log("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
    console.log("0x9876543210987654321098765432109876543210");
    console.log("\nThen run:");
    console.log("  node scripts/whitelist-from-csv.js whitelist.csv");
    process.exit(1);
  }

  const [owner] = await hre.ethers.getSigners();
  console.log("Managing whitelist with account:", owner.address);
  console.log("Account balance:", ethers.utils.formatEther(await owner.provider.getBalance(owner.address)), "BNB\n");

  const presale = await hre.ethers.getContractAt("KENOPresale", PRESALE_CONTRACT_ADDRESS);

  const fileContent = fs.readFileSync(csvFile, "utf-8");
  const lines = fileContent.split("\n").map(line => line.trim()).filter(line => line.length > 0);
  
  const validAddresses = [];
  
  for (const line of lines) {
    if (line.startsWith("0x") && ethers.utils.isAddress(line)) {
      validAddresses.push(line);
    } else {
      console.log(`⚠️  Skipping invalid address: ${line}`);
    }
  }

  if (validAddresses.length === 0) {
    console.log("❌ No valid addresses found in CSV file!");
    process.exit(1);
  }

  console.log(`📝 Found ${validAddresses.length} valid address(es)\n`);

  for (let i = 0; i < validAddresses.length; i += BATCH_SIZE) {
    const batch = validAddresses.slice(i, Math.min(i + BATCH_SIZE, validAddresses.length));
    
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} addresses)...`);
    
    try {
      const tx = await presale.updateWhitelistBatch(batch, true);
      console.log(`⏳ Transaction submitted: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Batch whitelisted! Gas used: ${receipt.gasUsed.toString()}`);
      
      batch.forEach(addr => console.log(`  ✓ ${addr}`));
      
    } catch (error) {
      console.log(`❌ Batch failed:`, error.message);
      console.log("Trying individual adds for this batch...\n");
      
      for (const address of batch) {
        try {
          const isAlreadyWhitelisted = await presale.isWhitelisted(address);
          if (isAlreadyWhitelisted) {
            console.log(`⚠️  ${address} - Already whitelisted`);
            continue;
          }
          
          const tx = await presale.updateWhitelist(address, true);
          await tx.wait();
          console.log(`✅ ${address} - Whitelisted!`);
        } catch (err) {
          console.log(`❌ ${address} - Failed:`, err.message);
        }
      }
    }
  }

  console.log("\n✨ Whitelist batch processing complete!");
  console.log("\nTo verify, run:");
  console.log("  npx hardhat run scripts/check-whitelist.js --network bsc");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

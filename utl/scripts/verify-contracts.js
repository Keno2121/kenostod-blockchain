const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const deploymentsDir = path.join(__dirname, "../deployments");
  const files = fs.readdirSync(deploymentsDir).filter(f => f.endsWith(".json"));
  
  if (files.length === 0) {
    console.log("No deployment files found. Deploy first.");
    process.exit(1);
  }

  const latest = files.sort().pop();
  const deployment = JSON.parse(fs.readFileSync(path.join(deploymentsDir, latest), "utf8"));
  
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log("=".repeat(60));
  console.log(`Verifying contracts on ${deployment.network} (Chain ID: ${chainId})`);
  console.log("=".repeat(60));

  const contracts = [
    {
      name: "UTLStaking",
      address: deployment.contracts.UTLStaking,
      args: [deployment.tokens.USDC]
    },
    {
      name: "UTLDistribution",
      address: deployment.contracts.UTLDistribution,
      args: [deployment.contracts.UTLStaking]
    },
    {
      name: "UTLTreasury",
      address: deployment.contracts.UTLTreasury,
      args: [
        deployment.treasuryRecipients.kenostodOperations,
        deployment.treasuryRecipients.scholarshipFund,
        deployment.treasuryRecipients.tdirFoundation,
        deployment.treasuryRecipients.insuranceReserve
      ]
    },
    {
      name: "UTLFeeCollector",
      address: deployment.contracts.UTLFeeCollector,
      args: [deployment.contracts.UTLTreasury, deployment.contracts.UTLDistribution]
    }
  ];

  for (const contract of contracts) {
    console.log(`\nVerifying ${contract.name} at ${contract.address}...`);
    try {
      await hre.run("verify:verify", {
        address: contract.address,
        constructorArguments: contract.args
      });
      console.log(`  ${contract.name} verified!`);
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log(`  ${contract.name} already verified.`);
      } else {
        console.log(`  Verification failed: ${error.message}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Verification complete!");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exit(1);
  });

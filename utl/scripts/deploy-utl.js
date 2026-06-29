const hre = require("hardhat");
const fs = require("fs");

const USDC_ADDRESSES = {
  56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  97: "0x64544969ed7EBf5f083679233325356EBe738930",
  137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  80002: "0x41E94Eb71898E8B51d8b2609b16E22B0b8E86DF2"
};

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("=".repeat(60));
  console.log("UTL DEPLOYMENT - Kenostod Blockchain Academy");
  console.log("=".repeat(60));
  console.log(`Network:     ${network.name} (Chain ID: ${chainId})`);
  console.log(`Deployer:    ${deployer.address}`);
  console.log(`Balance:     ${hre.ethers.formatEther(balance)} native tokens`);
  console.log("=".repeat(60));

  const usdcAddress = USDC_ADDRESSES[chainId];
  if (!usdcAddress) {
    throw new Error(`No USDC address configured for chain ID ${chainId}`);
  }
  console.log(`USDC Token:  ${usdcAddress}`);

  const kenostodOps = process.env.KENOSTOD_OPS_WALLET || deployer.address;
  const scholarshipFund = process.env.SCHOLARSHIP_WALLET || deployer.address;
  const tdirFoundation = process.env.TDIR_WALLET || deployer.address;
  const insuranceReserve = process.env.INSURANCE_WALLET || deployer.address;

  console.log("\nTreasury Recipients:");
  console.log(`  Operations (37.5%):   ${kenostodOps}`);
  console.log(`  Scholarship (25%):    ${scholarshipFund}`);
  console.log(`  T.D.I.R. (25%):       ${tdirFoundation}`);
  console.log(`  Insurance (12.5%):    ${insuranceReserve}`);

  console.log("\n[1/4] Deploying UTLStaking...");
  const UTLStaking = await hre.ethers.getContractFactory("UTLStaking");
  const staking = await UTLStaking.deploy(usdcAddress);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log(`  UTLStaking deployed: ${stakingAddress}`);

  console.log("\n[2/4] Deploying UTLDistribution...");
  const UTLDistribution = await hre.ethers.getContractFactory("UTLDistribution");
  const distribution = await UTLDistribution.deploy(stakingAddress);
  await distribution.waitForDeployment();
  const distributionAddress = await distribution.getAddress();
  console.log(`  UTLDistribution deployed: ${distributionAddress}`);

  console.log("\n[3/4] Deploying UTLTreasury...");
  const UTLTreasury = await hre.ethers.getContractFactory("UTLTreasury");
  const treasury = await UTLTreasury.deploy(
    kenostodOps,
    scholarshipFund,
    tdirFoundation,
    insuranceReserve
  );
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log(`  UTLTreasury deployed: ${treasuryAddress}`);

  console.log("\n[4/4] Deploying UTLFeeCollector...");
  const UTLFeeCollector = await hre.ethers.getContractFactory("UTLFeeCollector");
  const feeCollector = await UTLFeeCollector.deploy(treasuryAddress, distributionAddress);
  await feeCollector.waitForDeployment();
  const feeCollectorAddress = await feeCollector.getAddress();
  console.log(`  UTLFeeCollector deployed: ${feeCollectorAddress}`);

  console.log("\n--- Post-Deployment Configuration ---");

  console.log("Adding USDC as supported token on FeeCollector...");
  const addTokenTx = await feeCollector.addSupportedToken(usdcAddress);
  await addTokenTx.wait();
  console.log("  USDC added as supported token");

  console.log("Authorizing FeeCollector on Treasury...");
  const authTx = await treasury.authorizeCollector(feeCollectorAddress);
  await authTx.wait();
  console.log("  FeeCollector authorized on Treasury");

  const networkName = {
    56: "bsc",
    97: "bsc-testnet",
    137: "polygon",
    80002: "polygon-amoy"
  }[chainId] || "unknown";

  const deployment = {
    network: networkName,
    chainId: chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      UTLFeeCollector: feeCollectorAddress,
      UTLStaking: stakingAddress,
      UTLTreasury: treasuryAddress,
      UTLDistribution: distributionAddress
    },
    tokens: {
      USDC: usdcAddress
    },
    treasuryRecipients: {
      kenostodOperations: kenostodOps,
      scholarshipFund: scholarshipFund,
      tdirFoundation: tdirFoundation,
      insuranceReserve: insuranceReserve
    }
  };

  fs.mkdirSync("./deployments", { recursive: true });
  const deploymentFile = `./deployments/deployment-${networkName}-${Date.now()}.json`;
  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log(`\nContract Addresses:`);
  console.log(`  FeeCollector:  ${feeCollectorAddress}`);
  console.log(`  Staking:       ${stakingAddress}`);
  console.log(`  Treasury:      ${treasuryAddress}`);
  console.log(`  Distribution:  ${distributionAddress}`);
  console.log(`\nDeployment saved to: ${deploymentFile}`);
  console.log("\n--- NEXT STEPS ---");
  console.log("1. Verify contracts on block explorer (run verify script)");
  console.log("2. Update frontend with contract addresses");
  console.log("3. Test fee collection with a small USDC transaction");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });

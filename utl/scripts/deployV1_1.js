/**
 * Deploy UTL Protocol v1.1 Upgraded Contracts
 * 
 * These are security-patched replacements for the v1.0 contracts already on BSC mainnet.
 * Deploy fresh instances — existing contracts cannot be upgraded (not proxy pattern).
 * After deployment, update server.js and frontend references to the new addresses.
 * 
 * Existing v1.0 addresses (for reference):
 *   FeeCollector:  0xfE537c43d202C455Cedc141B882c808287BB662f
 *   Staking:       0x49961979c93f43f823BB3593b207724194019d1d
 *   Treasury:      0x3B3538b955647d811D42400084e9409e6593bE97
 *   Distribution:  0xE6918cdBB9D8cd0d3532A88D974734B2F1A793c7
 * 
 * Deploy:
 *   npx hardhat run scripts/deployV1_1.js --network bscSafe
 * 
 * Verify all:
 *   npx hardhat verify --network bsc <ADDRESS> <CONSTRUCTOR_ARGS>
 */

const { ethers } = require("hardhat");
const fs = require("fs");

// ── Recipient Addresses ────────────────────────────────────────────────────────
// Safe wallet is both owner and temp recipient until dedicated wallets are set up

const SAFE_WALLET    = "0x4AA73FadfFd71E6549867a37455EA957A52Cf849";
const KENO_TOKEN     = "0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E";
const KENO_WBNB_LP   = "0x72368adf1487eeebCb095F16CF8cbf91f2B44880";

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=== UTL Protocol v1.1 Deployment ===");
  console.log("Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance: ", ethers.formatEther(balance), "BNB\n");

  if (balance < ethers.parseEther("0.002")) {
    throw new Error("Need at least 0.002 BNB. Current: " + ethers.formatEther(balance));
  }

  // Load any prior partial deployment so we can resume where we left off
  const PROGRESS_FILE = "./deployments/utl-v1.1-progress.json";
  let deployments = {};
  try {
    deployments = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
    console.log("📂 Resuming from previous run:", deployments);
  } catch { /* fresh start */ }

  function save() {
    fs.mkdirSync("./deployments", { recursive: true });
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(deployments, null, 2));
  }

  async function checkGas(label) {
    const bal = await ethers.provider.getBalance(deployer.address);
    console.log(`   💰 Balance after ${label}: ${ethers.formatEther(bal)} BNB`);
    if (bal < ethers.parseEther("0.001")) {
      console.log("⚠️  Low on gas — saving progress and stopping.");
      save();
      process.exit(0);
    }
  }

  // ── 1. UTLTreasury v1.1 ────────────────────────────────────────────────────
  if (!deployments.treasury) {
    console.log("1/5 Deploying UTLTreasury v1.1...");
    const treasuryFactory = await ethers.getContractFactory("contracts/v1.1/UTLTreasury.sol:UTLTreasury");
    const treasury = await treasuryFactory.deploy(
      SAFE_WALLET, SAFE_WALLET, SAFE_WALLET, SAFE_WALLET
    );
    await treasury.waitForDeployment();
    deployments.treasury = await treasury.getAddress();
    save();
    console.log("   ✅ UTLTreasury v1.1:", deployments.treasury);
    await checkGas("Treasury");
  } else {
    console.log("1/5 UTLTreasury already deployed:", deployments.treasury);
  }

  // ── 2. UTLStaking v1.1 ────────────────────────────────────────────────────
  if (!deployments.staking) {
    console.log("2/5 Deploying UTLStaking v1.1...");
    const stakingFactory = await ethers.getContractFactory("contracts/v1.1/UTLStaking.sol:UTLStaking");
    const staking = await stakingFactory.deploy(KENO_TOKEN);
    await staking.waitForDeployment();
    deployments.staking = await staking.getAddress();
    save();
    console.log("   ✅ UTLStaking v1.1:", deployments.staking);
    await checkGas("Staking");
  } else {
    console.log("2/5 UTLStaking already deployed:", deployments.staking);
  }

  // ── 3. UTLDistribution v1.1 ───────────────────────────────────────────────
  if (!deployments.distribution) {
    console.log("3/5 Deploying UTLDistribution v1.1...");
    const distFactory = await ethers.getContractFactory("contracts/v1.1/UTLDistribution.sol:UTLDistribution");
    const distribution = await distFactory.deploy(deployments.staking);
    await distribution.waitForDeployment();
    deployments.distribution = await distribution.getAddress();
    save();
    console.log("   ✅ UTLDistribution v1.1:", deployments.distribution);
    await checkGas("Distribution");
  } else {
    console.log("3/5 UTLDistribution already deployed:", deployments.distribution);
  }

  // ── 4. UTLFeeCollector v1.1 ───────────────────────────────────────────────
  if (!deployments.feeCollector) {
    console.log("4/5 Deploying UTLFeeCollector v1.1...");
    const feeCollectorFactory = await ethers.getContractFactory("contracts/v1.1/UTLFeeCollector.sol:UTLFeeCollector");
    const feeCollector = await feeCollectorFactory.deploy(
      deployments.treasury, deployments.distribution
    );
    await feeCollector.waitForDeployment();
    deployments.feeCollector = await feeCollector.getAddress();
    save();
    console.log("   ✅ UTLFeeCollector v1.1:", deployments.feeCollector);
    await checkGas("FeeCollector");
  } else {
    console.log("4/5 UTLFeeCollector already deployed:", deployments.feeCollector);
  }

  // ── Post-deployment config (idempotent — skip if already done) ─────────────
  if (!deployments.configured) {
    console.log("\nConfiguring contracts...");
    const USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
    const feeCollector = await ethers.getContractAt("contracts/v1.1/UTLFeeCollector.sol:UTLFeeCollector", deployments.feeCollector);
    const treasury     = await ethers.getContractAt("contracts/v1.1/UTLTreasury.sol:UTLTreasury",     deployments.treasury);

    await (await feeCollector.addSupportedToken(USDC_BSC)).wait();
    console.log("   ✅ USDC added to FeeCollector");

    await (await feeCollector.addSupportedToken(KENO_TOKEN)).wait();
    console.log("   ✅ KENO added to FeeCollector");

    await (await treasury.authorizeCollector(deployments.feeCollector)).wait();
    console.log("   ✅ FeeCollector authorized in Treasury");

    deployments.configured = true;
    save();
    await checkGas("config");
  }

  // ── 5. UTLFarm (deploy last — lowest priority if gas runs low) ─────────────
  const REWARD_RATE = ethers.parseEther("0.1");
  if (!deployments.farm) {
    console.log("5/5 Deploying UTLFarm...");
    const farmFactory  = await ethers.getContractFactory("contracts/UTLFarm.sol:UTLFarm");
    const farm         = await farmFactory.deploy(KENO_TOKEN, KENO_WBNB_LP, REWARD_RATE);
    await farm.waitForDeployment();
    deployments.farm   = await farm.getAddress();
    save();
    console.log("   ✅ UTLFarm:", deployments.farm);
  } else {
    console.log("5/5 UTLFarm already deployed:", deployments.farm);
  }

  // ── Save deployment record ─────────────────────────────────────────────────
  const record = {
    network: "bsc",
    chainId: 56,
    version: "1.1",
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      UTLTreasury:      { address: deployments.treasury,     constructorArgs: [SAFE_WALLET, SAFE_WALLET, SAFE_WALLET, SAFE_WALLET] },
      UTLStaking:       { address: deployments.staking,      constructorArgs: [KENO_TOKEN] },
      UTLDistribution:  { address: deployments.distribution, constructorArgs: [deployments.staking] },
      UTLFeeCollector:  { address: deployments.feeCollector, constructorArgs: [deployments.treasury, deployments.distribution] },
      UTLFarm:          { address: deployments.farm,         constructorArgs: [KENO_TOKEN, KENO_WBNB_LP, REWARD_RATE.toString()] },
    },
    previousV1_0: {
      UTLFeeCollector: "0xfE537c43d202C455Cedc141B882c808287BB662f",
      UTLStaking:      "0x49961979c93f43f823BB3593b207724194019d1d",
      UTLTreasury:     "0x3B3538b955647d811D42400084e9409e6593bE97",
      UTLDistribution: "0xE6918cdBB9D8cd0d3532A88D974734B2F1A793c7",
    }
  };

  const outPath = "./deployments/utl-v1.1-bsc.json";
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2));

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n=== ✅ UTL Protocol v1.1 Deployed ===");
  console.log("UTLTreasury:    ", deployments.treasury);
  console.log("UTLStaking:     ", deployments.staking);
  console.log("UTLDistribution:", deployments.distribution);
  console.log("UTLFeeCollector:", deployments.feeCollector);
  console.log("UTLFarm:        ", deployments.farm);
  console.log("\n📄 Full record:", outPath);
  console.log("\nNext steps:");
  console.log("1. Update server.js contract addresses to v1.1 addresses");
  console.log("2. Verify contracts on BscScan:");
  console.log("   npx hardhat verify --network bsc", deployments.treasury, SAFE_WALLET, SAFE_WALLET, SAFE_WALLET, SAFE_WALLET);
  console.log("   npx hardhat verify --network bsc", deployments.staking, KENO_TOKEN);
  console.log("   npx hardhat verify --network bsc", deployments.distribution, deployments.staking);
  console.log("   npx hardhat verify --network bsc", deployments.feeCollector, deployments.treasury, deployments.distribution);
  console.log("   npx hardhat verify --network bsc", deployments.farm, KENO_TOKEN, KENO_WBNB_LP, REWARD_RATE.toString());
  console.log("3. Fund UTLFarm with KENO rewards via fundRewards()");
  console.log("4. Deploy UTLHook and register KENO/USDC pool");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Deployment failed:", err.message);
    process.exit(1);
  });

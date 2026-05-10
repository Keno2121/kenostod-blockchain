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

  if (balance < ethers.parseEther("0.02")) {
    throw new Error("Need at least 0.02 BNB for all deployments.");
  }

  const deployments = {};

  // ── 1. UTLTreasury v1.1 ────────────────────────────────────────────────────
  console.log("1/4 Deploying UTLTreasury v1.1...");
  
  // Using safe wallet as all recipient addresses for now
  // Update via updateRecipients() after launch once dedicated wallets exist
  const UTLTreasury = await ethers.getContractFactory(
    "UTLTreasury",
    { signer: deployer }
  );
  
  // Try v1.1 first, fall back to base if not found  
  let treasuryFactory;
  try {
    treasuryFactory = await ethers.getContractFactory("UTLTreasury", {
      signer: deployer
    });
  } catch {
    treasuryFactory = UTLTreasury;
  }

  const treasury = await treasuryFactory.deploy(
    SAFE_WALLET, // kenostodOperations
    SAFE_WALLET, // scholarshipFund
    SAFE_WALLET, // tdirFoundation
    SAFE_WALLET  // insuranceReserve
  );
  await treasury.waitForDeployment();
  const treasuryAddr = await treasury.getAddress();
  deployments.treasury = treasuryAddr;
  console.log("   ✅ UTLTreasury v1.1:", treasuryAddr);

  // ── 2. UTLStaking v1.1 ────────────────────────────────────────────────────
  console.log("2/4 Deploying UTLStaking v1.1...");
  const stakingFactory = await ethers.getContractFactory("UTLStaking");
  const staking = await stakingFactory.deploy(KENO_TOKEN);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  deployments.staking = stakingAddr;
  console.log("   ✅ UTLStaking v1.1:", stakingAddr);

  // ── 3. UTLDistribution v1.1 ───────────────────────────────────────────────
  console.log("3/4 Deploying UTLDistribution v1.1...");
  const distFactory = await ethers.getContractFactory("UTLDistribution");
  const distribution = await distFactory.deploy(stakingAddr);
  await distribution.waitForDeployment();
  const distAddr = await distribution.getAddress();
  deployments.distribution = distAddr;
  console.log("   ✅ UTLDistribution v1.1:", distAddr);

  // ── 4. UTLFeeCollector v1.1 ───────────────────────────────────────────────
  console.log("4/4 Deploying UTLFeeCollector v1.1...");
  const feeCollectorFactory = await ethers.getContractFactory("UTLFeeCollector");
  const feeCollector = await feeCollectorFactory.deploy(treasuryAddr, distAddr);
  await feeCollector.waitForDeployment();
  const feeCollectorAddr = await feeCollector.getAddress();
  deployments.feeCollector = feeCollectorAddr;
  console.log("   ✅ UTLFeeCollector v1.1:", feeCollectorAddr);

  // ── Post-deployment config ─────────────────────────────────────────────────
  console.log("\nConfiguring contracts...");

  // Add USDC as supported token in FeeCollector
  const USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
  await (await feeCollector.addSupportedToken(USDC_BSC)).wait();
  console.log("   ✅ USDC added to FeeCollector");

  // Add KENO as supported token
  await (await feeCollector.addSupportedToken(KENO_TOKEN)).wait();
  console.log("   ✅ KENO added to FeeCollector");

  // Authorize FeeCollector to call Treasury
  await (await treasury.authorizeCollector(feeCollectorAddr)).wait();
  console.log("   ✅ FeeCollector authorized in Treasury");

  // ── UTLFarm ───────────────────────────────────────────────────────────────
  console.log("5/5 Deploying UTLFarm...");
  const farmFactory = await ethers.getContractFactory("UTLFarm");
  const REWARD_RATE = ethers.parseEther("0.1"); // 0.1 KENO/sec initial rate
  const farm = await farmFactory.deploy(KENO_TOKEN, KENO_WBNB_LP, REWARD_RATE);
  await farm.waitForDeployment();
  const farmAddr = await farm.getAddress();
  deployments.farm = farmAddr;
  console.log("   ✅ UTLFarm:", farmAddr);

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

/**
 * UTL v1.1 — BOT Chain Mainnet Deploy
 * ═════════════════════════════════════
 * Deploys FeeCollector, Staking, and Distribution to BOT Chain (Chain ID: 677)
 *
 * Usage:
 *   cd utl
 *   npx hardhat run scripts/deploy-botchain-utl.js --network botchain
 */

const { ethers, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

const BOT_WALLET  = "0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2";
const KENO_BOTCHAIN = "0x137a5Fc22a76Ec42490F2421a81935d124baE714"; // KENO deployed on BOT Chain

// Manual poll — waitForDeployment() can hang on some EVM chains
async function waitForCode(contract, maxWait = 120000) {
  const address = await contract.getAddress();
  const deadline = Date.now() + maxWait;
  while (Date.now() < deadline) {
    const code = await ethers.provider.getCode(address);
    if (code && code !== "0x") return address;
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error(`Deployment timed out — check scan.botchain.ai for ${address}`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("\n══════════════════════════════════════════════════");
  console.log("  UTL v1.1 — BOT Chain Deploy");
  console.log(`  Network:  ${network.name} (Chain ID: ${chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log("══════════════════════════════════════════════════\n");

  if (chainId !== 677n) throw new Error(`Expected Chain ID 677, got ${chainId}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Deployer balance: ${ethers.formatEther(balance)} BOT`);
  if (balance === 0n) throw new Error("No BOT gas — fund the wallet first.");
  if (balance < ethers.parseEther("0.05")) console.warn("  ⚠️  Low gas — deployment may fail");

  // ── 1. UTLFeeCollector ────────────────────────────────────────────────────
  // Treasury + distribution both start as bot wallet; distribution updated after step 3
  console.log("\n  [1/3] Deploying UTLFeeCollector...");
  const FCFactory = await ethers.getContractFactory("contracts/v1.1/UTLFeeCollector.sol:UTLFeeCollector");
  const fc = await FCFactory.deploy(BOT_WALLET, BOT_WALLET, { gasLimit: 2_000_000 });
  const fcAddr = await waitForCode(fc);
  console.log(`\n  ✅ UTLFeeCollector: ${fcAddr}`);

  // ── 2. UTLStaking ─────────────────────────────────────────────────────────
  console.log("\n  [2/3] Deploying UTLStaking...");
  const StakingFactory = await ethers.getContractFactory("contracts/v1.1/UTLStaking.sol:UTLStaking");
  const staking = await StakingFactory.deploy(KENO_BOTCHAIN, { gasLimit: 2_500_000 });
  const stakingAddr = await waitForCode(staking);
  console.log(`\n  ✅ UTLStaking: ${stakingAddr}`);

  // ── 3. UTLDistribution ────────────────────────────────────────────────────
  console.log("\n  [3/3] Deploying UTLDistribution...");
  const DistFactory = await ethers.getContractFactory("contracts/v1.1/UTLDistribution.sol:UTLDistribution");
  const dist = await DistFactory.deploy(stakingAddr, { gasLimit: 1_500_000 });
  const distAddr = await waitForCode(dist);
  console.log(`\n  ✅ UTLDistribution: ${distAddr}`);

  // ── 4. Wire distribution into FeeCollector ────────────────────────────────
  console.log("\n  Wiring distribution contract into FeeCollector...");
  const setDistTx = await fc.setDistributionContract(distAddr, { gasLimit: 100_000 });
  await setDistTx.wait();
  console.log("  ✅ FeeCollector.distributionContract → UTLDistribution");

  // ── 5. Set distribution on staking ────────────────────────────────────────
  const setStakingDistTx = await staking.setDistributionContract(distAddr, { gasLimit: 100_000 });
  await setStakingDistTx.wait();
  console.log("  ✅ Staking.distributionContract → UTLDistribution");

  // ── 6. Summary ────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════");
  console.log("  UTL v1.1 BOT Chain Deployment Complete");
  console.log(`  FeeCollector:  ${fcAddr}`);
  console.log(`  Staking:       ${stakingAddr}`);
  console.log(`  Distribution:  ${distAddr}`);
  console.log(`  KENO token:    ${KENO_BOTCHAIN}`);
  console.log(`  Explorer:      https://scan.botchain.ai`);
  console.log("══════════════════════════════════════════════════\n");

  // ── 7. Save record ────────────────────────────────────────────────────────
  const record = {
    network:    "botchain",
    chainId:    677,
    version:    "1.1",
    deployer:   deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      UTLFeeCollector:  { address: fcAddr },
      UTLStaking:       { address: stakingAddr, kenoToken: KENO_BOTCHAIN },
      UTLDistribution:  { address: distAddr }
    }
  };

  const dir = path.join(__dirname, "../deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "botchain-utl.json");
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  console.log("  📄 Saved: utl/deployments/botchain-utl.json");

  return record;
}

main().catch(err => { console.error(err); process.exit(1); });

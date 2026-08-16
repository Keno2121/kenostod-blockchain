/**
 * Deploy UTLDistribution to BOT Chain — standalone retry
 */
const { ethers } = require("hardhat");
const fs   = require("fs");
const path = require("path");

const STAKING_ADDR = "0xd6a73bc00f623f893831B623efdA9901CAF58e63";
const FC_ADDR      = "0xBb44a52b2B69D820cA1792Ca9a496e9F00B2F9E7";

async function waitForCode(contract, maxWait = 240000) {
  const address = await contract.getAddress();
  const deadline = Date.now() + maxWait;
  while (Date.now() < deadline) {
    const code = await ethers.provider.getCode(address);
    if (code && code !== "0x") return address;
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, 6000));
  }
  throw new Error(`Timed out — check scan.botchain.ai for ${address}`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} BOT`);

  console.log("\nDeploying UTLDistribution...");
  const Factory = await ethers.getContractFactory("contracts/v1.1/UTLDistribution.sol:UTLDistribution");
  const dist = await Factory.deploy(STAKING_ADDR, { gasLimit: 2_000_000 });
  const txHash = dist.deploymentTransaction()?.hash;
  console.log(`TX: ${txHash}`);
  const distAddr = await waitForCode(dist);
  console.log(`\n✅ UTLDistribution: ${distAddr}`);

  // Wire into FeeCollector
  console.log("Wiring into FeeCollector...");
  const fcAbi = ['function setDistributionContract(address) external'];
  const fc = new ethers.Contract(FC_ADDR, fcAbi, deployer);
  const tx1 = await fc.setDistributionContract(distAddr, { gasLimit: 100_000 });
  await tx1.wait();
  console.log("✅ FeeCollector.distributionContract set");

  // Wire into Staking
  console.log("Wiring into Staking...");
  const stakingAbi = ['function setDistributionContract(address) external'];
  const staking = new ethers.Contract(STAKING_ADDR, stakingAbi, deployer);
  const tx2 = await staking.setDistributionContract(distAddr, { gasLimit: 100_000 });
  await tx2.wait();
  console.log("✅ Staking.distributionContract set");

  // Save record
  const record = {
    network: "botchain", chainId: 677, version: "1.1",
    deployer: deployer.address, deployedAt: new Date().toISOString(),
    contracts: {
      UTLFeeCollector:  { address: FC_ADDR },
      UTLStaking:       { address: STAKING_ADDR, kenoToken: "0x137a5Fc22a76Ec42490F2421a81935d124baE714" },
      UTLDistribution:  { address: distAddr }
    }
  };
  const dir = path.join(__dirname, "../deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "botchain-utl.json"), JSON.stringify(record, null, 2));
  console.log("\n📄 Saved: utl/deployments/botchain-utl.json");
  console.log(`\nFeeCollector: ${FC_ADDR}`);
  console.log(`Staking:      ${STAKING_ADDR}`);
  console.log(`Distribution: ${distAddr}`);
}

main().catch(err => { console.error(err); process.exit(1); });

/**
 * KENOBondingCurve — Deploy Script
 * BSC Mainnet & Testnet
 *
 * Usage:
 *   npm run deploy:testnet    (BSC Testnet — test first!)
 *   npm run deploy:mainnet    (BSC Mainnet — when ready)
 *
 * After deploy, owner must:
 *   1. Approve this contract to spend KENO tokens
 *   2. Call addAllocation(amount) to seed the curve
 */

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// ── Addresses ──────────────────────────────────────────────────────────────
const CONFIG = {
  bsc: {
    kenoToken:         "0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E",
    utlFeeAccumulator: "0xb9489B33Bd9bB835139369b1dD282fB44B2273d8", // UTL FeeCollector v1.1
    treasury:          "0x54A01A5bf5096c351F166C15143eA9a9Af393C84", // UTL Treasury v1.1
    owner:             "0x4AA73FadfFd71E6549867a37455EA957A52Cf849", // Safe wallet
  },
  bscTestnet: {
    // Deploy a mock ERC20 for testnet or use a test KENO token
    kenoToken:         process.env.TESTNET_KENO_TOKEN || "0x0000000000000000000000000000000000000001",
    utlFeeAccumulator: process.env.TESTNET_FEE_ACCUMULATOR || "0x4AA73FadfFd71E6549867a37455EA957A52Cf849",
    treasury:          process.env.TESTNET_TREASURY || "0x4AA73FadfFd71E6549867a37455EA957A52Cf849",
    owner:             "0x4AA73FadfFd71E6549867a37455EA957A52Cf849",
  }
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = network.name;
  const cfg = CONFIG[net];

  if (!cfg) throw new Error(`No config for network: ${net}`);
  if (cfg.kenoToken === "0x0000000000000000000000000000000000000001") {
    throw new Error("Set TESTNET_KENO_TOKEN in your .env before deploying to testnet");
  }

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  KENO Bonding Curve — Deploy`);
  console.log(`  Network:   ${net}`);
  console.log(`  Deployer:  ${deployer.address}`);
  console.log(`═══════════════════════════════════════════════\n`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Deployer balance: ${ethers.formatEther(balance)} BNB`);

  const Factory = await ethers.getContractFactory("KENOBondingCurve");
  const contract = await Factory.deploy(
    cfg.kenoToken,
    cfg.utlFeeAccumulator,
    cfg.treasury,
    cfg.owner,
    { gasLimit: 3_000_000 }
  );

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\n  ✅ KENOBondingCurve deployed: ${address}`);
  console.log(`\n  Contract config:`);
  console.log(`    KENO Token:          ${cfg.kenoToken}`);
  console.log(`    UTL Fee Accumulator: ${cfg.utlFeeAccumulator}`);
  console.log(`    Treasury:            ${cfg.treasury}`);
  console.log(`    Owner:               ${cfg.owner}`);
  console.log(`    BASE_PRICE:          0.000001 BNB/KENO`);
  console.log(`    SLOPE:               20,000 wei/KENO² (doubles at 50M sold)`);
  console.log(`    Buy fee:             3%`);
  console.log(`    Sell fee:            5%`);
  console.log(`    UTL fee share:       50% of each fee`);

  // Save deployment record
  const record = {
    network: net,
    address,
    deployer: deployer.address,
    kenoToken:         cfg.kenoToken,
    utlFeeAccumulator: cfg.utlFeeAccumulator,
    treasury:          cfg.treasury,
    owner:             cfg.owner,
    deployedAt: new Date().toISOString(),
    txHash: contract.deploymentTransaction()?.hash || ""
  };

  const dir = path.join(__dirname, "../deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${net}.json`);
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  console.log(`\n  📄 Deployment record saved: deployments/${net}.json`);

  console.log(`\n  ── Next Steps ────────────────────────────────`);
  console.log(`  1. Verify contract:`);
  console.log(`     npx hardhat verify --network ${net} ${address} \\`);
  console.log(`       ${cfg.kenoToken} ${cfg.utlFeeAccumulator} ${cfg.treasury} ${cfg.owner}`);
  console.log(`  2. Approve contract to spend KENO (from safe wallet):`);
  console.log(`     kenoToken.approve("${address}", allocationAmount)`);
  console.log(`  3. Add KENO allocation (owner only):`);
  console.log(`     bondingCurve.addAllocation(allocationAmount)`);
  console.log(`     Suggested start: 50,000,000 KENO (50M)`);
  console.log(`  ──────────────────────────────────────────────\n`);
}

main().catch(err => { console.error(err); process.exit(1); });

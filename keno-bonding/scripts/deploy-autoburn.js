/**
 * KENOAutoBurn — Deploy Script (BSC)
 * Usage:
 *   npm run deploy:autoburn:testnet
 *   npm run deploy:autoburn:mainnet
 */

const { ethers, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

const CONFIG = {
  bsc: {
    kenoToken: "0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E",
    owner:     "0x4AA73FadfFd71E6549867a37455EA957A52Cf849",
  },
  bscTestnet: {
    kenoToken: process.env.TESTNET_KENO_TOKEN || "0x0000000000000000000000000000000000000001",
    owner:     "0x4AA73FadfFd71E6549867a37455EA957A52Cf849",
  }
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = network.name;
  const cfg = CONFIG[net];
  if (!cfg) throw new Error(`No config for: ${net}`);

  console.log(`\n══════════════════════════════════════════`);
  console.log(`  KENOAutoBurn — Deploy`);
  console.log(`  Network:  ${net}`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`══════════════════════════════════════════\n`);

  const Factory  = await ethers.getContractFactory("KENOAutoBurn");
  const contract = await Factory.deploy(cfg.kenoToken, cfg.owner, { gasLimit: 2_000_000 });
  await contract.waitForDeployment();
  const address  = await contract.getAddress();

  console.log(`  ✅ KENOAutoBurn deployed: ${address}`);
  console.log(`  KENO Token: ${cfg.kenoToken}`);
  console.log(`  Owner:      ${cfg.owner}`);

  const record = {
    network: net, address,
    deployer: deployer.address,
    kenoToken: cfg.kenoToken,
    owner: cfg.owner,
    deployedAt: new Date().toISOString(),
    txHash: contract.deploymentTransaction()?.hash || ""
  };

  const dir  = path.join(__dirname, "../deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${net}-autoburn.json`);
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  console.log(`  📄 Saved: deployments/${net}-autoburn.json`);

  console.log(`\n  ── Next Steps ──────────────────────────`);
  console.log(`  1. Add relay wallet as relayer:`);
  console.log(`     contract.addRelayer("0x391C30391C80Bdd100b78b740f89486569cC52f2")`);
  console.log(`  2. Wire Aegis relay to send BNB to: ${address}`);
  console.log(`  3. Relayer calls executeBurn(minKenoOut) to trigger swap + burn`);
  console.log(`  ────────────────────────────────────────\n`);
}

main().catch(err => { console.error(err); process.exit(1); });

/**
 * KENO Token — BOT Chain Mainnet Deploy
 * ══════════════════════════════════════
 * Deploys KenostodToken.sol natively on BOT Chain (Chain ID: 677)
 *
 * Usage:
 *   cd keno-bonding
 *   npx hardhat run scripts/deploy-botchain.js --network botchain
 *
 * Prerequisites:
 *   - BOT gas in bot wallet (0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2)
 *   - BOT_WALLET_PRIVATE_KEY set in .env
 */

const { ethers, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

// ── Bot wallet = deployer & initial owner ────────────────────────────────
const BOT_WALLET = "0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n══════════════════════════════════════════════════");
  console.log("  KENO Token — BOT Chain Deploy");
  console.log(`  Network:  ${network.name} (Chain ID: 677)`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log("══════════════════════════════════════════════════\n");

  // Sanity check — make sure we're on BOT Chain
  const chainId = (await ethers.provider.getNetwork()).chainId;
  if (chainId !== 677n) {
    throw new Error(`Wrong network! Expected Chain ID 677 (BOT Chain), got ${chainId}`);
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  const balBOT  = ethers.formatEther(balance);
  console.log(`  Deployer balance: ${balBOT} BOT`);

  if (balance === 0n) {
    throw new Error("No BOT gas in deployer wallet. Wait for L-BOTChain to send gas first.");
  }
  if (balance < ethers.parseEther("0.01")) {
    console.warn(`  ⚠️  Low gas: ${balBOT} BOT — deployment may fail if gas is insufficient`);
  }

  // ── Deploy ──────────────────────────────────────────────────────────────
  console.log("  Compiling KenostodToken...");
  const Factory = await ethers.getContractFactory("KenostodToken");

  console.log("  Deploying...");
  const token = await Factory.deploy(
    BOT_WALLET,   // _owner
    BOT_WALLET,   // _teamWallet  — receives minted supply
    BOT_WALLET,   // _treasuryWallet
    BOT_WALLET,   // _liquidityWallet
    { gasLimit: 3_000_000 }
  );

  // Manual poll — waitForDeployment() can hang on some chains
  console.log(`  TX hash: ${token.deploymentTransaction()?.hash}`);
  console.log("  Waiting for confirmation...");

  let address;
  for (let i = 0; i < 60; i++) {
    try {
      address = await token.getAddress();
      const code = await ethers.provider.getCode(address);
      if (code && code !== "0x") break;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 5000));
    process.stdout.write(".");
  }
  console.log("\n");

  if (!address) throw new Error("Deployment timed out — check scan.botchain.ai manually");

  // ── Verify supply ───────────────────────────────────────────────────────
  const supply = await token.totalSupply();
  const name   = await token.name();
  const symbol = await token.symbol();

  console.log(`  ✅ ${name} (${symbol}) deployed on BOT Chain`);
  console.log(`     Address:      ${address}`);
  console.log(`     Total Supply: ${ethers.formatEther(supply)} KENO`);
  console.log(`     Owner:        ${BOT_WALLET}`);
  console.log(`     Explorer:     https://scan.botchain.ai/address/${address}`);

  // ── Save deployment record ──────────────────────────────────────────────
  const record = {
    network:     "botchain",
    chainId:     677,
    address,
    deployer:    deployer.address,
    owner:       BOT_WALLET,
    name,
    symbol,
    totalSupply: ethers.formatEther(supply),
    txHash:      token.deploymentTransaction()?.hash || "",
    deployedAt:  new Date().toISOString()
  };

  const dir  = path.join(__dirname, "../deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "botchain-keno.json");
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  console.log(`\n  📄 Saved: deployments/botchain-keno.json`);

  // ── Next steps ──────────────────────────────────────────────────────────
  console.log("\n  ── Next Steps ─────────────────────────────────────");
  console.log(`  1. Verify on explorer:`);
  console.log(`     npx hardhat verify --network botchain ${address} "${BOT_WALLET}"`);
  console.log(`  2. Add KENO liquidity pair on BOT Chain DEX`);
  console.log(`     (coordinate with Roy4by4 for DEX details)`);
  console.log(`  3. Share contract address with BOT Chain team for incentive program`);
  console.log("  ───────────────────────────────────────────────────\n");
}

main().catch(err => { console.error(err); process.exit(1); });

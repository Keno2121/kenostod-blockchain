/**
 * KENO Token — BOT Chain Testnet Deploy
 * ══════════════════════════════════════
 * Deploys KenostodToken.sol on BOT Chain Testnet (Chain ID: 968)
 * Explorer: https://scan.bohr.life
 * Faucet:   https://faucet.botchain.ai/basic  (10 tBOT / 24h)
 *
 * Usage:
 *   cd keno-bonding
 *   npx hardhat run scripts/deploy-botchain-testnet.js --network botchainTestnet
 */

const { ethers, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

const BOT_WALLET = "0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n══════════════════════════════════════════════════");
  console.log("  KENO Token — BOT Chain Testnet Deploy");
  console.log(`  Network:  ${network.name} (Chain ID: 968)`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log("══════════════════════════════════════════════════\n");

  const chainId = (await ethers.provider.getNetwork()).chainId;
  if (chainId !== 968n) {
    throw new Error(`Wrong network! Expected Chain ID 968 (BOT Chain Testnet), got ${chainId}`);
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  const balBOT  = ethers.formatEther(balance);
  console.log(`  Deployer balance: ${balBOT} tBOT`);

  if (balance === 0n) {
    throw new Error(
      "No tBOT gas in deployer wallet.\n" +
      "  Get test tokens at: https://faucet.botchain.ai/basic\n" +
      "  Wallet: " + deployer.address
    );
  }
  if (balance < ethers.parseEther("0.05")) {
    console.warn(`  ⚠️  Low gas: ${balBOT} tBOT — get more at https://faucet.botchain.ai/basic`);
  }

  // ── Deploy ──────────────────────────────────────────────────────────────
  console.log("  Compiling KenostodToken...");
  const Factory = await ethers.getContractFactory("KenostodToken");

  console.log("  Deploying...");
  const token = await Factory.deploy(
    BOT_WALLET,   // _owner
    BOT_WALLET,   // _teamWallet
    BOT_WALLET,   // _treasuryWallet
    BOT_WALLET,   // _liquidityWallet
    { gasLimit: 3_000_000 }
  );

  const txHash = token.deploymentTransaction()?.hash;
  console.log(`  TX hash: ${txHash}`);
  console.log(`  Explorer: https://scan.bohr.life/tx/${txHash}`);
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

  if (!address) throw new Error("Deployment timed out — check scan.bohr.life manually");

  const supply = await token.totalSupply();
  const name   = await token.name();
  const symbol = await token.symbol();

  console.log(`  ✅ ${name} (${symbol}) deployed on BOT Chain Testnet`);
  console.log(`     Address:      ${address}`);
  console.log(`     Total Supply: ${ethers.formatEther(supply)} KENO`);
  console.log(`     Owner:        ${BOT_WALLET}`);
  console.log(`     Explorer:     https://scan.bohr.life/address/${address}`);

  // ── Save deployment record ──────────────────────────────────────────────
  const record = {
    network:     "botchainTestnet",
    chainId:     968,
    address,
    deployer:    deployer.address,
    owner:       BOT_WALLET,
    name,
    symbol,
    totalSupply: ethers.formatEther(supply),
    txHash:      txHash || "",
    deployedAt:  new Date().toISOString()
  };

  const dir  = path.join(__dirname, "../deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "botchain-testnet-keno.json");
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  console.log(`\n  📄 Saved: deployments/botchain-testnet-keno.json`);

  console.log("\n  ── Next Steps ─────────────────────────────────────");
  console.log(`  1. View on testnet explorer:`);
  console.log(`     https://scan.bohr.life/address/${address}`);
  console.log(`  2. Add KENO/WBOT pair on BDEX testnet DEX`);
  console.log(`  3. Share live testnet link in BOT Chain group as SOE demo`);
  console.log("  ───────────────────────────────────────────────────\n");
}

main().catch(err => { console.error(err); process.exit(1); });

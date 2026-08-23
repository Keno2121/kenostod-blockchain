/**
 * Deploy UTLBDEXWrapper — BOT Chain Mainnet
 * ══════════════════════════════════════════
 * Deploys the UTL BDEX swap wrapper so that every BDEX swap through
 * this contract automatically routes a 0.1% UTL fee to the
 * UTL FeeCollector on BOT Chain.
 *
 * Usage:
 *   cd utl
 *   npx hardhat run scripts/deploy-bdex-wrapper.js --network botchain
 *
 * Prerequisites:
 *   - BOT gas in bot wallet
 *   - BOT_WALLET_PRIVATE_KEY set in ../.env
 */

const { ethers, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

// ── Shared addresses (same on mainnet and testnet — confirmed by nonce check)
const WBOT           = "0xD5452816194a3784dBa983426cCe7c122F4abd30";
const BDEX_ROUTER    = "0x07032d47A1b9f8460cBeE9dC17c1d3E438693929";
const BOT_WALLET     = "0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2";

// FeeCollector: mainnet = live UTL contract, testnet = bot wallet (receives test fees)
const FEE_COLLECTOR_MAINNET = "0xBb44a52b2B69D820cA1792Ca9a496e9F00B2F9E7";
const FEE_COLLECTOR_TESTNET = BOT_WALLET; // for testnet verification only

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  UTL BDEX Wrapper — BOT Chain Deploy");
  console.log(`  Network:       ${network.name} (Chain ID: ${chainId})`);
  console.log(`  Deployer:      ${deployer.address}`);
  console.log(`  WBOT:          ${WBOT}`);
  console.log(`  BDEX Router:   ${BDEX_ROUTER}`);
  console.log("══════════════════════════════════════════════════════════\n");

  const isTestnet = chainId === 968n;
  const isMainnet = chainId === 677n;
  if (!isMainnet && !isTestnet) {
    throw new Error(`Wrong network — expected BOT Chain mainnet (677) or testnet (968), got ${chainId}`);
  }

  const FEE_COLLECTOR = isTestnet ? FEE_COLLECTOR_TESTNET : FEE_COLLECTOR_MAINNET;
  const EXPLORER      = isTestnet ? "https://scan.bohr.life" : "https://scan.botchain.ai";
  const NET_LABEL     = isTestnet ? "Testnet (968)" : "Mainnet (677)";
  console.log(`  Mode:          ${NET_LABEL}`);
  console.log(`  FeeCollector:  ${FEE_COLLECTOR}${isTestnet ? " (bot wallet — testnet placeholder)" : ""}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Deployer balance: ${ethers.formatEther(balance)} BOT`);
  if (balance < ethers.parseEther("0.01")) {
    throw new Error("Insufficient BOT for deployment gas");
  }

  // ── Deploy ────────────────────────────────────────────────────────────
  console.log("  Deploying UTLBDEXWrapper...");
  const Factory = await ethers.getContractFactory("UTLBDEXWrapper");
  const wrapper = await Factory.deploy(WBOT, BDEX_ROUTER, FEE_COLLECTOR, {
    gasLimit: 2_000_000
  });

  const txHash = wrapper.deploymentTransaction()?.hash;
  console.log(`  TX: ${txHash}`);
  console.log("  Waiting for confirmation...");

  // Manual poll — waitForDeployment can hang on some chains
  let address;
  for (let i = 0; i < 60; i++) {
    try {
      address = await wrapper.getAddress();
      const code = await ethers.provider.getCode(address);
      if (code && code !== "0x") break;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 3000));
    process.stdout.write(".");
  }
  console.log("\n");

  if (!address) throw new Error("Deployment timed out");

  // ── Verify config ─────────────────────────────────────────────────────
  const feeBps   = await wrapper.utlFeeBps();
  const fc       = await wrapper.feeCollector();

  console.log(`  ✅ UTLBDEXWrapper deployed on BOT Chain`);
  console.log(`     Address:       ${address}`);
  console.log(`     FeeCollector:  ${fc}`);
  console.log(`     UTL Fee:       ${feeBps} bps (${Number(feeBps)/100}%)`);
  console.log(`     Explorer:      https://scan.botchain.ai/address/${address}`);

  // ── Save deployment record ────────────────────────────────────────────
  const record = {
    network:       "botchain",
    chainId:       677,
    address,
    deployer:      deployer.address,
    wbot:          WBOT,
    bdexRouter:    BDEX_ROUTER,
    feeCollector:  FEE_COLLECTOR,
    utlFeeBps:     feeBps.toString(),
    txHash:        txHash || "",
    deployedAt:    new Date().toISOString()
  };

  const dir  = path.join(__dirname, "../deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "botchain-bdex-wrapper.json");
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  console.log(`\n  📄 Saved: deployments/botchain-bdex-wrapper.json`);

  // ── Next steps ────────────────────────────────────────────────────────
  console.log("\n  ── Next Steps ─────────────────────────────────────────");
  console.log(`  1. Verify on explorer:`);
  console.log(`     npx hardhat verify --network botchain ${address} \\`);
  console.log(`       "${WBOT}" "${BDEX_ROUTER}" "${FEE_COLLECTOR}"`);
  console.log(`  2. Share wrapper address with BOT Chain / BDEX team`);
  console.log(`  3. Test swapExactBOTForTokens on BOT Chain testnet first`);
  console.log(`  4. Add wrapper address to the UTL dashboard`);
  console.log("  ─────────────────────────────────────────────────────\n");
}

main().catch(err => { console.error(err); process.exit(1); });

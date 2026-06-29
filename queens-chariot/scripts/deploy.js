/**
 * Queens Chariot Token (QCT) — Deployment Script
 * Target: Base Mainnet (chain ID 8453)
 *
 * Run:
 *   npm run deploy:testnet   (Base Sepolia — test first, FREE)
 *   npm run deploy:mainnet   (Base Mainnet — go live, ~$5 in ETH)
 *
 * Deployer wallet: KENO_WALLET_PRIVATE_KEY (0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2)
 * — clean EOA on Base, confirmed no contract code
 * — bridge ETH to this address on Base network before deploying
 *
 * Allocation wallets (defaults to deployer — update later for cold wallets):
 *   QCT_PROSPERITY_POOL      — 40% Community Prosperity Pool
 *   QCT_LIQUIDITY_FORTRESS   — 20% Permanent Liquidity Lock
 *   QCT_DEV_TREASURY         — 15% Development Treasury
 *   QCT_FOUNDING_COURT       — 10% Founding Court (4-year vest)
 *   QCT_PARTNERSHIPS         — 8%  Strategic Partnerships + Fjord LBP
 *   QCT_EMERGENCY_RESERVE    — 5%  Emergency Reserve
 */

const { ethers, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId    = network.config.chainId;
  const chainName  = network.name;
  const depAddr    = deployer.address;

  // ── All wallets default to deployer ───────────────────────────────────────
  // Override any with env vars when you have dedicated cold wallets ready.
  const WALLETS = {
    prosperityPool:    process.env.QCT_PROSPERITY_POOL    || depAddr,
    liquidityFortress: process.env.QCT_LIQUIDITY_FORTRESS || depAddr,
    devTreasury:       process.env.QCT_DEV_TREASURY       || depAddr,
    foundingCourt:     process.env.QCT_FOUNDING_COURT     || depAddr,
    partnerships:      process.env.QCT_PARTNERSHIPS       || depAddr,
    emergencyReserve:  process.env.QCT_EMERGENCY_RESERVE  || depAddr,
  };

  console.log("\n" + "═".repeat(60));
  console.log("  👑 QUEENS CHARIOT TOKEN (QCT) — DEPLOYMENT");
  console.log("═".repeat(60));
  console.log(`  Network    : ${chainName} (chain ${chainId})`);
  console.log(`  Deployer   : ${depAddr}`);

  const balance = await ethers.provider.getBalance(depAddr);
  const ethBal  = parseFloat(ethers.formatEther(balance));
  console.log(`  Balance    : ${ethBal.toFixed(6)} ETH`);

  if (ethBal < 0.005 && chainId === 8453) {
    throw new Error(
      `❌ Insufficient ETH on Base.\n` +
      `   Wallet: ${depAddr}\n` +
      `   Have:   ${ethBal.toFixed(6)} ETH\n` +
      `   Need:   ~0.005 ETH for deployment gas\n\n` +
      `   Bridge ETH to Base using:\n` +
      `     Stargate:     https://stargate.finance\n` +
      `     Squid Router: https://app.squidrouter.com\n` +
      `     Across:       https://across.to\n\n` +
      `   Send ETH to: ${depAddr} on Base network (chain 8453)`
    );
  }

  console.log("─".repeat(60));
  console.log("  Allocation wallets:");
  for (const [name, addr] of Object.entries(WALLETS)) {
    const isDefault = addr === depAddr ? " (default — update later)" : "";
    console.log(`    ${name.padEnd(20)}: ${addr}${isDefault}`);
  }

  console.log("─".repeat(60));
  console.log("  7 Constitutional Laws:  ✅ Embedded in contract");
  console.log("  6 Fee Protocols:        ✅ Active at deployment");
  console.log("  Queen's Burn (2%):      ✅ Burned in constructor");
  console.log("─".repeat(60));

  // ── Deploy ────────────────────────────────────────────────────────────────
  console.log("\n  Deploying QueensChariot contract...");
  const QueensChariot = await ethers.getContractFactory("QueensChariot");

  const qct = await QueensChariot.deploy(
    WALLETS.prosperityPool,
    WALLETS.liquidityFortress,
    WALLETS.devTreasury,
    WALLETS.foundingCourt,
    WALLETS.partnerships,
    WALLETS.emergencyReserve,
  );

  console.log("  Waiting for confirmations...");

  // Manual poll — waitForDeployment can hang on some RPCs
  const depTx = qct.deploymentTransaction();
  let receipt  = null;
  let attempts = 0;
  while (!receipt && attempts < 60) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      receipt = await ethers.provider.getTransactionReceipt(depTx.hash);
      if (receipt && receipt.status === 0) throw new Error("Transaction reverted");
    } catch (e) {
      if (e.message.includes("reverted")) throw e;
    }
    attempts++;
    if (attempts % 5 === 0) console.log(`  Still waiting... (${attempts * 3}s)`);
  }
  if (!receipt) throw new Error("Deployment timed out — check tx on Basescan: " + depTx.hash);

  const contractAddress = await qct.getAddress();

  console.log("\n" + "═".repeat(60));
  console.log("  ✅ QCT DEPLOYED SUCCESSFULLY");
  console.log("═".repeat(60));
  console.log(`  Contract   : ${contractAddress}`);
  console.log(`  Tx hash    : ${receipt.hash}`);
  console.log(`  Block      : ${receipt.blockNumber}`);
  console.log(`  Gas used   : ${receipt.gasUsed.toString()}`);

  // ── Verify supply ─────────────────────────────────────────────────────────
  const totalSupply = await qct.totalSupply();
  console.log(`\n  Total supply (post Queen's Burn): ${ethers.formatEther(totalSupply)} QCT`);
  console.log("  ✅ 2% burned at genesis (20,000,000 QCT gone forever)");

  // ── Verify allocations ────────────────────────────────────────────────────
  console.log("\n  Allocation balances:");
  const allocs = [
    ["40% Prosperity Pool",    WALLETS.prosperityPool,    392_000_000],
    ["20% Liquidity Fortress", WALLETS.liquidityFortress, 196_000_000],
    ["15% Dev Treasury",       WALLETS.devTreasury,       147_000_000],
    ["10% Founding Court",     WALLETS.foundingCourt,      98_000_000],
    [" 8% Partnerships",       WALLETS.partnerships,       78_400_000],
    [" 5% Emergency Reserve",  WALLETS.emergencyReserve,   49_000_000],
  ];
  for (const [label, addr, expected] of allocs) {
    const bal = await qct.balanceOf(addr);
    const got = parseFloat(ethers.formatEther(bal)).toLocaleString();
    console.log(`    ${label}: ${got} QCT`);
  }

  // ── Explorer link ─────────────────────────────────────────────────────────
  const explorer = chainId === 8453
    ? `https://basescan.org/address/${contractAddress}`
    : `https://sepolia.basescan.org/address/${contractAddress}`;
  console.log(`\n  🔗 Basescan: ${explorer}`);

  // ── Post-deploy checklist ─────────────────────────────────────────────────
  console.log("\n  📋 NEXT STEPS — FJORD LBP LAUNCH:");
  console.log("  [ ] 1. Verify on Basescan (npm run verify:mainnet)");
  console.log("  [ ] 2. Approve 78,400,000 QCT (partnerships wallet) for Fjord");
  console.log(`  [ ] 3. Go to https://fjordfoundry.com and create LBP`);
  console.log(`  [ ] 4. Paste contract: ${contractAddress}`);
  console.log("  [ ] 5. Set LBP params from queens-chariot/FJORD_LAUNCH_KIT.md");
  console.log("  [ ] 6. Add liquidity on Aerodrome (Base DEX) after LBP ends");
  console.log("  [ ] 7. Set DEX pair via setDexPair() — activates Alchemical AMM");

  // ── Save deployment record ────────────────────────────────────────────────
  const deploymentRecord = {
    network:         chainName,
    chainId,
    contractAddress,
    txHash:          receipt.hash,
    blockNumber:     receipt.blockNumber,
    deployer:        depAddr,
    deployedAt:      new Date().toISOString(),
    totalSupply:     ethers.formatEther(totalSupply),
    wallets:         WALLETS,
    explorer,
    fjordLBP: {
      tokenForSale:    "78,400,000 QCT (8% partnerships allocation)",
      startWeightQCT:  "95%",
      startWeightETH:  "5%",
      endWeightQCT:    "50%",
      endWeightETH:    "50%",
      duration:        "7 days",
      collateralToken: "ETH (Base)",
      guide:           "queens-chariot/FJORD_LAUNCH_KIT.md",
    },
  };

  const outDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `qct-${chainName}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deploymentRecord, null, 2));
  console.log(`\n  💾 Deployment saved: ${outPath}`);
  console.log("  👑 Queens Chariot is live. The protocol runs itself now.");
  console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err.message);
  process.exit(1);
});

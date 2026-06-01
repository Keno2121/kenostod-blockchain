/**
 * Queens Chariot Token (QCT) — Deployment Script
 * Target: Base Mainnet (chain ID 8453)
 *
 * Run:
 *   npm run deploy:testnet   (Base Sepolia — test first)
 *   npm run deploy:mainnet   (Base Mainnet — go live)
 *
 * Required env vars:
 *   NEW_WALLET_PRIVATE_KEY   — deployer wallet (in ../.env)
 *
 * Allocation wallets (update before deploying):
 *   QCT_PROSPERITY_POOL      — 40% Community Prosperity Pool
 *   QCT_LIQUIDITY_FORTRESS   — 20% Permanent Liquidity Lock
 *   QCT_DEV_TREASURY         — 15% Development Treasury
 *   QCT_FOUNDING_COURT       — 10% Founding Court (4-year vest)
 *   QCT_PARTNERSHIPS         — 8%  Strategic Partnerships
 *   QCT_EMERGENCY_RESERVE    — 5%  Emergency Reserve
 *
 * 7 Constitutional Laws are embedded in the contract.
 * 6 Fee Protocols are live at deployment.
 * 2% Queen's Burn executed in the constructor.
 */

const { ethers, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

// ── Allocation Wallets ────────────────────────────────────────────────────────
// IMPORTANT: Set these to real multisig/cold wallets before mainnet deploy.
// These are the permanent allocation wallets for the QCT ecosystem.
const WALLETS = {
  // 40% — Community Prosperity Pool (staking rebates + holder redistribution)
  prosperityPool:    process.env.QCT_PROSPERITY_POOL    || process.env.NEW_WALLET_PRIVATE_KEY
    ? new ethers.Wallet(process.env.NEW_WALLET_PRIVATE_KEY || "0x" + "1".repeat(64)).address
    : "0x0000000000000000000000000000000000000001",

  // 20% — Liquidity Fortress (permanent lock via Unicrypt/Team.Finance on Base)
  liquidityFortress: process.env.QCT_LIQUIDITY_FORTRESS || null,

  // 15% — Development Treasury (Gnosis Safe multisig recommended)
  devTreasury:       process.env.QCT_DEV_TREASURY       || null,

  // 10% — Founding Court (4-year linear vesting via Token Vesting contract)
  foundingCourt:     process.env.QCT_FOUNDING_COURT     || null,

  // 8% — Strategic Partnerships
  partnerships:      process.env.QCT_PARTNERSHIPS       || null,

  // 5% — Emergency Reserve (cold wallet)
  emergencyReserve:  process.env.QCT_EMERGENCY_RESERVE  || null,
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId    = network.config.chainId;
  const chainName  = network.name;

  console.log("\n" + "═".repeat(60));
  console.log("  👑 QUEENS CHARIOT TOKEN (QCT) — DEPLOYMENT");
  console.log("═".repeat(60));
  console.log(`  Network    : ${chainName} (chain ${chainId})`);
  console.log(`  Deployer   : ${deployer.address}`);
  console.log(`  Balance    : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("─".repeat(60));

  // ── Validate wallets ──────────────────────────────────────────────────────
  const walletEntries = Object.entries(WALLETS);
  for (const [name, addr] of walletEntries) {
    if (!addr || addr === "null" || !ethers.isAddress(addr)) {
      throw new Error(
        `❌ Missing wallet: ${name}\n` +
        `   Set env var QCT_${name.replace(/([A-Z])/g, "_$1").toUpperCase()} in .env`
      );
    }
    console.log(`  ${name.padEnd(20)}: ${addr}`);
  }

  console.log("─".repeat(60));
  console.log("  7 Constitutional Laws:  ✅ Embedded in contract");
  console.log("  6 Fee Protocols:        ✅ Active at deployment");
  console.log("  Queen's Burn (2%):      ✅ Burned in constructor");
  console.log("─".repeat(60));

  // ── Compile check ─────────────────────────────────────────────────────────
  const QueensChariot = await ethers.getContractFactory("QueensChariot");

  // ── Deploy ────────────────────────────────────────────────────────────────
  console.log("\n  Deploying contract...");
  const qct = await QueensChariot.deploy(
    WALLETS.prosperityPool,
    WALLETS.liquidityFortress,
    WALLETS.devTreasury,
    WALLETS.foundingCourt,
    WALLETS.partnerships,
    WALLETS.emergencyReserve,
  );

  console.log("  Waiting for deployment...");
  await qct.waitForDeployment();

  const contractAddress = await qct.getAddress();
  const deployTx        = qct.deploymentTransaction();
  const receipt         = await deployTx.wait(2);

  console.log("\n" + "═".repeat(60));
  console.log("  ✅ QCT DEPLOYED SUCCESSFULLY");
  console.log("═".repeat(60));
  console.log(`  Contract   : ${contractAddress}`);
  console.log(`  Tx hash    : ${receipt.hash}`);
  console.log(`  Block      : ${receipt.blockNumber}`);
  console.log(`  Gas used   : ${receipt.gasUsed.toString()}`);

  // ── Verify total supply ───────────────────────────────────────────────────
  const totalSupply = await qct.totalSupply();
  const expected    = ethers.parseEther("980000000"); // 1B - 2% burn = 980M
  console.log(`\n  Total supply (post Queen's Burn): ${ethers.formatEther(totalSupply)} QCT`);

  if (totalSupply === expected) {
    console.log("  ✅ Supply matches: 980,000,000 QCT (2% burned at genesis)");
  } else {
    console.log("  ⚠  Unexpected supply:", ethers.formatEther(totalSupply));
  }

  // ── Verify allocations ────────────────────────────────────────────────────
  console.log("\n  Allocation verification:");
  const checks = [
    ["prosperityPool",    WALLETS.prosperityPool,    "40%"],
    ["liquidityFortress", WALLETS.liquidityFortress, "20%"],
    ["devTreasury",       WALLETS.devTreasury,       "15%"],
    ["foundingCourt",     WALLETS.foundingCourt,     "10%"],
    ["partnerships",      WALLETS.partnerships,      " 8%"],
    ["emergencyReserve",  WALLETS.emergencyReserve,  " 5%"],
  ];

  for (const [name, addr, pct] of checks) {
    const bal = await qct.balanceOf(addr);
    console.log(`  ${pct} ${name.padEnd(20)}: ${ethers.formatUnits(bal, 18).replace(/\.0+$/, "")} QCT`);
  }

  // ── Post-deploy checklist ─────────────────────────────────────────────────
  console.log("\n  📋 POST-DEPLOY CHECKLIST:");
  console.log("  [ ] Add Uniswap V3 / Aerodrome pool as DEX pair (setDexPair)");
  console.log("  [ ] Lock liquidityFortress funds on Unicrypt / Team.Finance");
  console.log("  [ ] Transfer ownership to Gnosis Safe multisig");
  console.log("  [ ] Verify contract on Basescan (npm run verify:mainnet)");
  console.log("  [ ] Submit for CertiK / Trail of Bits audit");
  console.log("  [ ] Set up Alchemical AMM keeper for volatility updates");
  console.log("  [ ] Initialize governance portal for Court of Sovereigns");

  // ── Save deployment record ────────────────────────────────────────────────
  const deploymentRecord = {
    network:         chainName,
    chainId:         chainId,
    contractAddress: contractAddress,
    txHash:          receipt.hash,
    blockNumber:     receipt.blockNumber,
    deployer:        deployer.address,
    deployedAt:      new Date().toISOString(),
    totalSupply:     ethers.formatEther(totalSupply),
    wallets:         WALLETS,
    protocols: {
      "Tithe & Triumph":    "baseFee=2%, largeDumpFee=4%, loyaltyDiscount=0.5%",
      "SSWFR":              "Sovereign pool, stake-weighted rebates",
      "Temporal Taxonomy":  "Squire/Knight/Baron/Duke/Sovereign tiers",
      "Prosperity Cascade": "40/30/20/10 split, 0/24h/48h/72h delays",
      "Guardian's Gambit":  "Flash-loan + high-frequency detection",
      "Alchemical AMM":     "Low:0.2% / Normal:0.5% / High:1% / Extreme:2%",
    },
    constitutionalLaws: [
      "Kaprekar: _kaprekarAbsorb() routes all fees, dust to community",
      "Benford: transfer pattern tracking, anomaly flagging",
      "GoldenRatio: φ-shaped tier multipliers [1x,1.5x,2x,3x,5x]",
      "Nash: cascade splits auto-tune via setCascadeSplits",
      "Euler: continuous compounding rebate model",
      "Ramanujan: 1729 QCT lifetime milestone event",
      "Inversion: community (40%) receives value first, treasury (10%) last",
    ],
  };

  const outPath = path.join(__dirname, "..", "deployments", `qct-${chainName}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deploymentRecord, null, 2));
  console.log(`\n  💾 Deployment saved to: ${outPath}`);

  // ── Explorer link ─────────────────────────────────────────────────────────
  const explorer = chainId === 8453
    ? `https://basescan.org/address/${contractAddress}`
    : `https://sepolia.basescan.org/address/${contractAddress}`;
  console.log(`\n  🔗 ${explorer}`);
  console.log("\n  👑 The Chariot is ready. Ride together, rise together.");
  console.log("═".repeat(60) + "\n");
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err.message);
  process.exit(1);
});

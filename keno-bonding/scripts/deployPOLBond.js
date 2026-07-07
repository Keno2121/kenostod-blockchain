/**
 * Deploy KENOPOLBond — Protocol-Owned Liquidity Bonding Contract
 *
 * Run: npx hardhat run scripts/deployPOLBond.js --network bsc
 *
 * Prerequisites:
 *   1. KENO v2 already deployed: 0x48bb049afe50b050b458624dc6233acd51024ab4
 *   2. KENO/BNB LP token address from PancakeSwap (set LP_TOKEN below after PinkSale liquidity add)
 *   3. Treasury address: 0x54A01A5bf5096c351F166C15143eA9a9Af393C84
 *   4. NEW_WALLET_PRIVATE_KEY in .env with BNB for gas
 */

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying KENOPOLBond with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB\n");

  // ── Config ──────────────────────────────────────────────────────────────────
  const KENO_TOKEN = "0x48bb049afe50b050b458624dc6233acd51024ab4"; // KENO v2 BSC
  const TREASURY   = "0x54A01A5bf5096c351F166C15143eA9a9Af393C84"; // Existing treasury
  const OWNER      = deployer.address;

  // ⚠️  Set this after PancakeSwap KENO/BNB liquidity is added post-PinkSale
  // Find it at: https://pancakeswap.finance/info/pairs (search KENO/BNB)
  const LP_TOKEN   = process.env.KENO_BNB_LP || "0x0000000000000000000000000000000000000001";

  // BCV starting value — controls initial discount
  // At BCV = 3_000_000 × 1e18 and 1% debt ratio, discount starts near 5%
  const INITIAL_BCV          = hre.ethers.parseUnits("3000000", 18);
  const BCV_DECAY_BPS        = 33;   // 0.33% decay per block when under-demanded
  const TARGET_DEBT_RATIO    = 100;  // 1% of supply as target outstanding bonds

  // ── Deploy ──────────────────────────────────────────────────────────────────
  const Factory = await hre.ethers.getContractFactory("KENOPOLBond");
  const bond = await Factory.deploy(
    KENO_TOKEN,
    LP_TOKEN,
    TREASURY,
    INITIAL_BCV,
    BCV_DECAY_BPS,
    TARGET_DEBT_RATIO,
    OWNER
  );

  await bond.waitForDeployment();
  const address = await bond.getAddress();
  console.log("✅ KENOPOLBond deployed:", address);

  // ── Save deployment record ──────────────────────────────────────────────────
  const fs   = require("fs");
  const path = require("path");
  const record = {
    contract:        "KENOPOLBond",
    address,
    network:         hre.network.name,
    deployer:        deployer.address,
    deployedAt:      new Date().toISOString(),
    kenoToken:       KENO_TOKEN,
    lpToken:         LP_TOKEN,
    treasury:        TREASURY,
    initialBcv:      INITIAL_BCV.toString(),
    bcvDecayBps:     BCV_DECAY_BPS,
    targetDebtRatio: TARGET_DEBT_RATIO,
    vestingPeriod:   "432000 seconds (5 days)",
    maxDiscount:     "10%",
    minDiscount:     "1.618% (φ floor)",
    ramanujanBonus:  "1.73% silent bonus at 1729 KENO bonded milestone",
    notes: [
      "LP tokens flow permanently to treasury — no withdrawal possible",
      "KENO payout vests linearly over 5 days (continuous Euler accrual)",
      "BCV auto-adjusts each block to maintain 5-10% discount window (Nash)",
      "Allocate KENO via allocateKeno() before opening bonds",
      "Update LP_TOKEN address once PancakeSwap KENO/BNB pool is live"
    ]
  };

  const outDir = path.join(__dirname, "../deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `KENOPOLBond-${hre.network.name}.json`),
    JSON.stringify(record, null, 2)
  );
  console.log("📝 Deployment record saved to deployments/");

  // ── Verify on BSCScan ───────────────────────────────────────────────────────
  if (hre.network.name === "bsc") {
    console.log("\nWaiting 10 blocks before verification...");
    await new Promise(r => setTimeout(r, 30_000));
    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments: [
          KENO_TOKEN, LP_TOKEN, TREASURY,
          INITIAL_BCV, BCV_DECAY_BPS, TARGET_DEBT_RATIO, OWNER
        ]
      });
      console.log("✅ Verified on BSCScan");
    } catch (e) {
      console.log("⚠️  Verification failed (can retry manually):", e.message);
    }
  }

  console.log("\n─── Next steps ───────────────────────────────────────────────");
  console.log("1. After PinkSale closes (~Aug 6), add KENO/BNB liquidity on PancakeSwap");
  console.log("2. Update LP_TOKEN env var to the real LP pair address");
  console.log("3. Call allocateKeno() to deposit KENO for bond payouts");
  console.log("4. Unpause the contract — bonds are live");
  console.log("5. Announce: 'POL bonding is live — bond your LP tokens for discounted KENO'");
}

main().catch((e) => { console.error(e); process.exit(1); });

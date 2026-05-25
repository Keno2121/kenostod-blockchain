/**
 * King's Shield — Aegis Tax Collector
 * =====================================
 * Withdraws accumulated Aegis Tax (6.174% transfer fees) from the mint
 * and distributes in 3 ways — every split is a Kaprekar number:
 *
 *   3.000 / 6.174 (48.6%) → Holder Yield distributor
 *                            (redistributed pro-rata to all SHIELD holders)
 *   2.000 / 6.174 (32.4%) → Auto-Liquidity wallet
 *                            (adds to Raydium SHIELD/SOL pool)
 *   1.174 / 6.174 (19.0%) → Kenostod Bridge wallet
 *                            (bridges to BSC → buys + burns KENO)
 *
 * Total: 6.174% — Kaprekar's Constant as a percentage. Cannot be disabled,
 * bypassed, or modified without redeploying the token.
 *
 * This script runs on a schedule (daily) via the Aegis relay.
 * Usage: ts-node collect-aegis-tax.ts --cluster devnet
 */

import {
  Connection, Keypair, PublicKey,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  withdrawWithheldTokensFromMint,
  getMint,
  getTransferFeeConfig,
  createAssociatedTokenAccountIdempotent,
  transfer,
} from "@solana/spl-token";
import * as bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, ".env") });

// ── Aegis Tax Split (all out of 6174 total parts) ─────────────────────────
// 3.000% → Holder Yield   (3000/6174)
// 2.000% → Auto-Liquidity (2000/6174)
// 1.174% → KENO Bridge    (1174/6174)
const TOTAL_PARTS          = 6174n;
const HOLDER_YIELD_PARTS   = 3000n;  // 3.000%
const AUTO_LIQUIDITY_PARTS = 2000n;  // 2.000%
const KENO_BRIDGE_PARTS    = 1174n;  // 1.174%

function getCluster(): string {
  const idx = process.argv.indexOf("--cluster");
  return idx !== -1 ? process.argv[idx + 1] : "devnet";
}

function loadAuthority(): Keypair {
  const kpFile = path.join(__dirname, "shield-mint-keypair.json");
  if (fs.existsSync(kpFile)) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpFile, "utf8"))));
  }
  const privKey = process.env.SHIELD_MINT_AUTHORITY_PRIVKEY?.trim();
  if (!privKey) throw new Error("No authority keypair found.");
  return Keypair.fromSecretKey(bs58.decode(privKey));
}

async function main() {
  const cluster     = getCluster();
  const rpcUrl      = cluster === "mainnet"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";
  const connection  = new Connection(rpcUrl, "confirmed");
  const authority   = loadAuthority();

  const deployFile  = path.join(__dirname, `../deployments/shield-${cluster}.json`);
  if (!fs.existsSync(deployFile)) throw new Error("No deployment found. Deploy first.");
  const deploy      = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  const mintPubkey  = new PublicKey(deploy.mintAddress);

  const holderYieldWallet  = process.env.SHIELD_HOLDER_YIELD_WALLET;  // 3.000% → all holders
  const autoLiqWallet      = process.env.SHIELD_AUTO_LIQ_WALLET;      // 2.000% → Raydium LP
  const bridgeWallet       = process.env.SHIELD_BRIDGE_WALLET;        // 1.174% → KENO burn

  if (!holderYieldWallet || !autoLiqWallet || !bridgeWallet) {
    throw new Error(
      "Set SHIELD_HOLDER_YIELD_WALLET, SHIELD_AUTO_LIQ_WALLET, and SHIELD_BRIDGE_WALLET in .env"
    );
  }

  console.log("\n══════════════════════════════════════════════════");
  console.log("  King's Shield — Aegis Tax Collection");
  console.log(`  Cluster: ${cluster}`);
  console.log(`  Mint:    ${deploy.mintAddress}`);
  console.log("══════════════════════════════════════════════════\n");

  // Get mint info to check withheld amount
  const mintInfo  = await getMint(connection, mintPubkey, "confirmed", TOKEN_2022_PROGRAM_ID);
  const feeConfig = getTransferFeeConfig(mintInfo);

  if (!feeConfig) {
    throw new Error("No TransferFeeConfig on this mint — wrong token.");
  }

  const withheldOnMint = feeConfig.withheldAmount;
  console.log(`  Fees withheld on mint: ${withheldOnMint} (raw units)`);
  console.log(`  ≈ ${Number(withheldOnMint) / 10**9} SHIELD`);

  if (withheldOnMint === 0n) {
    console.log("  No fees to collect yet. Check back after trading activity.");
    return;
  }

  // Authority's receiving ATA
  const authorityATA = await createAssociatedTokenAccountIdempotent(
    connection, authority, mintPubkey, authority.publicKey, {}, TOKEN_2022_PROGRAM_ID
  );

  // Withdraw withheld fees from mint to authority ATA
  console.log("\n  Withdrawing withheld fees from mint...");
  const withdrawSig = await withdrawWithheldTokensFromMint(
    connection,
    authority,
    mintPubkey,
    authorityATA,
    authority,
    [],
    {},
    TOKEN_2022_PROGRAM_ID
  );
  console.log(`  ✅ Withdrawn — Tx: ${withdrawSig}`);

  // ── 3-Way Split: 3000 + 2000 + 1174 = 6174 (Kaprekar's Constant) ────────
  const holderYieldAmount = withheldOnMint * HOLDER_YIELD_PARTS   / TOTAL_PARTS;
  const autoLiqAmount     = withheldOnMint * AUTO_LIQUIDITY_PARTS / TOTAL_PARTS;
  const bridgeAmount      = withheldOnMint - holderYieldAmount - autoLiqAmount; // remainder = 1174 parts

  const fmt = (n: bigint) => (Number(n) / 1e9).toFixed(4);

  console.log(`\n  ━━ 6.174% Aegis Tax Split ━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Holder Yield  (3.000%): ${fmt(holderYieldAmount)} SHIELD → ${holderYieldWallet}`);
  console.log(`  Auto-Liquidity(2.000%): ${fmt(autoLiqAmount)}     SHIELD → Raydium LP`);
  console.log(`  KENO Bridge   (1.174%): ${fmt(bridgeAmount)}     SHIELD → BSC burn`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // 1. Holder Yield wallet (redistributor — can be a staking pool or snapshot contract)
  const holderYieldATA = await createAssociatedTokenAccountIdempotent(
    connection, authority, mintPubkey, new PublicKey(holderYieldWallet), {}, TOKEN_2022_PROGRAM_ID
  );
  let sig1 = "", sig2 = "", sig3 = "";
  if (holderYieldAmount > 0n) {
    sig1 = await transfer(
      connection, authority, authorityATA, holderYieldATA,
      authority, holderYieldAmount, [], {}, TOKEN_2022_PROGRAM_ID
    );
    console.log(`\n  ✅ Holder Yield funded (3%) — Tx: ${sig1}`);
  }

  // 2. Auto-Liquidity wallet (adds to Raydium SHIELD/SOL pool)
  const autoLiqATA = await createAssociatedTokenAccountIdempotent(
    connection, authority, mintPubkey, new PublicKey(autoLiqWallet), {}, TOKEN_2022_PROGRAM_ID
  );
  if (autoLiqAmount > 0n) {
    sig2 = await transfer(
      connection, authority, authorityATA, autoLiqATA,
      authority, autoLiqAmount, [], {}, TOKEN_2022_PROGRAM_ID
    );
    console.log(`  ✅ Auto-Liquidity funded (2%) — Tx: ${sig2}`);
    console.log(`     (LP manager will pair with SOL and add to Raydium SHIELD/SOL pool)`);
  }

  // 3. KENO Bridge/Burn wallet (Aegis relay bridges to BSC → burns KENO)
  const bridgeATA = await createAssociatedTokenAccountIdempotent(
    connection, authority, mintPubkey, new PublicKey(bridgeWallet), {}, TOKEN_2022_PROGRAM_ID
  );
  if (bridgeAmount > 0n) {
    sig3 = await transfer(
      connection, authority, authorityATA, bridgeATA,
      authority, bridgeAmount, [], {}, TOKEN_2022_PROGRAM_ID
    );
    console.log(`  ✅ KENO Bridge funded (1.174%) — Tx: ${sig3}`);
    console.log(`     (Aegis relay: SHIELD → SOL → bridge to BSC → buy+burn KENO → supply ↓)`);
  }

  // Log collection event
  const logFile = path.join(__dirname, "../deployments/aegis-collections.json");
  const log = fs.existsSync(logFile)
    ? JSON.parse(fs.readFileSync(logFile, "utf8")) : [];
  log.push({
    collectedAt:       new Date().toISOString(),
    totalWithheld:     withheldOnMint.toString(),
    holderYieldAmount: holderYieldAmount.toString(),
    autoLiqAmount:     autoLiqAmount.toString(),
    bridgeAmount:      bridgeAmount.toString(),
    withdrawTx:        withdrawSig,
    holderYieldTx:     sig1,
    autoLiqTx:         sig2,
    bridgeTx:          sig3,
  });
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));

  console.log("\n══════════════════════════════════════════════════");
  console.log("  Aegis Tax collection complete — all 3 streams funded.");
  console.log("  3% → Holders   2% → LP   1.174% → KENO Burn");
  console.log("  Total: 6.174% (Kaprekar's Constant)");
  console.log("══════════════════════════════════════════════════\n");
}

main().catch(err => { console.error(err); process.exit(1); });

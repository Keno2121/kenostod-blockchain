/**
 * King's Shield — Aegis Tax Collector
 * =====================================
 * Withdraws accumulated Aegis Tax (3% transfer fees) from the mint
 * and splits them:
 *   1.174 / 3.000 (39.1%) → Kenostod Bridge wallet (KENO burn relay)
 *   1.826 / 3.000 (60.9%) → Kenostod Academy Treasury
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
  harvestWithheldTokensToMint,
  getAccount,
  getMint,
  unpackMint,
  getTransferFeeConfig,
  createAssociatedTokenAccountIdempotent,
  transfer,
  getTokenAccountsByOwner,
} from "@solana/spl-token";
import * as bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, ".env") });

// 1.174% of every 3% Aegis Tax goes to KENO bridge/burn
const BRIDGE_TAX_NUMERATOR   = 1174n;
const BRIDGE_TAX_DENOMINATOR = 3000n;

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

  const bridgeWallet   = process.env.SHIELD_BRIDGE_WALLET;   // receives KENO burn fuel
  const treasuryWallet = process.env.SHIELD_ACADEMY_TREASURY_WALLET;

  if (!bridgeWallet || !treasuryWallet) {
    throw new Error("Set SHIELD_BRIDGE_WALLET and SHIELD_ACADEMY_TREASURY_WALLET in .env");
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

  // Calculate split
  const bridgeAmount   = withheldOnMint * BRIDGE_TAX_NUMERATOR / BRIDGE_TAX_DENOMINATOR;
  const treasuryAmount = withheldOnMint - bridgeAmount;

  console.log(`\n  Split:`);
  console.log(`    Kenostod Bridge (KENO burn): ${Number(bridgeAmount) / 1e9} SHIELD (1.174%)`);
  console.log(`    Academy Treasury:            ${Number(treasuryAmount) / 1e9} SHIELD (1.826%)`);

  // Send to bridge wallet
  const bridgeATA = await createAssociatedTokenAccountIdempotent(
    connection, authority, mintPubkey, new PublicKey(bridgeWallet), {}, TOKEN_2022_PROGRAM_ID
  );
  if (bridgeAmount > 0n) {
    const sig1 = await transfer(
      connection, authority, authorityATA, bridgeATA,
      authority, bridgeAmount, [], {}, TOKEN_2022_PROGRAM_ID
    );
    console.log(`\n  ✅ Bridge wallet funded — Tx: ${sig1}`);
    console.log(`     (Bridge relay will swap SHIELD for SOL → bridge to BSC → burn KENO)`);
  }

  // Send to treasury
  const treasuryATA = await createAssociatedTokenAccountIdempotent(
    connection, authority, mintPubkey, new PublicKey(treasuryWallet), {}, TOKEN_2022_PROGRAM_ID
  );
  if (treasuryAmount > 0n) {
    const sig2 = await transfer(
      connection, authority, authorityATA, treasuryATA,
      authority, treasuryAmount, [], {}, TOKEN_2022_PROGRAM_ID
    );
    console.log(`  ✅ Treasury funded — Tx: ${sig2}`);
  }

  // Log collection event
  const logFile = path.join(__dirname, "../deployments/aegis-collections.json");
  const log = fs.existsSync(logFile)
    ? JSON.parse(fs.readFileSync(logFile, "utf8")) : [];
  log.push({
    collectedAt:   new Date().toISOString(),
    totalWithheld: withheldOnMint.toString(),
    bridgeAmount:  bridgeAmount.toString(),
    treasuryAmount: treasuryAmount.toString(),
    withdrawTx:    withdrawSig,
  });
  fs.writeFileSync(logFile, JSON.stringify(log, null, 2));

  console.log("\n══════════════════════════════════════════════════");
  console.log("  Aegis Tax collection complete.");
  console.log("  Bridge wallet funded → relay will trigger KENO burn.");
  console.log("══════════════════════════════════════════════════\n");
}

main().catch(err => { console.error(err); process.exit(1); });

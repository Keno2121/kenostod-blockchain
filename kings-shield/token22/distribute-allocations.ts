/**
 * King's Shield (SHIELD) — Allocation Distribution
 * =================================================
 * Sends minted SHIELD tokens to the 5 allocation wallets per tokenomics:
 *
 *   40% — Initial Liquidity & Presale     (2,469,600,000 SHIELD)
 *   20% — Kenostod Academy Treasury       (1,234,800,000 SHIELD)
 *   15% — Marketing & Global Expansion      (926,100,000 SHIELD)
 *   15% — Ecosystem Rewards & Grants        (926,100,000 SHIELD)
 *   10% — Core Team (Locked 617.4 days)     (617,400,000 SHIELD)
 *
 * ⚠️  Set wallet addresses in .env before running.
 *     Run deploy-shield.ts first.
 *
 * Usage: ts-node distribute-allocations.ts --cluster devnet
 */

import {
  Connection, Keypair, PublicKey, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  transfer,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import * as bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, ".env") });

const DECIMALS      = 9;
const TOTAL_SUPPLY  = 6_174_000_000n;
const TOTAL_RAW     = TOTAL_SUPPLY * BigInt(10 ** DECIMALS);

// ── Allocation config — set recipient wallet addresses in .env ────────────
const ALLOCATION_CONFIG = [
  {
    key:     "SHIELD_LIQUIDITY_PRESALE_WALLET",
    label:   "Initial Liquidity & Presale",
    pct:     40n,
    locked:  false,
    lockDays: 0,
  },
  {
    key:     "SHIELD_ACADEMY_TREASURY_WALLET",
    label:   "Kenostod Academy Treasury",
    pct:     20n,
    locked:  false,
    lockDays: 0,
  },
  {
    key:     "SHIELD_MARKETING_WALLET",
    label:   "Marketing & Global Expansion",
    pct:     15n,
    locked:  false,
    lockDays: 0,
  },
  {
    key:     "SHIELD_ECOSYSTEM_WALLET",
    label:   "Ecosystem Rewards & Grants",
    pct:     15n,
    locked:  false,
    lockDays: 0,
  },
  {
    key:     "SHIELD_CORETEAM_WALLET",
    label:   "Core Team (Locked 617.4 days)",
    pct:     10n,
    locked:  true,
    lockDays: 617.4,
  },
];

function getCluster(): string {
  const idx = process.argv.indexOf("--cluster");
  return idx !== -1 ? process.argv[idx + 1] : "devnet";
}

function getRpcUrl(cluster: string): string {
  return cluster === "mainnet"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";
}

function loadAuthority(): Keypair {
  const kpFile = path.join(__dirname, "shield-mint-keypair.json");
  if (fs.existsSync(kpFile)) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpFile, "utf8"))));
  }
  const privKey = process.env.SHIELD_MINT_AUTHORITY_PRIVKEY?.trim();
  if (!privKey) throw new Error("No authority keypair. Run generate-wallet.js first.");
  return Keypair.fromSecretKey(bs58.decode(privKey));
}

async function main() {
  const cluster    = getCluster();
  const connection = new Connection(getRpcUrl(cluster), "confirmed");
  const authority  = loadAuthority();

  // Load deployment record
  const deployFile = path.join(__dirname, `../deployments/shield-${cluster}.json`);
  if (!fs.existsSync(deployFile)) {
    throw new Error(`No deployment found for ${cluster}. Run deploy-shield.ts first.`);
  }
  const deploy    = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  const mintPubkey = new PublicKey(deploy.mintAddress);

  console.log("\n══════════════════════════════════════════════════");
  console.log("  King's Shield — Allocation Distribution");
  console.log(`  Cluster:  ${cluster}`);
  console.log(`  Mint:     ${deploy.mintAddress}`);
  console.log(`  Supply:   6,174,000,000 SHIELD`);
  console.log("══════════════════════════════════════════════════\n");

  // Authority's source ATA
  const sourceATA = await createAssociatedTokenAccountIdempotent(
    connection, authority, mintPubkey, authority.publicKey, {}, TOKEN_2022_PROGRAM_ID
  );

  const results: any[] = [];

  for (const alloc of ALLOCATION_CONFIG) {
    const walletAddr = process.env[alloc.key];
    const amount     = TOTAL_RAW * alloc.pct / 100n;
    const amountUi   = (TOTAL_SUPPLY * alloc.pct / 100n).toLocaleString();

    if (!walletAddr) {
      console.log(`  ⏭️  SKIP — ${alloc.label}`);
      console.log(`        Set ${alloc.key} in .env to enable this transfer.\n`);
      results.push({ label: alloc.label, status: "skipped — wallet not configured", amount: amountUi });
      continue;
    }

    try {
      const destPubkey = new PublicKey(walletAddr);

      // Create destination ATA
      const destATA = await getOrCreateAssociatedTokenAccount(
        connection, authority, mintPubkey, destPubkey,
        false, "confirmed", {}, TOKEN_2022_PROGRAM_ID
      );

      console.log(`  💸  ${alloc.label}`);
      console.log(`      Amount:  ${amountUi} SHIELD (${alloc.pct}%)`);
      console.log(`      To:      ${walletAddr}`);
      if (alloc.locked) {
        console.log(`      🔒 Lock:  ${alloc.lockDays} days (${alloc.lockDays / 365 * 12 | 0} months)`);
        console.log(`      Note: Core team vesting enforced by multisig/timelock — deploy separately`);
      }

      const txSig = await transfer(
        connection,
        authority,
        sourceATA,
        destATA.address,
        authority,
        amount,
        [],
        {},
        TOKEN_2022_PROGRAM_ID
      );

      console.log(`      ✅ Tx: ${txSig}\n`);
      results.push({ label: alloc.label, status: "sent", amount: amountUi, tx: txSig, wallet: walletAddr });
    } catch (err: any) {
      console.error(`      ❌ Failed: ${err.message}\n`);
      results.push({ label: alloc.label, status: "failed", error: err.message });
    }
  }

  // Save distribution record
  const distRecord = {
    cluster, mintAddress: deploy.mintAddress,
    distributedAt: new Date().toISOString(),
    results,
  };
  const distFile = path.join(__dirname, `../deployments/shield-distribution-${cluster}.json`);
  fs.writeFileSync(distFile, JSON.stringify(distRecord, null, 2));

  console.log("══════════════════════════════════════════════════");
  console.log("  Distribution Summary");
  for (const r of results) {
    const icon = r.status === "sent" ? "✅" : r.status === "skipped" ? "⏭️" : "❌";
    console.log(`  ${icon}  ${r.label}: ${r.amount} SHIELD`);
  }
  console.log("══════════════════════════════════════════════════\n");
}

main().catch(err => { console.error(err); process.exit(1); });

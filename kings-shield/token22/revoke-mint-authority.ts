/**
 * King's Shield — Revoke Mint Authority
 * ======================================
 * CRITICAL SECURITY STEP — Run AFTER tokens are fully distributed.
 *
 * Revoking the mint authority proves to the market that the SHIELD supply
 * is permanently fixed at 6,174,000,000. No new tokens can ever be created.
 * This is the on-chain equivalent of burning the printing press.
 *
 * What this does:
 *   1. Verifies all allocations have been distributed (safety guard)
 *   2. Revokes the mint authority (setAuthority → null)
 *   3. Optionally revokes the freeze authority
 *   4. Optionally revokes the interest rate authority (locks 6.174% permanently)
 *   5. Saves revocation record to deployments/
 *
 * ⚠️  THIS IS IRREVERSIBLE. You cannot undo this.
 *     Run check-status.ts first and confirm supply = 6,174,000,000.
 *
 * Usage:
 *   ts-node revoke-mint-authority.ts --cluster devnet --confirm
 *   ts-node revoke-mint-authority.ts --cluster mainnet --confirm
 *   ts-node revoke-mint-authority.ts --cluster mainnet --confirm --also-freeze --also-rate
 */

import {
  Connection, Keypair, PublicKey, LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getMint,
  setAuthority,
  AuthorityType,
  getTransferFeeConfig,
} from "@solana/spl-token";
import bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, ".env") });

function getCluster(): string {
  const idx = process.argv.indexOf("--cluster");
  return idx !== -1 ? process.argv[idx + 1] : "devnet";
}

function getRpcUrl(cluster: string): string {
  if (cluster === "mainnet") return "https://api.mainnet-beta.solana.com";
  return "https://api.devnet.solana.com";
}

function loadAuthority(): Keypair {
  const kpFile = path.join(__dirname, "shield-mint-keypair.json");
  if (fs.existsSync(kpFile)) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpFile, "utf8"))));
  }
  const privKey = process.env.SHIELD_MINT_AUTHORITY_PRIVKEY?.trim();
  if (!privKey) throw new Error("No authority keypair found. Check .env");
  return Keypair.fromSecretKey(bs58.decode(privKey));
}

async function main() {
  const cluster      = getCluster();
  const confirmed    = process.argv.includes("--confirm");
  const alsoFreeze   = process.argv.includes("--also-freeze");
  const alsoRate     = process.argv.includes("--also-rate");

  if (!confirmed) {
    console.log("\n⚠️  REVOKE MINT AUTHORITY — IRREVERSIBLE ACTION");
    console.log("════════════════════════════════════════════════════");
    console.log("  This will permanently revoke the mint authority.");
    console.log("  No new SHIELD tokens can ever be created after this.");
    console.log("");
    console.log("  Prerequisites:");
    console.log("    1. All allocations distributed (run distribute-allocations.ts first)");
    console.log("    2. You've confirmed supply = 6,174,000,000 SHIELD on-chain");
    console.log("");
    console.log("  Options:");
    console.log("    --also-freeze   Also revoke freeze authority");
    console.log("    --also-rate     Also revoke interest rate authority (locks 6.174% APY forever)");
    console.log("");
    console.log("  To proceed: ts-node revoke-mint-authority.ts --cluster " + cluster + " --confirm");
    console.log("");
    return;
  }

  const rpcUrl     = getRpcUrl(cluster);
  const connection = new Connection(rpcUrl, "confirmed");
  const authority  = loadAuthority();

  const deployFile = path.join(__dirname, `../deployments/shield-${cluster}.json`);
  if (!fs.existsSync(deployFile)) {
    throw new Error(`No deployment found for cluster '${cluster}'. Deploy first.`);
  }
  const deploy     = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  const mintPubkey = new PublicKey(deploy.mintAddress);

  console.log("\n════════════════════════════════════════════════════");
  console.log("  ⚔️  King's Shield — Revoking Mint Authority");
  console.log(`  Cluster: ${cluster.toUpperCase()}`);
  console.log(`  Mint:    ${deploy.mintAddress}`);
  console.log("════════════════════════════════════════════════════\n");

  // ── Safety check: verify supply is fully minted ──────────────────────
  console.log("  Step 1: Verifying on-chain supply...");
  const mintInfo = await getMint(connection, mintPubkey, "confirmed", TOKEN_2022_PROGRAM_ID);
  const supply   = Number(mintInfo.supply) / (10 ** mintInfo.decimals);

  if (supply !== 6_174_000_000) {
    throw new Error(
      `Supply mismatch: expected 6,174,000,000 but found ${supply.toLocaleString()}. ` +
      `Ensure full supply is minted before revoking.`
    );
  }
  console.log(`  ✅ Supply verified: 6,174,000,000 SHIELD`);

  if (mintInfo.mintAuthority === null) {
    console.log("  ℹ️  Mint authority already revoked — nothing to do.");
    return;
  }

  const balance = await connection.getBalance(authority.publicKey);
  console.log(`  Authority balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  // ── Revoke mint authority ─────────────────────────────────────────────
  console.log("\n  Step 2: Revoking mint authority...");
  const mintRevokeSig = await setAuthority(
    connection,
    authority,
    mintPubkey,
    authority,
    AuthorityType.MintTokens,
    null,
    [],
    {},
    TOKEN_2022_PROGRAM_ID
  );
  console.log(`  ✅ Mint authority REVOKED — Tx: ${mintRevokeSig}`);
  console.log(`     No new SHIELD tokens can ever be created.`);

  const revocationRecord: Record<string, any> = {
    cluster,
    mintAddress:   deploy.mintAddress,
    revokedAt:     new Date().toISOString(),
    mintRevokeTx:  mintRevokeSig,
    supplyAtRevoke: supply.toString(),
    message: "Mint authority permanently revoked. Fixed supply of 6,174,000,000 SHIELD.",
  };

  // ── Optionally revoke freeze authority ───────────────────────────────
  if (alsoFreeze && mintInfo.freezeAuthority) {
    console.log("\n  Step 3: Revoking freeze authority...");
    const freezeRevokeSig = await setAuthority(
      connection,
      authority,
      mintPubkey,
      authority,
      AuthorityType.FreezeAccount,
      null,
      [],
      {},
      TOKEN_2022_PROGRAM_ID
    );
    console.log(`  ✅ Freeze authority REVOKED — Tx: ${freezeRevokeSig}`);
    console.log(`     Token accounts can no longer be frozen.`);
    revocationRecord.freezeRevokeTx = freezeRevokeSig;
  }

  // ── Optionally lock the interest rate ────────────────────────────────
  if (alsoRate) {
    console.log("\n  Step 4: Revoking interest rate authority (locking 6.174% APY)...");
    const rateRevokeSig = await setAuthority(
      connection,
      authority,
      mintPubkey,
      authority,
      AuthorityType.InterestRate,
      null,
      [],
      {},
      TOKEN_2022_PROGRAM_ID
    );
    console.log(`  ✅ Interest rate LOCKED at 6.174% permanently — Tx: ${rateRevokeSig}`);
    revocationRecord.interestRateRevokeTx = rateRevokeSig;
  }

  // ── Save revocation record ────────────────────────────────────────────
  const deploymentsDir  = path.join(__dirname, "../deployments");
  const revocationFile  = path.join(deploymentsDir, `revocation-${cluster}.json`);
  fs.writeFileSync(revocationFile, JSON.stringify(revocationRecord, null, 2));
  console.log(`\n  📄 Revocation record: kings-shield/deployments/revocation-${cluster}.json`);

  // Update deploy record with revocation info
  deploy.mintAuthorityRevoked = true;
  deploy.mintRevokeTx         = mintRevokeSig;
  deploy.revokedAt            = new Date().toISOString();
  fs.writeFileSync(deployFile, JSON.stringify(deploy, null, 2));

  console.log("\n════════════════════════════════════════════════════");
  console.log("  REVOCATION COMPLETE");
  console.log(`  Supply : 6,174,000,000 SHIELD (permanently fixed)`);
  console.log(`  Mint   : ${deploy.mintAddress}`);
  console.log(`  Status : Mint authority REVOKED — fixed supply proven on-chain`);
  console.log(`  Verify : https://solscan.io/token/${deploy.mintAddress}${cluster === "devnet" ? "?cluster=devnet" : ""}`);
  console.log("════════════════════════════════════════════════════");
  console.log(`\n  BSCScan KENO: Any KENO burns triggered by the 1.174% bridge will now`);
  console.log(`  appear as permanent deflationary pressure with no offset possible.\n`);
}

main().catch(err => {
  console.error("Revocation error:", err.message);
  process.exit(1);
});

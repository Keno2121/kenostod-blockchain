/**
 * King's Shield (SHIELD) — Token-2022 Status Checker
 * ====================================================
 * Reads and displays the full on-chain state of the deployed SHIELD token:
 *   • Mint info (supply, decimals, authorities)
 *   • TransferFeeConfig (Aegis Tax bps, withheld amounts)
 *   • InterestBearingConfig (annual rate)
 *   • Authority wallet balances
 *   • Deployment readiness checklist
 *
 * Usage:
 *   ts-node check-status.ts --cluster devnet
 *   ts-node check-status.ts --cluster mainnet
 */

import {
  Connection, Keypair, PublicKey, LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getMint,
  getTransferFeeConfig,
  getInterestBearingMintConfigState,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, ".env") });

// ── Helpers ───────────────────────────────────────────────────────────────
function getCluster(): string {
  const idx = process.argv.indexOf("--cluster");
  return idx !== -1 ? process.argv[idx + 1] : "devnet";
}

function getRpcUrl(cluster: string): string {
  if (cluster === "mainnet") return "https://api.mainnet-beta.solana.com";
  return "https://api.devnet.solana.com";
}

function loadAuthority(): Keypair | null {
  try {
    const kpFile = path.join(__dirname, "shield-mint-keypair.json");
    if (fs.existsSync(kpFile)) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(kpFile, "utf8"))));
    }
    const privKey = process.env.SHIELD_MINT_AUTHORITY_PRIVKEY?.trim();
    if (privKey) return Keypair.fromSecretKey(bs58.decode(privKey));
  } catch (_) {}
  return null;
}

function check(label: string, ok: boolean, detail?: string) {
  const icon = ok ? "✅" : "❌";
  const msg  = detail ? `  ${icon} ${label}: ${detail}` : `  ${icon} ${label}`;
  console.log(msg);
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const cluster    = getCluster();
  const rpcUrl     = getRpcUrl(cluster);
  const connection = new Connection(rpcUrl, "confirmed");
  const authority  = loadAuthority();

  const deploymentsDir = path.join(__dirname, "../deployments");
  const deployFile     = path.join(deploymentsDir, `shield-${cluster}.json`);
  const hasDeployment  = fs.existsSync(deployFile);

  console.log("\n══════════════════════════════════════════════════════");
  console.log("  ⚔️  KING'S SHIELD (SHIELD) — Status Check");
  console.log(`  Cluster: ${cluster.toUpperCase()}`);
  console.log("══════════════════════════════════════════════════════\n");

  // ── Authority wallet ──────────────────────────────────────────────────
  console.log("▸ Authority Wallet");
  if (authority) {
    const authPubkey = authority.publicKey.toBase58();
    const balance    = await connection.getBalance(authority.publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    console.log(`  Address : ${authPubkey}`);
    console.log(`  Balance : ${solBalance.toFixed(6)} SOL`);
    check("Sufficient for deploy (≥0.1 SOL)", solBalance >= 0.1, `${solBalance.toFixed(4)} SOL`);
    check("Sufficient for distribution (≥0.05 SOL)", solBalance >= 0.05);
  } else {
    console.log("  ⚠️  Authority keypair not found — check .env or shield-mint-keypair.json");
  }

  // ── Deployment record ─────────────────────────────────────────────────
  console.log("\n▸ Deployment Record");
  if (!hasDeployment) {
    console.log(`  ❌ No deployment found for cluster '${cluster}'`);
    console.log(`  Run: npm run deploy:${cluster === "mainnet" ? "mainnet" : "devnet"}`);

    // Still show readiness checklist
    console.log("\n▸ Pre-Deploy Checklist");
    check("Authority keypair loaded",         !!authority);
    check("SHIELD_MINT_AUTHORITY_PRIVKEY set", !!process.env.SHIELD_MINT_AUTHORITY_PRIVKEY);
    check("Recipient wallets in .env",
      !!(process.env.SHIELD_LIQUIDITY_PRESALE_WALLET &&
         process.env.SHIELD_TREASURY_WALLET &&
         process.env.SHIELD_MARKETING_WALLET &&
         process.env.SHIELD_ECOSYSTEM_WALLET &&
         process.env.SHIELD_TEAM_WALLET)
    );
    return;
  }

  const deploy     = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  const mintPubkey = new PublicKey(deploy.mintAddress);

  console.log(`  Mint address  : ${deploy.mintAddress}`);
  console.log(`  Deployed at   : ${deploy.deployedAt}`);
  console.log(`  Deploy tx     : ${deploy.deployTx}`);
  console.log(`  Explorer      : https://solscan.io/token/${deploy.mintAddress}${cluster === "devnet" ? "?cluster=devnet" : ""}`);

  // ── On-chain mint state ───────────────────────────────────────────────
  console.log("\n▸ On-Chain Mint State");
  try {
    const mintInfo   = await getMint(connection, mintPubkey, "confirmed", TOKEN_2022_PROGRAM_ID);
    const supply     = Number(mintInfo.supply) / (10 ** mintInfo.decimals);
    const supplyFmt  = supply.toLocaleString("en-US", { maximumFractionDigits: 0 });

    console.log(`  Total supply  : ${supplyFmt} SHIELD`);
    console.log(`  Decimals      : ${mintInfo.decimals}`);
    console.log(`  Mint authority: ${mintInfo.mintAuthority?.toBase58() ?? "⚠️ REVOKED"}`);
    console.log(`  Freeze auth   : ${mintInfo.freezeAuthority?.toBase58() ?? "None"}`);
    console.log(`  Is initialized: ${mintInfo.isInitialized}`);

    check("Supply = 6,174,000,000", supply === 6_174_000_000, `${supplyFmt}`);
    check("Decimals = 9",           mintInfo.decimals === 9);
    check("Is initialized",         mintInfo.isInitialized);

    const mintRevoked = mintInfo.mintAuthority === null;
    check(
      "Mint authority status",
      mintRevoked,
      mintRevoked ? "REVOKED ✅ (fixed supply proven)" : "Still set — run revoke-mint-authority.ts after distribution"
    );

    // ── TransferFeeConfig ─────────────────────────────────────────────
    console.log("\n▸ Aegis Tax (TransferFeeConfig)");
    const feeConfig = getTransferFeeConfig(mintInfo);
    if (feeConfig) {
      const bps           = feeConfig.newerTransferFee.transferFeeBasisPoints;
      const pct           = (bps / 100).toFixed(3);
      const withheldMint  = Number(feeConfig.withheldAmount) / 1e9;
      console.log(`  Fee rate      : ${bps} bps = ${pct}% per transfer`);
      console.log(`  Maximum fee   : ${feeConfig.newerTransferFee.maximumFee === BigInt("18446744073709551615") ? "No cap (u64::MAX)" : feeConfig.newerTransferFee.maximumFee}`);
      console.log(`  Withheld (mint): ${withheldMint.toFixed(4)} SHIELD ready to collect`);
      console.log(`  Fee authority : ${feeConfig.transferFeeConfigAuthority?.toBase58() ?? "Revoked"}`);
      console.log(`  Withdraw auth : ${feeConfig.withdrawWithheldAuthority?.toBase58() ?? "Revoked"}`);
      check("Aegis Tax = 617 bps (6.17%)",  bps === 617,  `${bps} bps`);
      check("No fee cap (u64::MAX)",          feeConfig.newerTransferFee.maximumFee === BigInt("18446744073709551615"));
    } else {
      console.log("  ❌ No TransferFeeConfig found — was the correct extensions used in deploy?");
    }

    // ── InterestBearingConfig ─────────────────────────────────────────
    console.log("\n▸ Interest Bearing Config");
    const ibConfig = getInterestBearingMintConfigState(mintInfo);
    if (ibConfig) {
      const ratePct = (ibConfig.currentRate / 100).toFixed(3);
      console.log(`  Rate          : ${ibConfig.currentRate} bps = ${ratePct}% annual`);
      console.log(`  Rate authority: ${ibConfig.rateAuthority?.toBase58() ?? "None"}`);
      check("Rate = 617 bps (6.17% Kaprekar)", ibConfig.currentRate === 617, `${ibConfig.currentRate} bps`);
    } else {
      console.log("  ❌ No InterestBearingConfig found");
    }

    // ── Authority ATA balance ─────────────────────────────────────────
    if (authority) {
      console.log("\n▸ Authority Token Account");
      try {
        const ataAddr = getAssociatedTokenAddressSync(
          mintPubkey, authority.publicKey, false, TOKEN_2022_PROGRAM_ID
        );
        const ataInfo = await getAccount(connection, ataAddr, "confirmed", TOKEN_2022_PROGRAM_ID);
        const balance = Number(ataInfo.amount) / 1e9;
        const balFmt  = balance.toLocaleString("en-US", { maximumFractionDigits: 0 });
        console.log(`  ATA address   : ${ataAddr.toBase58()}`);
        console.log(`  Balance       : ${balFmt} SHIELD`);
        const pct = (balance / 6_174_000_000 * 100).toFixed(2);
        console.log(`  % of supply   : ${pct}%`);
        check("Tokens still in authority ATA", balance > 0, `${balFmt} SHIELD (${pct}%)`);
      } catch (_) {
        console.log("  No ATA found for authority — tokens may already be distributed");
      }
    }

  } catch (err: any) {
    console.log(`  ❌ Error reading mint: ${err.message}`);
    console.log("  Is the cluster correct? Is the mint address valid?");
  }

  // ── Deployment files ──────────────────────────────────────────────────
  console.log("\n▸ Deployment Files");
  const files = [
    { path: deployFile,                      label: `shield-${cluster}.json` },
    { path: path.join(deploymentsDir, "aegis-collections.json"), label: "aegis-collections.json" },
    { path: path.join(__dirname, `shield-mint-${cluster}.json`), label: `shield-mint-${cluster}.json` },
  ];
  for (const f of files) {
    check(f.label, fs.existsSync(f.path), fs.existsSync(f.path) ? "found" : "not yet created");
  }

  // ── Post-Deploy Checklist ─────────────────────────────────────────────
  console.log("\n▸ Post-Deploy Checklist");
  const hasAllocFile  = fs.existsSync(path.join(deploymentsDir, `allocations-${cluster}.json`));
  const hasCollection = fs.existsSync(path.join(deploymentsDir, "aegis-collections.json"));

  check("Token deployed on-chain",                   hasDeployment);
  check("Allocations distributed",                   hasAllocFile, hasAllocFile ? "done" : "run: npm run distribute");
  check("Mint authority revoked (fixed supply)",      false,        "run: ts-node revoke-mint-authority.ts");
  check("Aegis Tax collected at least once",          hasCollection);
  check("Bot .env synced (SHIELD_TOKEN_MINT set)",
    !!fs.existsSync(path.join(__dirname, "../../.env")) &&
    fs.readFileSync(path.join(__dirname, "../../.env"), "utf8").includes(deploy.mintAddress)
  );
  console.log();
}

main().catch(err => {
  console.error("Status check error:", err.message);
  process.exit(1);
});

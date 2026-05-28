/**
 * King's Shield — Token Metadata Setup
 * ======================================
 * Sets on-chain metadata for the SHIELD token so it displays correctly
 * across all Solana explorers, wallets, and DEXs.
 *
 * Two paths depending on how the mint was deployed:
 *   A) Token-2022 built-in: mint was deployed WITH MetadataPointer extension
 *      → uses tokenMetadataInitialize + tokenMetadataUpdateField (on-chain)
 *   B) No MetadataPointer: mint was deployed WITHOUT it (our current case)
 *      → saves metadata JSON + provides Jupiter token list submission steps
 *
 * Usage:
 *   ts-node setup-metadata.ts --cluster devnet
 *   ts-node setup-metadata.ts --cluster mainnet
 *   ts-node setup-metadata.ts --cluster mainnet --has-metadata-pointer
 */

import {
  Connection, Keypair, PublicKey,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getMint,
  getMetadataPointerState,
  getTokenMetadata,
  tokenMetadataInitialize,
  tokenMetadataUpdateField,
} from "@solana/spl-token";
import bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, ".env") });

// ── SHIELD Token Metadata ─────────────────────────────────────────────────
const SHIELD_NAME   = "King's Shield";
const SHIELD_SYMBOL = "SHIELD";
const SHIELD_URI    = "https://kenostod.com/token/shield-metadata.json";

const ADDITIONAL_FIELDS: [string, string][] = [
  ["description",   "King's Shield — Solana Token-2022 with 6.174% Aegis Tax. Part of The Sovereign Economy."],
  ["website",       "https://kenostod.com"],
  ["twitter",       "https://twitter.com/kenostod"],
  ["telegram",      "https://t.me/kenostodacademy"],
  ["aegis_tax",     "6.174% — 3% holder yield + 2% auto-liquidity + 1.174% KENO burn"],
  ["supply",        "6,174,000,000 SHIELD"],
  ["decimals",      "9"],
  ["chain",         "Solana"],
  ["keno_contract", "0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E"],
  ["kaprekar",      "6174"],
];

// ── Metadata JSON (host at SHIELD_URI above) ──────────────────────────────
const METADATA_JSON = {
  name:        SHIELD_NAME,
  symbol:      SHIELD_SYMBOL,
  description: "King's Shield — Solana Token-2022. Every transfer triggers 6.174% Aegis Tax: 3% to SHIELD holders, 2% to Raydium LP, 1.174% bridges to BSC and burns KENO. Part of The Sovereign Economy — financial infrastructure for 2.4 billion unbanked.",
  image:       "https://kenostod.com/token/shield-logo.png",
  external_url: "https://kenostod.com",
  attributes: [
    { trait_type: "Token Standard", value: "Token-2022" },
    { trait_type: "Chain",          value: "Solana" },
    { trait_type: "Aegis Tax",      value: "6.174%" },
    { trait_type: "Supply",         value: "6,174,000,000" },
    { trait_type: "Decimals",       value: "9" },
    { trait_type: "KENO Burn",      value: "1.174% per transfer" },
    { trait_type: "Kaprekar",       value: "6174" },
  ],
  properties: {
    category: "fungible",
    links: {
      website:  "https://kenostod.com",
      twitter:  "https://twitter.com/kenostod",
      telegram: "https://t.me/kenostodacademy",
    },
  },
};

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
  const cluster            = getCluster();
  const hasMetadataPointer = process.argv.includes("--has-metadata-pointer");
  const rpcUrl             = getRpcUrl(cluster);
  const connection         = new Connection(rpcUrl, "confirmed");
  const authority          = loadAuthority();

  const deployFile = path.join(__dirname, `../deployments/shield-${cluster}.json`);
  if (!fs.existsSync(deployFile)) {
    throw new Error(`No deployment found for cluster '${cluster}'. Deploy first.`);
  }
  const deploy     = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  const mintPubkey = new PublicKey(deploy.mintAddress);

  console.log("\n════════════════════════════════════════════════════");
  console.log("  ⚔️  King's Shield — Token Metadata Setup");
  console.log(`  Cluster: ${cluster.toUpperCase()}`);
  console.log(`  Mint:    ${deploy.mintAddress}`);
  console.log("════════════════════════════════════════════════════\n");

  // ── Step 1: Always generate the metadata JSON file ────────────────────
  const deploymentsDir = path.join(__dirname, "../deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const metaJsonPath = path.join(deploymentsDir, "shield-metadata.json");
  fs.writeFileSync(metaJsonPath, JSON.stringify(METADATA_JSON, null, 2));
  console.log("  ✅ Metadata JSON saved to kings-shield/deployments/shield-metadata.json");
  console.log(`  ⚠️  Host this at: ${SHIELD_URI}\n`);

  // ── Step 2: Check if MetadataPointer is present on the mint ─────────
  let hasPointer = false;
  try {
    const mintInfo = await getMint(connection, mintPubkey, "confirmed", TOKEN_2022_PROGRAM_ID);
    const pointerState = getMetadataPointerState(mintInfo);
    hasPointer = !!(pointerState && pointerState.metadataAddress);
    if (hasPointer) {
      console.log(`  ✅ MetadataPointer found: ${pointerState!.metadataAddress!.toBase58()}`);
    } else {
      console.log("  ℹ️  No MetadataPointer on this mint — using alternative paths");
    }
  } catch (err: any) {
    console.log(`  ℹ️  Could not read mint: ${err.message}`);
  }

  // ── Step 3A: Token-2022 built-in metadata (if MetadataPointer present) ─
  if (hasPointer || hasMetadataPointer) {
    console.log("\n  Initializing Token-2022 built-in metadata...");
    try {
      const sig = await tokenMetadataInitialize(
        connection,
        authority,
        mintPubkey,
        authority.publicKey,
        authority.publicKey,
        SHIELD_NAME,
        SHIELD_SYMBOL,
        SHIELD_URI,
        [authority],
        { commitment: "confirmed" }
      );
      console.log(`  ✅ Metadata initialized — Tx: ${sig}`);

      for (const [field, value] of ADDITIONAL_FIELDS) {
        console.log(`  Setting ${field}...`);
        const updateSig = await tokenMetadataUpdateField(
          connection,
          authority,
          mintPubkey,
          authority.publicKey,
          field,
          value,
          [authority],
          { commitment: "confirmed" }
        );
        console.log(`  ✅ ${field} set — Tx: ${updateSig}`);
      }

      deploy.metadataSetAt   = new Date().toISOString();
      deploy.metadataUri     = SHIELD_URI;
      deploy.metadataOnChain = true;
      fs.writeFileSync(deployFile, JSON.stringify(deploy, null, 2));

      console.log("\n════════════════════════════════════════════════════");
      console.log("  METADATA SET — Token-2022 built-in");
      console.log(`  Name  : ${SHIELD_NAME}`);
      console.log(`  Symbol: ${SHIELD_SYMBOL}`);
      console.log(`  URI   : ${SHIELD_URI}`);
      console.log("════════════════════════════════════════════════════\n");
      return;
    } catch (err: any) {
      console.log(`  ⚠️  Token-2022 metadata init failed: ${err.message}`);
    }
  }

  // ── Step 3B: No MetadataPointer — use off-chain / submission paths ────
  console.log("\n  ─── Metadata Submission Options ──────────────────────");
  console.log(`\n  Your mint: ${deploy.mintAddress}\n`);

  console.log("  Option 1 — Jupiter Token List (recommended, fastest DEX display):");
  console.log("  Submit a PR to: https://github.com/jup-ag/token-list");
  console.log("  Required fields:");
  console.log(`    address : ${deploy.mintAddress}`);
  console.log(`    chainId : 101 (Solana mainnet)`);
  console.log(`    decimals: 9`);
  console.log(`    name    : ${SHIELD_NAME}`);
  console.log(`    symbol  : ${SHIELD_SYMBOL}`);
  console.log(`    logoURI : https://kenostod.com/token/shield-logo.png`);

  console.log("\n  Option 2 — Solscan manual token info:");
  console.log(`  https://solscan.io/token/${deploy.mintAddress}`);
  console.log("  Click 'Update Token Info' and submit name/symbol/logo\n");

  console.log("  Option 3 — Redeploy with MetadataPointer extension:");
  console.log("  The cleanest long-term approach is to deploy a fresh mint with");
  console.log("  MetadataPointer + TokenMetadata extensions from the start.");
  console.log("  This embeds name/symbol/uri directly in the mint account.\n");

  console.log("  Option 4 — Metaplex Token Metadata (most widely supported):");
  console.log("  npm install @metaplex-foundation/umi @metaplex-foundation/mpl-token-metadata");
  console.log("  Then use Metaplex to create a metadata PDA for the mint.\n");

  console.log("  Your metadata JSON is ready at:");
  console.log(`  kings-shield/deployments/shield-metadata.json`);
  console.log(`  Host it at: ${SHIELD_URI}\n`);
}

main().catch(err => {
  console.error("Metadata setup error:", err.message);
  process.exit(1);
});

/**
 * King's Shield (SHIELD) — Token-2022 Deployment
 * ================================================
 * Deploys SHIELD on Solana using the Token-2022 program with:
 *   • TransferFeeConfig  — 3% Aegis Tax on every transfer (no cap)
 *   • InterestBearingMint — 6.174% annual interest (Kaprekar-themed)
 *
 * Supply: 6,174,000,000 SHIELD (Kaprekar's Constant × 1,000,000)
 * Decimals: 9
 *
 * Usage:
 *   ts-node deploy-shield.ts --cluster devnet    (test first)
 *   ts-node deploy-shield.ts --cluster mainnet   (go live)
 *
 * Prerequisites:
 *   1. Set SHIELD_MINT_AUTHORITY_PRIVKEY in .env
 *   2. Fund the authority wallet with ≥ 0.1 SOL for rent + fees
 */

import {
  Connection,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializeInterestBearingMintInstruction,
  getMintLen,
  mintTo,
  createAssociatedTokenAccountIdempotent,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import * as bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, ".env") });

// ── Constants — All numbers rooted in 6174 (Kaprekar's Constant) ──────────
const TOKEN_NAME        = "King's Shield";
const TOKEN_SYMBOL      = "SHIELD";
const DECIMALS          = 9;
const TOTAL_SUPPLY      = 6_174_000_000n;                         // 6.174B SHIELD
const TOTAL_SUPPLY_RAW  = TOTAL_SUPPLY * BigInt(10 ** DECIMALS);  // in base units

// Aegis Tax: 3% = 300 basis points, no cap (u64 max)
const TRANSFER_FEE_BPS  = 300;
const MAXIMUM_FEE       = BigInt("18446744073709551615");  // u64::MAX = no cap

// Interest: 6.174% annual = 617 basis points
// (Token-2022 interest is stored as i16 in basis points, signed)
const INTEREST_RATE_BPS = 617;

// Kaprekar Allocations
const ALLOCATIONS = {
  liquidityPresale:   { pct: 40n, label: "Initial Liquidity & Presale" },
  academyTreasury:    { pct: 20n, label: "Kenostod Academy Treasury" },
  marketing:          { pct: 15n, label: "Marketing & Global Expansion" },
  ecosystem:          { pct: 15n, label: "Ecosystem Rewards & Grants" },
  coreTeam:           { pct: 10n, label: "Core Team (Locked 617.4 days)" },
};

// Bridge tax: 1.174% of each transfer goes toward KENO burn
// (Implemented off-chain: withheld authority splits collected fees)
const BRIDGE_TAX_FRACTION = 1.174 / 3.0; // 1.174% out of the 3% total fee

// ── Helpers ───────────────────────────────────────────────────────────────
function getCluster(): string {
  const arg = process.argv.find(a => a.startsWith("--cluster=") || a === "--cluster");
  if (arg === "--cluster") {
    const idx = process.argv.indexOf("--cluster");
    return process.argv[idx + 1] || "devnet";
  }
  return arg?.split("=")[1] || "devnet";
}

function getRpcUrl(cluster: string): string {
  if (cluster === "mainnet") return "https://api.mainnet-beta.solana.com";
  if (cluster === "devnet")  return "https://api.devnet.solana.com";
  return cluster;
}

function loadAuthority(): Keypair {
  // Try keypair file first (for devnet testing)
  const keypairFile = path.join(__dirname, "shield-mint-keypair.json");
  if (fs.existsSync(keypairFile)) {
    const arr = JSON.parse(fs.readFileSync(keypairFile, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(arr));
  }
  // Fall back to env var
  const privKey = process.env.SHIELD_MINT_AUTHORITY_PRIVKEY?.trim();
  if (!privKey) throw new Error("No authority keypair found. Run: node generate-wallet.js");
  return Keypair.fromSecretKey(bs58.decode(privKey));
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const cluster   = getCluster();
  const rpcUrl    = getRpcUrl(cluster);
  const connection = new Connection(rpcUrl, "confirmed");

  const authority = loadAuthority();
  const mintKeypair = Keypair.generate(); // new keypair for the mint account

  console.log("\n══════════════════════════════════════════════════");
  console.log("  King's Shield (SHIELD) — Token-2022 Deploy");
  console.log(`  Cluster:    ${cluster}`);
  console.log(`  Authority:  ${authority.publicKey.toBase58()}`);
  console.log(`  Mint:       ${mintKeypair.publicKey.toBase58()}`);
  console.log("══════════════════════════════════════════════════\n");

  // Check balance
  const balance = await connection.getBalance(authority.publicKey);
  console.log(`  Authority balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  if (cluster === "mainnet" && balance < 0.05 * LAMPORTS_PER_SOL) {
    throw new Error("Need at least 0.05 SOL in authority wallet for deployment.");
  }
  if (cluster === "devnet" && balance < 0.01 * LAMPORTS_PER_SOL) {
    console.log("  Low SOL — requesting devnet airdrop...");
    await connection.requestAirdrop(authority.publicKey, 2 * LAMPORTS_PER_SOL);
    await new Promise(r => setTimeout(r, 3000));
  }

  // ── Step 1: Calculate mint account size with extensions ─────────────────
  const extensions = [ExtensionType.TransferFeeConfig, ExtensionType.InterestBearingConfig];
  const mintLen    = getMintLen(extensions);
  const mintRent   = await connection.getMinimumBalanceForRentExemption(mintLen);

  console.log(`  Mint account size: ${mintLen} bytes`);
  console.log(`  Rent required:     ${mintRent / LAMPORTS_PER_SOL} SOL`);

  // ── Step 2: Build transaction with all extension initializations ─────────
  const tx = new Transaction().add(

    // Create the mint account with extra space for extensions
    SystemProgram.createAccount({
      fromPubkey:     authority.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space:          mintLen,
      lamports:       mintRent,
      programId:      TOKEN_2022_PROGRAM_ID,
    }),

    // Extension 1: TransferFeeConfig (Aegis Tax — 3%, no cap)
    createInitializeTransferFeeConfigInstruction(
      mintKeypair.publicKey,
      authority.publicKey,  // fee config authority (can update rate)
      authority.publicKey,  // withdraw withheld authority (collects fees)
      TRANSFER_FEE_BPS,
      MAXIMUM_FEE,
      TOKEN_2022_PROGRAM_ID
    ),

    // Extension 2: InterestBearingConfig (6.174% annual — Kaprekar)
    createInitializeInterestBearingMintInstruction(
      mintKeypair.publicKey,
      authority.publicKey,  // rate authority
      INTEREST_RATE_BPS,
      TOKEN_2022_PROGRAM_ID
    ),

    // Initialize the mint itself
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      DECIMALS,
      authority.publicKey,  // mint authority
      authority.publicKey,  // freeze authority
      TOKEN_2022_PROGRAM_ID
    )
  );

  console.log("\n  Sending mint creation transaction...");
  const sig = await sendAndConfirmTransaction(connection, tx, [authority, mintKeypair]);
  console.log(`  ✅ Mint created! Tx: ${sig}`);
  console.log(`  Mint address: ${mintKeypair.publicKey.toBase58()}`);

  // ── Step 3: Create authority's Associated Token Account & mint supply ────
  console.log("\n  Creating authority token account...");
  const authorityATA = await createAssociatedTokenAccountIdempotent(
    connection,
    authority,
    mintKeypair.publicKey,
    authority.publicKey,
    {},
    TOKEN_2022_PROGRAM_ID
  );
  console.log(`  Authority ATA: ${authorityATA.toBase58()}`);

  console.log(`\n  Minting ${TOTAL_SUPPLY.toLocaleString()} SHIELD to authority...`);
  const mintSig = await mintTo(
    connection,
    authority,
    mintKeypair.publicKey,
    authorityATA,
    authority,
    TOTAL_SUPPLY_RAW,
    [],
    {},
    TOKEN_2022_PROGRAM_ID
  );
  console.log(`  ✅ Total supply minted! Tx: ${mintSig}`);

  // ── Step 4: Save deployment record ──────────────────────────────────────
  const mintAddress = mintKeypair.publicKey.toBase58();
  const mintPrivKey = bs58.encode(mintKeypair.secretKey);

  const record = {
    tokenName:        TOKEN_NAME,
    symbol:           TOKEN_SYMBOL,
    cluster,
    mintAddress,
    authorityAddress: authority.publicKey.toBase58(),
    authorityATA:     authorityATA.toBase58(),
    decimals:         DECIMALS,
    totalSupply:      TOTAL_SUPPLY.toString(),
    totalSupplyRaw:   TOTAL_SUPPLY_RAW.toString(),
    extensions: {
      transferFee: {
        basisPoints: TRANSFER_FEE_BPS,
        maximumFee:  "u64::MAX (no cap)",
        aegisTaxPct: "3%",
        bridgeTaxPct: "1.174% (of 3%)",
      },
      interestBearing: {
        rateBps: INTEREST_RATE_BPS,
        annual:  "6.174% (Kaprekar-themed)",
      }
    },
    allocations: {
      liquidityPresale:  (TOTAL_SUPPLY * 40n / 100n).toString(),
      academyTreasury:   (TOTAL_SUPPLY * 20n / 100n).toString(),
      marketing:         (TOTAL_SUPPLY * 15n / 100n).toString(),
      ecosystem:         (TOTAL_SUPPLY * 15n / 100n).toString(),
      coreTeam:          (TOTAL_SUPPLY * 10n / 100n).toString(),
      coreTeamLockDays:  617.4,
    },
    deployTx:    sig,
    mintTx:      mintSig,
    deployedAt:  new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  const deployFile = path.join(deploymentsDir, `shield-${cluster}.json`);
  fs.writeFileSync(deployFile, JSON.stringify(record, null, 2));

  // Also save mint keypair for distribution step
  const mintKpFile = path.join(__dirname, `shield-mint-${cluster}.json`);
  fs.writeFileSync(mintKpFile, JSON.stringify(Array.from(mintKeypair.secretKey)));

  console.log(`\n  📄 Deployment record: kings-shield/deployments/shield-${cluster}.json`);

  // Print summary
  console.log("\n══════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log(`  Mint:         ${mintAddress}`);
  console.log(`  Total Supply: 6,174,000,000 SHIELD`);
  console.log(`  Aegis Tax:    3% on every transfer (no cap)`);
  console.log(`  Bridge Tax:   1.174% → Kenostod Bridge → KENO burn`);
  console.log(`  Interest:     6.174% annual (accruing)`);
  console.log("══════════════════════════════════════════════════");
  console.log("\n  Next: run distribute-allocations.ts to send tokens to wallets");
  console.log(`  Explorer: https://solscan.io/token/${mintAddress}${cluster === "devnet" ? "?cluster=devnet" : ""}\n`);

  if (cluster === "devnet") {
    console.log("  ✅ Devnet test successful — ready for mainnet when confirmed.");
  }
}

main().catch(err => { console.error("Deploy error:", err); process.exit(1); });

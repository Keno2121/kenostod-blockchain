/**
 * Generate Solana Wallet for King's Shield
 * =========================================
 * Creates a new keypair that will serve as:
 *   - Mint Authority    (can mint SHIELD tokens)
 *   - Freeze Authority  (can freeze accounts)
 *   - Fee Authority     (can update Aegis Tax rate)
 *   - Withheld Authority (collects Aegis Tax from transfers)
 *
 * Run: node generate-wallet.js
 * SAVE THE OUTPUT SECURELY — this is your SHIELD mint authority.
 */

const { Keypair } = require("@solana/web3.js");
const bs58 = require("bs58");
const fs   = require("fs");
const path = require("path");

function generate() {
  const keypair  = Keypair.generate();
  const pubkey   = keypair.publicKey.toBase58();
  const privKey  = bs58.default.encode(keypair.secretKey);
  const keyArray = JSON.stringify(Array.from(keypair.secretKey));

  console.log("\n════════════════════════════════════════════════");
  console.log("  King's Shield — Solana Mint Authority Wallet");
  console.log("════════════════════════════════════════════════");
  console.log(`\n  Public Key:      ${pubkey}`);
  console.log(`\n  Private Key (base58):`);
  console.log(`  ${privKey}`);
  console.log(`\n  Secret Key Array (for Phantom/Solflare import):`);
  console.log(`  ${keyArray}`);
  console.log("\n  ⚠️  STORE THIS PRIVATELY — never share, never commit");
  console.log("  Store in a hardware wallet or B.U.K. card.");
  console.log("════════════════════════════════════════════════\n");

  // Save public key and env template (NO private key to disk)
  const envPath = path.join(__dirname, ".env");
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  if (!existing.includes("SHIELD_MINT_AUTHORITY_PUBKEY")) {
    const envLines = [
      `# King's Shield Token-2022 Config`,
      `SHIELD_MINT_AUTHORITY_PUBKEY=${pubkey}`,
      `SHIELD_MINT_AUTHORITY_PRIVKEY=   # paste your base58 private key here`,
      `SHIELD_MINT_ADDRESS=             # filled after deploy`,
      `SOLANA_CLUSTER=devnet            # devnet | mainnet-beta`,
      `KENOSTOD_BRIDGE_WALLET=          # Solana wallet that receives 1.174% bridge tax`,
      `SHIELD_TREASURY_WALLET=          # Kenostod Academy Treasury Solana wallet`,
      `KENO_AUTOBURN_BSC=               # KENOAutoBurn contract on BSC (filled after BSC deploy)`,
    ].join("\n");

    fs.writeFileSync(envPath, envLines);
    console.log("  .env template saved (private key NOT written — add manually)");
  }

  // Save keypair array to a local file for use with Solana CLI (optional)
  const keypairPath = path.join(__dirname, "shield-mint-keypair.json");
  fs.writeFileSync(keypairPath, keyArray);
  console.log(`  Keypair saved to: kings-shield/token22/shield-mint-keypair.json`);
  console.log("  (Add this file to .gitignore — never commit it)\n");

  // Auto-add to .gitignore
  const gitignorePath = path.join(__dirname, "../../.gitignore");
  const gitignore = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf8") : "";
  if (!gitignore.includes("shield-mint-keypair.json")) {
    fs.appendFileSync(gitignorePath, "\nkings-shield/token22/shield-mint-keypair.json\nkings-shield/token22/.env\n");
    console.log("  Added to .gitignore — keypair and .env are protected.");
  }
}

generate();

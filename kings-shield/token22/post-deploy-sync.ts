/**
 * King's Shield — Post-Deploy Sync
 * ==================================
 * After deploying SHIELD on Solana, this script:
 *   1. Reads the mint address from the deployment record
 *   2. Updates kings-shield/.env with SHIELD_TOKEN_MINT
 *   3. Updates kings-shield/token22/.env with SHIELD_MINT_ADDRESS
 *   4. Prints next steps
 *
 * Run immediately after a successful deploy:
 *   ts-node post-deploy-sync.ts --cluster devnet
 *   ts-node post-deploy-sync.ts --cluster mainnet
 */

import * as fs from "fs";
import * as path from "path";

function getCluster(): string {
  const idx = process.argv.indexOf("--cluster");
  return idx !== -1 ? process.argv[idx + 1] : "devnet";
}

function updateEnvFile(filePath: string, key: string, value: string): boolean {
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  .env not found at ${filePath} — skipping`);
    return false;
  }

  let content = fs.readFileSync(filePath, "utf8");
  const regex = new RegExp(`^${key}=.*$`, "m");

  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
    console.log(`  ✅ Updated ${key} in ${path.basename(path.dirname(filePath))}/.env`);
  } else {
    content += `\n${key}=${value}\n`;
    console.log(`  ✅ Added ${key} to ${path.basename(path.dirname(filePath))}/.env`);
  }

  fs.writeFileSync(filePath, content);
  return true;
}

async function main() {
  const cluster    = getCluster();
  const deployFile = path.join(__dirname, `../deployments/shield-${cluster}.json`);

  console.log("\n════════════════════════════════════════════════════");
  console.log("  ⚔️  King's Shield — Post-Deploy Environment Sync");
  console.log(`  Cluster: ${cluster.toUpperCase()}`);
  console.log("════════════════════════════════════════════════════\n");

  if (!fs.existsSync(deployFile)) {
    console.error(`  ❌ No deployment found: ${deployFile}`);
    console.error(`  Deploy first: npm run deploy:${cluster === "mainnet" ? "mainnet" : "devnet"}`);
    process.exit(1);
  }

  const deploy     = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  const mintAddress = deploy.mintAddress;

  console.log(`  Mint address: ${mintAddress}`);
  console.log(`  Deployed at : ${deploy.deployedAt}`);
  console.log("");

  // Update token22/.env
  const token22Env = path.join(__dirname, ".env");
  updateEnvFile(token22Env, "SHIELD_MINT_ADDRESS", mintAddress);
  updateEnvFile(token22Env, "SOLANA_CLUSTER", cluster);

  // Update bot .env (kings-shield root)
  const botEnv = path.join(__dirname, "../.env");
  updateEnvFile(botEnv, "SHIELD_TOKEN_MINT", mintAddress);

  // Update the shared server .env if it exists
  const serverEnv = path.join(__dirname, "../../.env");
  if (fs.existsSync(serverEnv)) {
    updateEnvFile(serverEnv, "SHIELD_TOKEN_MINT", mintAddress);
  }

  console.log("\n  Sync complete. SHIELD_TOKEN_MINT is now set in all .env files.");
  console.log("  Both Aegis Arb Bot and Constitution Flash Bot will automatically");
  console.log("  activate SHIELD/SOL arb routes on next restart.\n");

  // Print next steps
  const isMainnet = cluster === "mainnet";
  console.log("  ─── Next Steps ──────────────────────────────────────");
  if (!isMainnet) {
    console.log("  1. Test the deployment:");
    console.log("     ts-node check-status.ts --cluster devnet");
    console.log("  2. Distribute allocations:");
    console.log("     npm run distribute -- --cluster devnet");
    console.log("  3. Test Aegis Tax collection:");
    console.log("     ts-node collect-aegis-tax.ts --cluster devnet");
    console.log("  4. When ready → deploy to mainnet:");
    console.log("     npm run deploy:mainnet");
    console.log("  5. Run this sync again for mainnet:");
    console.log("     ts-node post-deploy-sync.ts --cluster mainnet");
  } else {
    console.log("  1. Verify mainnet deployment:");
    console.log("     ts-node check-status.ts --cluster mainnet");
    console.log(`     https://solscan.io/token/${mintAddress}`);
    console.log("  2. Distribute allocations:");
    console.log("     npm run distribute -- --cluster mainnet");
    console.log("  3. Revoke mint authority (proves fixed supply):");
    console.log("     ts-node revoke-mint-authority.ts --cluster mainnet --confirm");
    console.log("  4. Set up token metadata:");
    console.log("     ts-node setup-metadata.ts --cluster mainnet");
    console.log("  5. Restart bots — SHIELD arb routes now active:");
    console.log("     python aegis_arb_bot/aegis_arb_bot.py --status");
    console.log("     python constitution_flash_bot/constitution_flash_bot.py --status");
    console.log("  6. Set up Raydium SHIELD/SOL liquidity pool");
    console.log("     (Pair the 40% Liquidity & Presale allocation with SOL)");
  }
  console.log("  ─────────────────────────────────────────────────────\n");
}

main().catch(err => {
  console.error("Sync error:", err.message);
  process.exit(1);
});

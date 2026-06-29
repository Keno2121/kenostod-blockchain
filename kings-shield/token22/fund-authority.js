/**
 * Fund the SHIELD mint authority from the bot wallet
 */
const { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function main() {
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

  // Load bot wallet (has SOL)
  const privKeyRaw = process.env.SHIELD_BOT_PRIVATE_KEY?.trim();
  if (!privKeyRaw) throw new Error("SHIELD_BOT_PRIVATE_KEY not set in .env");

  let botKeypair;
  try {
    // Try base58 decode first
    botKeypair = Keypair.fromSecretKey(bs58.default ? bs58.default.decode(privKeyRaw) : bs58.decode(privKeyRaw));
  } catch {
    // Try array format
    botKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(privKeyRaw)));
  }

  const authorityPubkey = new PublicKey("FTjM3ocrUSC9mpHWNsMLEbwuCFryr8DxwdwbHtEiP4De");
  const sendLamports = Math.floor(0.07 * LAMPORTS_PER_SOL);

  const botBal = await connection.getBalance(botKeypair.publicKey);
  console.log(`Bot wallet:    ${botKeypair.publicKey.toBase58()}`);
  console.log(`Bot balance:   ${botBal / LAMPORTS_PER_SOL} SOL`);
  console.log(`Sending:       0.07 SOL → ${authorityPubkey.toBase58()}`);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: botKeypair.publicKey,
      toPubkey: authorityPubkey,
      lamports: sendLamports,
    })
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [botKeypair]);
  console.log(`✅ Funded! Tx: ${sig}`);

  const newBal = await connection.getBalance(authorityPubkey);
  console.log(`Authority balance now: ${newBal / LAMPORTS_PER_SOL} SOL`);
}

main().catch(err => { console.error("Error:", err.message); process.exit(1); });

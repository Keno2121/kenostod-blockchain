"""
King's Shield — Dedicated Bot Wallet Generator
================================================
Generates a fresh Solana wallet for the Shield bots and writes the .env file.

Law VII — The Founder's Seal:
  Generates the FOUNDER_SEAL hash that locks both bots to founder-only control.
  The seal is derived from a phrase you choose — not from the private key.

Usage:
  pip install -r requirements.txt
  python wallet_setup/generate_shield_wallet.py
"""

import os
import sys
import json
import hashlib
import secrets
import base58
import struct

# Try solders first (modern), fall back to manual generation
try:
    from solders.keypair import Keypair
    USE_SOLDERS = True
except ImportError:
    USE_SOLDERS = False

try:
    from nacl.signing import SigningKey
    USE_NACL = True
except ImportError:
    USE_NACL = False


def generate_keypair_bytes():
    seed = secrets.token_bytes(32)
    if USE_SOLDERS:
        kp = Keypair.from_seed(seed)
        privkey_bytes = bytes(kp)
        pubkey = str(kp.pubkey())
        privkey_b58 = base58.b58encode(privkey_bytes).decode()
        return pubkey, privkey_b58
    elif USE_NACL:
        sk = SigningKey(seed)
        vk = sk.verify_key
        privkey_bytes = bytes(sk) + bytes(vk)
        pubkey = base58.b58encode(bytes(vk)).decode()
        privkey_b58 = base58.b58encode(privkey_bytes).decode()
        return pubkey, privkey_b58
    else:
        privkey_b58 = base58.b58encode(seed + secrets.token_bytes(32)).decode()
        pubkey = "INSTALL_SOLDERS: pip install solders"
        return pubkey, privkey_b58


def generate_founder_seal(phrase: str) -> str:
    h = hashlib.sha256(phrase.encode()).hexdigest()
    seal = hashlib.sha256(h.encode() + b"KINGS_SHIELD_6174").hexdigest()
    return seal[:32]


def write_env(pubkey: str, privkey: str, seal: str, network: str = "devnet"):
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")

    existing = {}
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    existing[k] = v

    existing.update({
        "SHIELD_BOT_ADDRESS":   pubkey,
        "SHIELD_BOT_PRIVATE_KEY": privkey,
        "FOUNDER_SEAL":         seal,
        "SOLANA_NETWORK":       network,
        "SOLANA_RPC_DEVNET":    "https://api.devnet.solana.com",
        "SOLANA_RPC_MAINNET":   "https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY",
        "SOL_MINT":             "So11111111111111111111111111111111111111112",
        "USDC_MINT":            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "USDT_MINT":            "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        "SHIELD_TOKEN_MINT":    "",
        "MIN_PROFIT_USD":       "0.25",
        "MIN_PROFIT_SOL":       "0.002",
        "MIN_WALLET_BALANCE_SOL": "0.05",
        "FLASH_AMOUNT_SMALL":   "0.6174",
        "FLASH_AMOUNT_MEDIUM":  "1.234",
        "FLASH_AMOUNT_LARGE":   "6.174",
        "SCAN_INTERVAL_SECONDS": "61.74",
        "ARB_PROFIT_LOG":       "aegis_arb_bot/profit_log.json",
        "FLASH_PROFIT_LOG":     "constitution_flash_bot/flash_profit_log.json",
    })

    lines = ["# King's Shield Bot — Auto-generated .env\n"]
    for k, v in existing.items():
        lines.append(f"{k}={v}\n")

    with open(env_path, "w") as f:
        f.writelines(lines)

    return env_path


def main():
    print("\n⚔️  KING'S SHIELD — Wallet Generator")
    print("══════════════════════════════════════")

    print("\nStep 1 — Generating fresh Solana bot wallet...")
    pubkey, privkey = generate_keypair_bytes()

    print("\n" + "="*60)
    print("  BOT WALLET ADDRESS (public — safe to share):")
    print(f"  {pubkey}")
    print("\n  PRIVATE KEY (NEVER SHARE — SAVE OFFLINE NOW):")
    print(f"  {privkey}")
    print("="*60)

    print("\n⚠️  SAVE THE PRIVATE KEY ABOVE OFFLINE NOW.")
    print("   It will NOT be displayed again after you press Enter.")
    input("   Press Enter ONLY after you have saved it...")

    print("\nStep 2 — Generating Founder's Seal (Law VII)...")
    print("   This phrase locks both bots to your control only.")
    print("   Choose something memorable but unguessable.")
    print("   Example: 'sovereign-6174-my-name-2025'")
    print()
    phrase = input("   Enter your Founder's Seal phrase: ").strip()
    if not phrase:
        phrase = secrets.token_hex(16)
        print(f"   (No phrase entered — random seal: {phrase})")

    seal = generate_founder_seal(phrase)
    print(f"\n   ✅ Founder's Seal: {seal}")
    print("   Save this seal too — it's needed to operate the bots.")

    print("\nStep 3 — Writing .env file...")
    env_path = write_env(pubkey, privkey, seal)
    print(f"   ✅ Written to: {env_path}")

    print("\nStep 4 — Fund your bot wallet (devnet first — free):")
    print(f"\n   Devnet faucet: https://faucet.solana.com/")
    print(f"   Wallet to fund: {pubkey}")
    print("\n   Or via Solana CLI:")
    print(f"   solana airdrop 2 {pubkey} --url devnet")

    print("\n✅ Setup complete. Next steps:")
    print("   1. Fund the wallet (devnet first, 2 SOL)")
    print("   2. python aegis_arb_bot/aegis_arb_bot.py --status")
    print("   3. python aegis_arb_bot/aegis_arb_bot.py --run --dry")
    print("   4. python constitution_flash_bot/constitution_flash_bot.py --quote 0.6174")
    print()


if __name__ == "__main__":
    main()

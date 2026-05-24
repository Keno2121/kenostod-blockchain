#!/usr/bin/env python3
"""
KENO Arb Bots — Bot Wallet Generator
Run FIRST before anything else.
Creates a dedicated bot wallet and writes credentials to .env
"""

import os
import sys
import json
from pathlib import Path

try:
    from eth_account import Account
    from colorama import init, Fore, Style
    init(autoreset=True)
except ImportError:
    print("Missing dependencies. Run: pip install -r requirements.txt")
    sys.exit(1)

ROOT = Path(__file__).parent.parent
ENV_FILE = ROOT / ".env"

def print_banner():
    print(f"\n{Fore.YELLOW}{'='*60}")
    print(f"  KENO ARB BOTS — Wallet Generator")
    print(f"  Kenostod Blockchain Academy LLC")
    print(f"{'='*60}{Style.RESET_ALL}\n")

def generate_wallet():
    Account.enable_unaudited_hdwallet_features()
    account = Account.create()
    return account

def write_env(private_key: str, address: str):
    env_example = ROOT / ".env.example"
    if ENV_FILE.exists():
        with open(ENV_FILE, "r") as f:
            content = f.read()
    elif env_example.exists():
        with open(env_example, "r") as f:
            content = f.read()
    else:
        content = (
            "BOT_PRIVATE_KEY=\nBOT_ADDRESS=\nNETWORK=testnet\n"
            "MIN_SPREAD_PCT=0.6\nMIN_PROFIT_USD=0.25\n"
            "MAX_BNB_PER_TRADE=0.1\nMAX_GAS_GWEI=10\nFLASH_ORB_CONTRACT=\n"
        )

    lines = content.splitlines()
    new_lines = []
    pk_set = addr_set = False
    for line in lines:
        if line.startswith("BOT_PRIVATE_KEY="):
            new_lines.append(f"BOT_PRIVATE_KEY={private_key}")
            pk_set = True
        elif line.startswith("BOT_ADDRESS="):
            new_lines.append(f"BOT_ADDRESS={address}")
            addr_set = True
        else:
            new_lines.append(line)
    if not pk_set:
        new_lines.append(f"BOT_PRIVATE_KEY={private_key}")
    if not addr_set:
        new_lines.append(f"BOT_ADDRESS={address}")

    with open(ENV_FILE, "w") as f:
        f.write("\n".join(new_lines) + "\n")

def main():
    print_banner()

    if ENV_FILE.exists():
        from dotenv import dotenv_values
        existing = dotenv_values(ENV_FILE)
        if existing.get("BOT_PRIVATE_KEY") and existing["BOT_PRIVATE_KEY"] != "0x...":
            print(f"{Fore.YELLOW}⚠  A bot wallet already exists in .env")
            print(f"   Address: {existing.get('BOT_ADDRESS', 'unknown')}")
            resp = input(f"\n   Overwrite with a NEW wallet? (yes/no): ").strip().lower()
            if resp != "yes":
                print(f"\n{Fore.GREEN}✓  Keeping existing wallet. Done.{Style.RESET_ALL}\n")
                return

    print(f"{Fore.CYAN}Generating new bot wallet...{Style.RESET_ALL}")
    account = generate_wallet()
    private_key = account.key.hex()
    address = account.address

    write_env(private_key, address)

    print(f"\n{Fore.GREEN}✓  Wallet created successfully!{Style.RESET_ALL}")
    print(f"\n{Fore.WHITE}  Address:     {Fore.CYAN}{address}")
    print(f"{Fore.WHITE}  Private Key: {Fore.RED}[saved to .env — never share this]{Style.RESET_ALL}")
    print(f"\n{Fore.YELLOW}  NEXT STEPS:")
    print(f"  1. Fund this address with a small amount of BNB for gas")
    print(f"     (0.05 BNB = ~$30 — enough to run for weeks)")
    print(f"  2. Start on testnet first: set NETWORK=testnet in .env")
    print(f"  3. Run: python live_arb_bot/live_arb_bot.py --status")
    print(f"  4. When ready for mainnet: set NETWORK=mainnet in .env")
    print(f"\n{Fore.RED}  ⚠  SECURITY: .env is in .gitignore — NEVER commit it to GitHub{Style.RESET_ALL}\n")

if __name__ == "__main__":
    main()

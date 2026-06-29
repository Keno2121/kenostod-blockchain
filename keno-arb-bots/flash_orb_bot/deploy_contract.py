#!/usr/bin/env python3
"""
FlashOrbBot Contract Deployer
Kenostod Blockchain Academy LLC

Compiles and deploys FlashOrbBot.sol to BSC mainnet or testnet.
Saves the deployed contract address to .env automatically.

Usage:
  python flash_orb_bot/deploy_contract.py --testnet
  python flash_orb_bot/deploy_contract.py --mainnet
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path

try:
    from web3 import Web3
    from web3.middleware import geth_poa_middleware
    from eth_account import Account
    from dotenv import load_dotenv
    from colorama import init, Fore, Style
    init(autoreset=True)
except ImportError:
    print("Missing dependencies. Run: pip install -r requirements.txt")
    sys.exit(1)

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

BOT_PRIVATE_KEY = os.getenv("BOT_PRIVATE_KEY", "")
NETWORK = os.getenv("NETWORK", "testnet")

RPC = {
    "mainnet": "https://bsc-dataseed1.binance.org/",
    "testnet": "https://data-seed-prebsc-1-s1.binance.org:8545/"
}

def log(msg, color=Fore.WHITE):
    print(f"{color}{msg}{Style.RESET_ALL}")

def compile_contract():
    """Compile the Solidity contract using solcx."""
    try:
        from solcx import compile_source, install_solc, get_installed_solc_versions
        versions = get_installed_solc_versions()
        if not any(str(v).startswith("0.8") for v in versions):
            log("Installing Solidity compiler 0.8.19...", Fore.YELLOW)
            install_solc("0.8.19")

        sol_path = ROOT / "contracts" / "FlashOrbBot.sol"
        if not sol_path.exists():
            log(f"Contract not found: {sol_path}", Fore.RED)
            sys.exit(1)

        with open(sol_path) as f:
            source = f.read()

        log("Compiling FlashOrbBot.sol...", Fore.CYAN)
        compiled = compile_source(
            source,
            output_values=["abi", "bin"],
            solc_version="0.8.19",
            optimize=True,
            optimize_runs=200
        )

        key = "<stdin>:FlashOrbBot"
        abi = compiled[key]["abi"]
        bytecode = compiled[key]["bin"]

        # Save ABI
        abi_dir = ROOT / "abi"
        abi_dir.mkdir(exist_ok=True)
        with open(abi_dir / "FlashOrbBot.json", "w") as f:
            json.dump(abi, f, indent=2)

        log("✓ Compiled successfully. ABI saved to abi/FlashOrbBot.json", Fore.GREEN)
        return abi, bytecode

    except ImportError:
        log("py-solc-x not installed. Run: pip install py-solc-x", Fore.RED)
        sys.exit(1)
    except Exception as e:
        log(f"Compilation error: {e}", Fore.RED)
        sys.exit(1)

def deploy(network: str):
    if not BOT_PRIVATE_KEY or BOT_PRIVATE_KEY == "0x...":
        log("BOT_PRIVATE_KEY not set. Run wallet_setup/generate_bot_wallet.py first.", Fore.RED)
        sys.exit(1)

    w3 = Web3(Web3.HTTPProvider(RPC[network]))
    w3.middleware_onion.inject(geth_poa_middleware, layer=0)
    if not w3.is_connected():
        log(f"Cannot connect to {network}", Fore.RED)
        sys.exit(1)

    account = Account.from_key(BOT_PRIVATE_KEY)
    bnb_bal = w3.from_wei(w3.eth.get_balance(account.address), "ether")

    log(f"\nDeploying FlashOrbBot to BSC {network.upper()}", Fore.YELLOW)
    log(f"Deployer: {account.address}", Fore.CYAN)
    log(f"Balance:  {bnb_bal:.4f} BNB", Fore.CYAN)

    if bnb_bal < 0.01:
        log(f"⚠  Low balance — need at least 0.01 BNB for deployment gas", Fore.RED)
        sys.exit(1)

    abi, bytecode = compile_contract()

    contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    gas_price = w3.eth.gas_price

    log(f"\nEstimating gas...", Fore.WHITE)
    try:
        gas_est = contract.constructor().estimate_gas({"from": account.address})
        log(f"Gas estimate: {gas_est:,} @ {gas_price/1e9:.1f} Gwei = "
            f"{w3.from_wei(gas_est * gas_price, 'ether'):.6f} BNB", Fore.WHITE)
    except Exception as e:
        log(f"Gas estimate failed: {e}", Fore.YELLOW)
        gas_est = 2_000_000

    nonce = w3.eth.get_transaction_count(account.address)
    tx = contract.constructor().build_transaction({
        "from": account.address,
        "gas": int(gas_est * 1.2),
        "gasPrice": gas_price,
        "nonce": nonce,
    })

    log("Signing and sending transaction...", Fore.CYAN)
    signed = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
    log(f"Tx hash: {tx_hash.hex()}", Fore.WHITE)

    log("Waiting for confirmation...", Fore.YELLOW)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

    if receipt["status"] != 1:
        log("Deployment failed!", Fore.RED)
        sys.exit(1)

    contract_address = receipt["contractAddress"]
    log(f"\n✅ FlashOrbBot deployed!", Fore.GREEN)
    log(f"   Address: {Fore.CYAN}{contract_address}{Style.RESET_ALL}")

    # Save to .env
    env_path = ROOT / ".env"
    if env_path.exists():
        with open(env_path) as f:
            content = f.read()
        lines = content.splitlines()
        updated = []
        found = False
        for line in lines:
            if line.startswith("FLASH_ORB_CONTRACT="):
                updated.append(f"FLASH_ORB_CONTRACT={contract_address}")
                found = True
            else:
                updated.append(line)
        if not found:
            updated.append(f"FLASH_ORB_CONTRACT={contract_address}")
        with open(env_path, "w") as f:
            f.write("\n".join(updated) + "\n")
        log(f"   Saved to .env as FLASH_ORB_CONTRACT", Fore.GREEN)

    explorer = ("https://bscscan.com" if network == "mainnet"
                else "https://testnet.bscscan.com")
    log(f"   Explorer: {explorer}/address/{contract_address}", Fore.WHITE)
    log(f"\n   Next: python flash_orb_bot/flash_orb_bot.py --status", Fore.YELLOW)

def main():
    parser = argparse.ArgumentParser(description="Deploy FlashOrbBot to BSC")
    parser.add_argument("--testnet", action="store_true", help="Deploy to BSC testnet")
    parser.add_argument("--mainnet", action="store_true", help="Deploy to BSC mainnet")
    args = parser.parse_args()

    if args.mainnet:
        confirm = input(f"{Fore.RED}⚠  Deploy to BSC MAINNET? This uses real BNB. (yes/no): ")
        if confirm.strip().lower() != "yes":
            log("Aborted.", Fore.YELLOW)
            return
        deploy("mainnet")
    elif args.testnet:
        deploy("testnet")
    else:
        parser.print_help()

if __name__ == "__main__":
    main()

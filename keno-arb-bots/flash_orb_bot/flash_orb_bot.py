#!/usr/bin/env python3
"""
Flash Orb Bot — Zero-Capital Flash Loan Arbitrage
Kenostod Blockchain Academy LLC

Borrows WBNB via PancakeSwap V2 flash swaps, arbitrages across DEXes,
repays the loan in one atomic transaction. No capital required — only gas.
The FlashOrbBot.sol contract must be deployed first.

Usage:
  python flash_orb_bot.py --status
  python flash_orb_bot.py --quote 0.1
  python flash_orb_bot.py --execute 0.1 0
  python flash_orb_bot.py --run --borrow 0.1 --interval 30
"""

import os
import sys
import time
import json
import argparse
from pathlib import Path
from datetime import datetime

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

sys.path.insert(0, str(ROOT))
from telegram_notify import (notify_bot_started, notify_flash_arb,
                              notify_error, notify_daily_summary, get_chat_id_help)

# ─── CONFIG ───────────────────────────────────────────────────────────────────
NETWORK          = os.getenv("NETWORK", "testnet")
BOT_PRIVATE_KEY  = os.getenv("BOT_PRIVATE_KEY", "")
BOT_ADDRESS      = os.getenv("BOT_ADDRESS", "")
CONTRACT_ADDRESS = os.getenv("FLASH_ORB_CONTRACT", "")
MIN_PROFIT_USD   = float(os.getenv("MIN_PROFIT_USD", "0.25"))
MAX_GAS_GWEI     = int(os.getenv("MAX_GAS_GWEI", "10"))

BNB_PRICE_USD = 600.0  # approximate — bot uses this for profit filtering

RPC = {
    "mainnet": "https://bsc-dataseed1.binance.org/",
    "testnet": "https://data-seed-prebsc-1-s1.binance.org:8545/"
}

WBNB_KENO_PAIR = {
    "mainnet": "0x0000000000000000000000000000000000000000",  # update after pair creation
    "testnet": "0x0000000000000000000000000000000000000000",
}

def log(msg, color=Fore.WHITE):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"{Fore.WHITE}[{ts}]{Style.RESET_ALL} {color}{msg}{Style.RESET_ALL}")

def banner():
    net_color = Fore.GREEN if NETWORK == "mainnet" else Fore.YELLOW
    print(f"\n{Fore.YELLOW}{'='*60}")
    print(f"  Flash Orb Bot — Kenostod Blockchain Academy LLC")
    print(f"  Network: {net_color}{NETWORK.upper()}{Fore.YELLOW}  |  "
          f"Min Profit: ${MIN_PROFIT_USD}  |  Max Gas: {MAX_GAS_GWEI} Gwei")
    print(f"{'='*60}{Style.RESET_ALL}\n")

def connect():
    w3 = Web3(Web3.HTTPProvider(RPC[NETWORK]))
    w3.middleware_onion.inject(geth_poa_middleware, layer=0)
    if not w3.is_connected():
        log(f"Cannot connect to {NETWORK} RPC", Fore.RED)
        sys.exit(1)
    return w3

def load_abi():
    abi_path = ROOT / "abi" / "FlashOrbBot.json"
    if not abi_path.exists():
        log("ABI not found — deploy the contract first:", Fore.RED)
        log("  python flash_orb_bot/deploy_contract.py --testnet", Fore.YELLOW)
        sys.exit(1)
    with open(abi_path) as f:
        return json.load(f)

def get_contract(w3):
    if not CONTRACT_ADDRESS or CONTRACT_ADDRESS == "":
        log("FLASH_ORB_CONTRACT not set in .env", Fore.RED)
        log("Deploy first: python flash_orb_bot/deploy_contract.py --testnet", Fore.YELLOW)
        sys.exit(1)
    abi = load_abi()
    return w3.eth.contract(
        address=Web3.to_checksum_address(CONTRACT_ADDRESS),
        abi=abi
    )

def validate_config():
    if not BOT_PRIVATE_KEY or BOT_PRIVATE_KEY == "0x...":
        log("BOT_PRIVATE_KEY not set. Run wallet_setup/generate_bot_wallet.py first.", Fore.RED)
        sys.exit(1)

# ─── COMMANDS ─────────────────────────────────────────────────────────────────

def cmd_status(w3, contract, account):
    log("Flash Orb Bot Status", Fore.YELLOW)
    print()

    bnb_bal = w3.from_wei(w3.eth.get_balance(account.address), "ether")
    contract_bnb = w3.from_wei(w3.eth.get_balance(contract.address), "ether")
    gas_gwei = w3.eth.gas_price / 1e9

    try:
        total_profit = w3.from_wei(contract.functions.totalProfitWBNB().call(), "ether")
        total_execs  = contract.functions.totalExecutions().call()
        owner        = contract.functions.owner().call()
    except Exception as e:
        log(f"Contract read error: {e}", Fore.RED)
        total_profit = total_execs = 0
        owner = "unknown"

    print(f"  {'Network:':<22} {Fore.CYAN}{NETWORK.upper()}{Style.RESET_ALL}")
    print(f"  {'Contract:':<22} {Fore.CYAN}{contract.address}{Style.RESET_ALL}")
    print(f"  {'Owner:':<22} {owner}")
    print(f"  {'Bot Wallet:':<22} {Fore.CYAN}{account.address}{Style.RESET_ALL}")
    print(f"  {'Bot BNB Balance:':<22} {Fore.GREEN}{bnb_bal:.4f} BNB{Style.RESET_ALL}")
    print(f"  {'Contract Balance:':<22} {contract_bnb:.6f} BNB")
    print(f"  {'Gas Price:':<22} {gas_gwei:.1f} Gwei "
          f"({'OK' if gas_gwei <= MAX_GAS_GWEI else 'HIGH'})")
    print()
    print(f"  {'Total Executions:':<22} {total_execs}")
    print(f"  {'Total Profit:':<22} {total_profit:.6f} WBNB "
          f"(~${float(total_profit) * BNB_PRICE_USD:.2f})")
    print()
    gas_ok = gas_gwei <= MAX_GAS_GWEI
    bal_ok = bnb_bal >= 0.005
    print(f"  {'Ready to execute:':<22} {'✅ YES' if gas_ok and bal_ok else '⏳ NO'}")
    print()

def cmd_quote(w3, contract, borrow_bnb: float):
    log(f"Quoting flash arb for {borrow_bnb} WBNB...", Fore.CYAN)
    borrow_wei = Web3.to_wei(borrow_bnb, "ether")

    for direction in [0, 1]:
        try:
            profit_wei = contract.functions.quoteArb(borrow_wei, direction).call()
            profit_bnb = w3.from_wei(abs(profit_wei), "ether")
            profit_usd = float(profit_bnb) * BNB_PRICE_USD
            is_profit  = profit_wei > 0
            label = ["PC→BiSwap", "BiSwap→PC"][direction]
            color = Fore.GREEN if is_profit else Fore.RED
            sign  = "+" if is_profit else "-"
            log(f"  Direction {direction} ({label}): {color}{sign}{profit_bnb:.6f} WBNB "
                f"(~${profit_usd:.3f}){Style.RESET_ALL}", Fore.WHITE)
        except Exception as e:
            log(f"  Direction {direction}: quote failed ({e})", Fore.YELLOW)

def cmd_execute(w3, contract, account, borrow_bnb: float, direction: int):
    gas_gwei = w3.eth.gas_price / 1e9
    if gas_gwei > MAX_GAS_GWEI:
        log(f"Gas too high: {gas_gwei:.1f} > {MAX_GAS_GWEI} Gwei", Fore.RED)
        return False

    borrow_wei = Web3.to_wei(borrow_bnb, "ether")
    pair = WBNB_KENO_PAIR[NETWORK]

    if pair == "0x0000000000000000000000000000000000000000":
        log("WBNB/KENO pair address not set — update WBNB_KENO_PAIR in flash_orb_bot.py", Fore.RED)
        return False

    log(f"Executing flash arb: borrow {borrow_bnb} WBNB | direction {direction}", Fore.CYAN)

    try:
        nonce = w3.eth.get_transaction_count(account.address)
        tx = contract.functions.startFlashArb(
            Web3.to_checksum_address(pair),
            borrow_wei,
            direction
        ).build_transaction({
            "from": account.address,
            "gas": 500000,
            "gasPrice": w3.to_wei(gas_gwei, "gwei"),
            "nonce": nonce,
        })
        signed = account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        log(f"Sent: {tx_hash.hex()}", Fore.WHITE)

        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        if receipt["status"] == 1:
            log(f"✅ Flash arb executed! Gas used: {receipt['gasUsed']:,}", Fore.GREEN)
            return True
        else:
            log("Transaction reverted — trade was unprofitable (no loss)", Fore.YELLOW)
            return False

    except Exception as e:
        log(f"Execution error: {e}", Fore.RED)
        return False

def cmd_run(w3, contract, account, borrow_bnb: float, interval: int):
    log(f"Starting auto-scan (borrow: {borrow_bnb} WBNB | interval: {interval}s)", Fore.GREEN)
    log("Press Ctrl+C to stop\n", Fore.WHITE)
    notify_bot_started("Flash Orb Bot", NETWORK, account.address)

    executions = 0
    start_time = time.time()
    total_profit = 0.0
    last_summary = time.time()

    while True:
        try:
            gas_gwei = w3.eth.gas_price / 1e9
            borrow_wei = Web3.to_wei(borrow_bnb, "ether")

            best_profit = None
            best_dir = None

            for direction in [0, 1]:
                try:
                    profit_wei = contract.functions.quoteArb(borrow_wei, direction).call()
                    profit_usd = float(w3.from_wei(abs(profit_wei), "ether")) * BNB_PRICE_USD
                    if profit_wei > 0 and profit_usd > (best_profit or 0):
                        best_profit = profit_usd
                        best_dir = direction
                except Exception:
                    pass

            if best_profit is not None and best_profit >= MIN_PROFIT_USD and gas_gwei <= MAX_GAS_GWEI:
                log(f"🎯 Opportunity! Profit: ${best_profit:.3f} | Dir: {best_dir}", Fore.GREEN)
                success = cmd_execute(w3, contract, account, borrow_bnb, best_dir)
                if success:
                    executions += 1
                    profit_bnb = best_profit / BNB_PRICE_USD
                    total_profit += profit_bnb
                    notify_flash_arb(profit_bnb, best_dir, borrow_bnb, network=NETWORK)
            else:
                reasons = []
                if best_profit is None or best_profit < MIN_PROFIT_USD:
                    val = f"${best_profit:.3f}" if best_profit else "none"
                    reasons.append(f"profit {val} < ${MIN_PROFIT_USD}")
                if gas_gwei > MAX_GAS_GWEI:
                    reasons.append(f"gas {gas_gwei:.1f} > {MAX_GAS_GWEI} Gwei")
                log(f"Waiting — {', '.join(reasons)} | Execs: {executions}", Fore.WHITE)

            if time.time() - last_summary >= 86400:
                uptime = (time.time() - start_time) / 3600
                notify_daily_summary(executions, total_profit, uptime)
                last_summary = time.time()

            time.sleep(interval)

        except KeyboardInterrupt:
            uptime = (time.time() - start_time) / 3600
            notify_daily_summary(executions, total_profit, uptime)
            log(f"\nBot stopped. Total executions: {executions}", Fore.YELLOW)
            break
        except Exception as e:
            notify_error("Flash Orb Bot", str(e))
            log(f"Error: {e}", Fore.RED)
            time.sleep(30)

# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Flash Orb Bot — Zero-Capital Flash Arb")
    parser.add_argument("--status",  action="store_true", help="Show bot and contract status")
    parser.add_argument("--quote",   type=float, metavar="BNB", help="Quote profit for N WBNB")
    parser.add_argument("--execute", nargs=2, metavar=("BNB", "DIR"),
                        help="Execute one flash arb: --execute 0.1 0")
    parser.add_argument("--run",     action="store_true", help="Auto-scan and execute")
    parser.add_argument("--borrow",  type=float, default=0.1, help="WBNB to borrow per trade")
    parser.add_argument("--interval",type=int, default=30, help="Scan interval in seconds")
    args = parser.parse_args()

    banner()
    validate_config()

    w3 = connect()
    account = Account.from_key(BOT_PRIVATE_KEY)
    contract = get_contract(w3)

    log(f"Connected to {NETWORK} | Block #{w3.eth.block_number:,}", Fore.GREEN)
    log(f"Bot wallet:  {account.address}", Fore.CYAN)
    log(f"Contract:    {contract.address}", Fore.CYAN)

    if args.status:
        cmd_status(w3, contract, account)
    elif args.quote is not None:
        cmd_quote(w3, contract, args.quote)
    elif args.execute:
        borrow_bnb = float(args.execute[0])
        direction  = int(args.execute[1])
        cmd_execute(w3, contract, account, borrow_bnb, direction)
    elif args.run:
        cmd_run(w3, contract, account, args.borrow, args.interval)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()

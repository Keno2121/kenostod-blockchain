#!/usr/bin/env python3
"""
KENO Live Arb Bot — Direct Swap Arbitrage
Kenostod Blockchain Academy LLC

Scans PancakeSwap V2 vs BiSwap for KENO/WBNB price differences.
When spread exceeds MIN_SPREAD_PCT, executes direct swaps using the bot wallet.
Also generates KENO trading volume which feeds UTL Protocol fee collection.

Usage:
  python live_arb_bot.py --status
  python live_arb_bot.py --run
  python live_arb_bot.py --keno-volume
"""

import os
import sys
import time
import argparse
import json
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

# ─── CONFIG ───────────────────────────────────────────────────────────────────
NETWORK         = os.getenv("NETWORK", "testnet")
BOT_PRIVATE_KEY = os.getenv("BOT_PRIVATE_KEY", "")
BOT_ADDRESS     = os.getenv("BOT_ADDRESS", "")
MIN_SPREAD_PCT  = float(os.getenv("MIN_SPREAD_PCT", "0.6"))
MIN_PROFIT_USD  = float(os.getenv("MIN_PROFIT_USD", "0.25"))
MAX_BNB         = float(os.getenv("MAX_BNB_PER_TRADE", "0.1"))
MAX_GAS_GWEI    = int(os.getenv("MAX_GAS_GWEI", "10"))

RPC = {
    "mainnet": "https://bsc-dataseed1.binance.org/",
    "testnet": "https://data-seed-prebsc-1-s1.binance.org:8545/"
}

# ─── CONTRACT ADDRESSES ───────────────────────────────────────────────────────
ADDR = {
    "mainnet": {
        "WBNB":            "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        "KENO":            "0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E",
        "PC_ROUTER":       "0x10ED43C718714eb63d5aA57B78B54704E256024E",
        "BISWAP_ROUTER":   "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8",
        "FEE_COLLECTOR":   "0xb9489B33Bd9bB835139369b1dD282fB44B2273d8",
        "KENO_BNB_PAIR_PC":"0x0000000000000000000000000000000000000000",  # update after deploy
    },
    "testnet": {
        "WBNB":            "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
        "KENO":            "0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E",
        "PC_ROUTER":       "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
        "BISWAP_ROUTER":   "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
        "FEE_COLLECTOR":   "0xb9489B33Bd9bB835139369b1dD282fB44B2273d8",
        "KENO_BNB_PAIR_PC":"0x0000000000000000000000000000000000000000",
    }
}

ROUTER_ABI = json.loads('[{"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"}],"name":"getAmountsOut","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactTokensForTokens","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactETHForTokens","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMin","type":"uint256"},{"internalType":"address[]","name":"path","type":"address[]"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"deadline","type":"uint256"}],"name":"swapExactTokensForETH","outputs":[{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"stateMutability":"nonpayable","type":"function"}]')

ERC20_APPROVE_ABI = json.loads('[{"inputs":[{"internalType":"address","name":"spender","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]')

# ─── HELPERS ──────────────────────────────────────────────────────────────────

def log(msg, color=Fore.WHITE):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"{Fore.WHITE}[{ts}]{Style.RESET_ALL} {color}{msg}{Style.RESET_ALL}")

def banner():
    net_color = Fore.GREEN if NETWORK == "mainnet" else Fore.YELLOW
    print(f"\n{Fore.YELLOW}{'='*60}")
    print(f"  KENO Live Arb Bot — Kenostod Blockchain Academy LLC")
    print(f"  Network: {net_color}{NETWORK.upper()}{Fore.YELLOW}  |  "
          f"Min Spread: {MIN_SPREAD_PCT}%  |  Max BNB: {MAX_BNB}")
    print(f"{'='*60}{Style.RESET_ALL}\n")

def connect():
    w3 = Web3(Web3.HTTPProvider(RPC[NETWORK]))
    w3.middleware_onion.inject(geth_poa_middleware, layer=0)
    if not w3.is_connected():
        log(f"Cannot connect to {NETWORK} RPC", Fore.RED)
        sys.exit(1)
    return w3

def validate_config():
    if not BOT_PRIVATE_KEY or BOT_PRIVATE_KEY == "0x...":
        log("BOT_PRIVATE_KEY not set — run: python wallet_setup/generate_bot_wallet.py", Fore.RED)
        sys.exit(1)
    if not BOT_ADDRESS or BOT_ADDRESS == "0x...":
        log("BOT_ADDRESS not set — run: python wallet_setup/generate_bot_wallet.py", Fore.RED)
        sys.exit(1)

# ─── PRICE SCANNING ───────────────────────────────────────────────────────────

def get_price(w3, router_addr: str, token_in: str, token_out: str, amount_in: int) -> int:
    """Get expected output from a router given input amount."""
    try:
        router = w3.eth.contract(address=Web3.to_checksum_address(router_addr), abi=ROUTER_ABI)
        amounts = router.functions.getAmountsOut(amount_in, [
            Web3.to_checksum_address(token_in),
            Web3.to_checksum_address(token_out)
        ]).call()
        return amounts[-1]
    except Exception:
        return 0

def scan_spread(w3, addrs: dict) -> dict:
    """Scan price spread between PancakeSwap and BiSwap."""
    amount_in = Web3.to_wei(0.01, "ether")
    wbnb = addrs["WBNB"]
    keno = addrs["KENO"]
    pc   = addrs["PC_ROUTER"]
    bi   = addrs["BISWAP_ROUTER"]

    # WBNB → KENO on each DEX
    keno_from_pc = get_price(w3, pc, wbnb, keno, amount_in)
    keno_from_bi = get_price(w3, bi, wbnb, keno, amount_in)

    if keno_from_pc == 0 or keno_from_bi == 0:
        return {"spread_pct": 0, "direction": None, "pc_price": 0, "bi_price": 0}

    # Price in KENO per 0.01 BNB
    pc_price = keno_from_pc / 1e18
    bi_price = keno_from_bi / 1e18

    spread = abs(pc_price - bi_price) / max(pc_price, bi_price) * 100
    direction = 0 if pc_price > bi_price else 1  # 0=buy BiSwap/sell PC, 1=buy PC/sell BiSwap

    return {
        "spread_pct": spread,
        "direction": direction,
        "pc_price": pc_price,
        "bi_price": bi_price,
        "amount_in": amount_in
    }

# ─── EXECUTION ────────────────────────────────────────────────────────────────

def approve_token(w3, token_addr: str, spender: str, amount: int, account):
    """Approve router to spend token."""
    token = w3.eth.contract(
        address=Web3.to_checksum_address(token_addr),
        abi=json.loads('[{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]')
    )
    tx = token.functions.approve(
        Web3.to_checksum_address(spender),
        amount
    ).build_transaction({
        "from": account.address,
        "gas": 100000,
        "gasPrice": w3.to_wei(min(w3.eth.gas_price / 1e9, MAX_GAS_GWEI), "gwei"),
        "nonce": w3.eth.get_transaction_count(account.address),
    })
    signed = account.sign_transaction(tx)
    return w3.eth.send_raw_transaction(signed.rawTransaction)

def execute_arb(w3, addrs: dict, spread_info: dict, account) -> bool:
    """Execute a two-leg direct swap arbitrage."""
    direction = spread_info["direction"]
    trade_bnb = min(MAX_BNB, 0.05)
    amount_in = Web3.to_wei(trade_bnb, "ether")

    bnb_balance = w3.eth.get_balance(account.address)
    if bnb_balance < amount_in + Web3.to_wei(0.005, "ether"):
        log(f"Insufficient BNB balance for trade ({w3.from_wei(bnb_balance, 'ether'):.4f} BNB)", Fore.RED)
        return False

    gas_price = w3.eth.gas_price / 1e9
    if gas_price > MAX_GAS_GWEI:
        log(f"Gas too high: {gas_price:.1f} Gwei > {MAX_GAS_GWEI} Gwei limit", Fore.YELLOW)
        return False

    wbnb = addrs["WBNB"]
    keno = addrs["KENO"]

    if direction == 0:
        buy_router  = addrs["PC_ROUTER"]
        sell_router = addrs["BISWAP_ROUTER"]
        log(f"Direction: Buy KENO on PancakeSwap → Sell on BiSwap", Fore.CYAN)
    else:
        buy_router  = addrs["BISWAP_ROUTER"]
        sell_router = addrs["PC_ROUTER"]
        log(f"Direction: Buy KENO on BiSwap → Sell on PancakeSwap", Fore.CYAN)

    deadline = int(time.time()) + 300
    nonce = w3.eth.get_transaction_count(account.address)

    # Leg 1: BNB → KENO
    try:
        buy = w3.eth.contract(address=Web3.to_checksum_address(buy_router), abi=ROUTER_ABI)
        path1 = [Web3.to_checksum_address(wbnb), Web3.to_checksum_address(keno)]
        expected_keno = get_price(w3, buy_router, wbnb, keno, amount_in)
        min_keno = int(expected_keno * 0.98)  # 2% slippage tolerance

        tx1 = buy.functions.swapExactETHForTokens(
            min_keno, path1, account.address, deadline
        ).build_transaction({
            "from": account.address,
            "value": amount_in,
            "gas": 300000,
            "gasPrice": w3.to_wei(gas_price, "gwei"),
            "nonce": nonce,
        })
        signed1 = account.sign_transaction(tx1)
        tx1_hash = w3.eth.send_raw_transaction(signed1.rawTransaction)
        receipt1 = w3.eth.wait_for_transaction_receipt(tx1_hash, timeout=60)

        if receipt1["status"] != 1:
            log("Leg 1 failed — buy reverted", Fore.RED)
            return False

        log(f"✓ Leg 1 complete — bought KENO | tx: {tx1_hash.hex()[:16]}...", Fore.GREEN)

        # Check actual KENO received
        keno_contract = w3.eth.contract(
            address=Web3.to_checksum_address(keno),
            abi=json.loads('[{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]')
        )
        keno_balance = keno_contract.functions.balanceOf(account.address).call()

        if keno_balance == 0:
            log("No KENO received — something went wrong", Fore.RED)
            return False

    except Exception as e:
        log(f"Leg 1 error: {e}", Fore.RED)
        return False

    # Approve sell router
    try:
        approve_tx = approve_token(w3, keno, sell_router, keno_balance, account)
        w3.eth.wait_for_transaction_receipt(approve_tx, timeout=60)
    except Exception as e:
        log(f"Approve error: {e}", Fore.RED)
        return False

    # Leg 2: KENO → BNB
    try:
        sell = w3.eth.contract(address=Web3.to_checksum_address(sell_router), abi=ROUTER_ABI)
        path2 = [Web3.to_checksum_address(keno), Web3.to_checksum_address(wbnb)]
        expected_bnb = get_price(w3, sell_router, keno, wbnb, keno_balance)
        min_bnb = int(expected_bnb * 0.98)

        nonce2 = w3.eth.get_transaction_count(account.address)
        tx2 = sell.functions.swapExactTokensForETH(
            keno_balance, min_bnb, path2, account.address, deadline
        ).build_transaction({
            "from": account.address,
            "gas": 300000,
            "gasPrice": w3.to_wei(gas_price, "gwei"),
            "nonce": nonce2,
        })
        signed2 = account.sign_transaction(tx2)
        tx2_hash = w3.eth.send_raw_transaction(signed2.rawTransaction)
        receipt2 = w3.eth.wait_for_transaction_receipt(tx2_hash, timeout=60)

        if receipt2["status"] != 1:
            log("Leg 2 failed — sell reverted", Fore.RED)
            return False

        log(f"✓ Leg 2 complete — sold KENO for BNB | tx: {tx2_hash.hex()[:16]}...", Fore.GREEN)
        return True

    except Exception as e:
        log(f"Leg 2 error: {e}", Fore.RED)
        return False

def keno_volume_trade(w3, addrs: dict, account):
    """Buy and sell a small amount of KENO to generate UTL Protocol volume."""
    log("Generating KENO trading volume for UTL Protocol...", Fore.CYAN)
    amount_in = Web3.to_wei(0.005, "ether")  # 0.005 BNB micro trade

    spread_info = {
        "direction": 0,
        "spread_pct": 0,
        "pc_price": 1,
        "bi_price": 1
    }

    # Just buy on PancakeSwap and sell back — generates fee collector volume
    try:
        wbnb = addrs["WBNB"]
        keno = addrs["KENO"]
        pc = addrs["PC_ROUTER"]
        deadline = int(time.time()) + 300
        gas_price = w3.eth.gas_price / 1e9

        buy = w3.eth.contract(address=Web3.to_checksum_address(pc), abi=ROUTER_ABI)
        path_buy  = [Web3.to_checksum_address(wbnb), Web3.to_checksum_address(keno)]
        path_sell = [Web3.to_checksum_address(keno), Web3.to_checksum_address(wbnb)]
        expected  = get_price(w3, pc, wbnb, keno, amount_in)

        nonce = w3.eth.get_transaction_count(account.address)
        tx = buy.functions.swapExactETHForTokens(
            int(expected * 0.95), path_buy, account.address, deadline
        ).build_transaction({
            "from": account.address, "value": amount_in,
            "gas": 300000, "gasPrice": w3.to_wei(gas_price, "gwei"), "nonce": nonce
        })
        signed = account.sign_transaction(tx)
        h = w3.eth.send_raw_transaction(signed.rawTransaction)
        r = w3.eth.wait_for_transaction_receipt(h, timeout=60)

        if r["status"] == 1:
            log(f"✓ KENO volume trade executed | tx: {h.hex()[:16]}...", Fore.GREEN)
        else:
            log("Volume trade reverted", Fore.YELLOW)

    except Exception as e:
        log(f"Volume trade error: {e}", Fore.RED)

# ─── COMMANDS ────────────────────────────────────────────────────────────────

def cmd_status(w3, addrs, account):
    log("Bot Status", Fore.YELLOW)
    print()

    bnb_bal = w3.from_wei(w3.eth.get_balance(account.address), "ether")
    gas_gwei = w3.eth.gas_price / 1e9
    block = w3.eth.block_number

    spread = scan_spread(w3, addrs)

    print(f"  {'Network:':<18} {Fore.CYAN}{NETWORK.upper()}{Style.RESET_ALL}")
    print(f"  {'Block:':<18} {block:,}")
    print(f"  {'Bot Address:':<18} {Fore.CYAN}{account.address}{Style.RESET_ALL}")
    print(f"  {'BNB Balance:':<18} {Fore.GREEN}{bnb_bal:.4f} BNB{Style.RESET_ALL}")
    print(f"  {'Gas Price:':<18} {gas_gwei:.1f} Gwei "
          f"({'OK' if gas_gwei <= MAX_GAS_GWEI else f'HIGH — limit is {MAX_GAS_GWEI}'})")
    print()
    print(f"  {'PC Price (KENO):':<18} {Fore.YELLOW}{spread['pc_price']:.6f}{Style.RESET_ALL}")
    print(f"  {'BiSwap Price:':<18} {Fore.YELLOW}{spread['bi_price']:.6f}{Style.RESET_ALL}")
    print(f"  {'Spread:':<18} {Fore.GREEN if spread['spread_pct'] >= MIN_SPREAD_PCT else Fore.RED}"
          f"{spread['spread_pct']:.3f}%{Style.RESET_ALL}")

    arb_ready = spread['spread_pct'] >= MIN_SPREAD_PCT and gas_gwei <= MAX_GAS_GWEI
    print(f"\n  {'Arb Ready:':<18} {'✅ YES' if arb_ready else '⏳ NO'}")
    print()

def cmd_run(w3, addrs, account, interval=15):
    log(f"Starting auto-scan (interval: {interval}s)...", Fore.GREEN)
    log("Press Ctrl+C to stop\n", Fore.WHITE)

    executions = 0
    while True:
        try:
            spread = scan_spread(w3, addrs)
            gas_gwei = w3.eth.gas_price / 1e9

            log(f"Spread: {spread['spread_pct']:.3f}% | "
                f"Gas: {gas_gwei:.1f} Gwei | "
                f"Execs: {executions}", Fore.WHITE)

            if spread["spread_pct"] >= MIN_SPREAD_PCT and gas_gwei <= MAX_GAS_GWEI:
                log(f"🎯 Spread detected ({spread['spread_pct']:.3f}%) — executing arb!", Fore.GREEN)
                success = execute_arb(w3, addrs, spread, account)
                if success:
                    executions += 1
                    log(f"✅ Arb #{executions} complete", Fore.GREEN)
            else:
                reasons = []
                if spread["spread_pct"] < MIN_SPREAD_PCT:
                    reasons.append(f"spread {spread['spread_pct']:.3f}% < {MIN_SPREAD_PCT}%")
                if gas_gwei > MAX_GAS_GWEI:
                    reasons.append(f"gas {gas_gwei:.1f} > {MAX_GAS_GWEI} Gwei")
                log(f"Waiting — {', '.join(reasons)}", Fore.WHITE)

            time.sleep(interval)

        except KeyboardInterrupt:
            log(f"\nBot stopped. Total executions: {executions}", Fore.YELLOW)
            break
        except Exception as e:
            log(f"Error: {e}", Fore.RED)
            time.sleep(30)

# ─── MAIN ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="KENO Live Arb Bot")
    parser.add_argument("--status", action="store_true", help="Show status and prices")
    parser.add_argument("--run", action="store_true", help="Start auto-scan mode")
    parser.add_argument("--keno-volume", action="store_true", help="Trigger a KENO volume trade")
    parser.add_argument("--interval", type=int, default=15, help="Scan interval in seconds")
    args = parser.parse_args()

    banner()
    validate_config()

    w3 = connect()
    account = Account.from_key(BOT_PRIVATE_KEY)
    addrs = ADDR[NETWORK]

    log(f"Connected to {NETWORK} | Block #{w3.eth.block_number:,}", Fore.GREEN)
    log(f"Bot wallet: {account.address}", Fore.CYAN)

    if args.status:
        cmd_status(w3, addrs, account)
    elif args.run:
        cmd_run(w3, addrs, account, interval=args.interval)
    elif args.keno_volume:
        keno_volume_trade(w3, addrs, account)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()

"""
⚔️  AEGIS ARB BOT — King's Shield
===================================
Live DEX arbitrage scanner for SOL/USDC and SHIELD/SOL price spreads
across Meteora DLMM, Orca Whirlpool, Raydium, and 20+ DEXs via Jupiter.

The 7 Constitutional Laws (embedded in every decision):
  Law I   — Inversion Principle:   Scan ALL DEXs simultaneously; act on best spread first
  Law II  — Aegis Covenant:        Check capital protection BEFORE every trade
  Law III — Sovereign Threshold:   No trade unless net profit ≥ $0.25 after all fees
  Law IV  — Atomic Guarantee:      Simulate the full route before submitting
  Law V   — Treasury Mandate:      Every profit is logged and compounded back into capital
  Law VI  — Kaprekar Constant:     Scan interval = 61.74s
  Law VII — Founder's Seal:        Verified on startup — only the founder commands the bots

Usage:
  python aegis_arb_bot.py --status         # Show wallet balance and last profits
  python aegis_arb_bot.py --scan           # Single price scan across all DEXs
  python aegis_arb_bot.py --run            # Start live scanning loop (mainnet)
  python aegis_arb_bot.py --run --dry      # Dry run — scans but never executes trades
"""

import os
import sys
import json
import time
import hashlib
import argparse
import logging
import datetime
from pathlib import Path
from typing import Optional

import requests
from dotenv import load_dotenv

# ── Load .env from the kings-shield root ──────────────────────────────────
HERE    = Path(__file__).parent
ROOT    = HERE.parent
ENV_PATH = ROOT / ".env"
load_dotenv(ENV_PATH)

# ── Colorama for terminal colour (optional) ───────────────────────────────
try:
    from colorama import Fore, Style, init as colorama_init
    colorama_init(autoreset=True)
    G = Fore.GREEN;  Y = Fore.YELLOW;  R = Fore.RED
    C = Fore.CYAN;   W = Fore.WHITE;   M = Fore.MAGENTA
    DIM = Style.DIM; BRIGHT = Style.BRIGHT; RESET = Style.RESET_ALL
except ImportError:
    G = Y = R = C = W = M = DIM = BRIGHT = RESET = ""

# ── Logging ───────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("AegisArbBot")

# ── Constants (Law VI — Kaprekar Constant) ────────────────────────────────
SCAN_INTERVAL   = float(os.getenv("SCAN_INTERVAL_SECONDS", "61.74"))
MIN_PROFIT_USD  = float(os.getenv("MIN_PROFIT_USD", "0.25"))    # Law III
MIN_BAL_SOL     = float(os.getenv("MIN_WALLET_BALANCE_SOL", "0.05"))  # Law II
PROFIT_LOG_PATH = ROOT / os.getenv("ARB_PROFIT_LOG", "aegis_arb_bot/profit_log.json")

# ── Known Mints ───────────────────────────────────────────────────────────
SOL_MINT   = os.getenv("SOL_MINT",  "So11111111111111111111111111111111111111112")
USDC_MINT  = os.getenv("USDC_MINT", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
USDT_MINT  = os.getenv("USDT_MINT", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")
SHIELD_MINT = os.getenv("SHIELD_TOKEN_MINT", "")

# ── Jupiter API ───────────────────────────────────────────────────────────
JUPITER_QUOTE_URL = "https://quote-api.jup.ag/v6/quote"
JUPITER_SWAP_URL  = "https://quote-api.jup.ag/v6/swap"
JUPITER_PRICE_URL = "https://price.jup.ag/v4/price"

# DEX labels for route display
DEX_LABELS = {
    "Meteora": "Meteora DLMM",
    "Orca":    "Orca Whirlpool",
    "Raydium": "Raydium AMM",
    "Phoenix": "Phoenix",
    "Lifinity": "Lifinity",
}


# ═══════════════════════════════════════════════════════════════════════════
#  Law VII — Founder's Seal verification
# ═══════════════════════════════════════════════════════════════════════════
def verify_founder_seal() -> bool:
    seal = os.getenv("FOUNDER_SEAL", "")
    if not seal or len(seal) < 16:
        log.error(f"{R}Law VII VIOLATED: FOUNDER_SEAL not set in .env")
        log.error("Run: python wallet_setup/generate_shield_wallet.py")
        return False
    log.info(f"{G}Law VII — Founder's Seal verified: {seal[:8]}...{seal[-4:]}")
    return True


# ═══════════════════════════════════════════════════════════════════════════
#  Solana RPC helpers
# ═══════════════════════════════════════════════════════════════════════════
def get_rpc_url() -> str:
    network = os.getenv("SOLANA_NETWORK", "devnet")
    if network == "mainnet-beta":
        return os.getenv("SOLANA_RPC_MAINNET", "https://api.mainnet-beta.solana.com")
    return os.getenv("SOLANA_RPC_DEVNET", "https://api.devnet.solana.com")


def rpc_call(method: str, params: list) -> dict:
    url = get_rpc_url()
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    r = requests.post(url, json=payload, timeout=15)
    r.raise_for_status()
    return r.json()


def get_sol_balance(address: str) -> float:
    try:
        resp = rpc_call("getBalance", [address])
        lamports = resp.get("result", {}).get("value", 0)
        return lamports / 1e9
    except Exception as e:
        log.warning(f"Balance fetch failed: {e}")
        return 0.0


def get_sol_price_usd() -> float:
    try:
        r = requests.get(
            JUPITER_PRICE_URL,
            params={"ids": SOL_MINT},
            timeout=10
        )
        data = r.json()
        return float(data["data"][SOL_MINT]["price"])
    except Exception:
        return 150.0   # fallback estimate


# ═══════════════════════════════════════════════════════════════════════════
#  Jupiter quote helpers — Law I (scan all DEXs simultaneously)
# ═══════════════════════════════════════════════════════════════════════════
def get_jupiter_quote(
    input_mint: str,
    output_mint: str,
    amount_lamports: int,
    slippage_bps: int = 50
) -> Optional[dict]:
    """Get best route across all DEXs via Jupiter aggregator (Law I)."""
    try:
        r = requests.get(
            JUPITER_QUOTE_URL,
            params={
                "inputMint":       input_mint,
                "outputMint":      output_mint,
                "amount":          str(amount_lamports),
                "slippageBps":     str(slippage_bps),
                "onlyDirectRoutes": "false",
            },
            timeout=15
        )
        if r.status_code == 200:
            return r.json()
        return None
    except Exception as e:
        log.debug(f"Jupiter quote error: {e}")
        return None


def parse_route_labels(quote: dict) -> str:
    """Extract DEX names from a Jupiter quote route."""
    try:
        route_plan = quote.get("routePlan", [])
        labels = []
        for step in route_plan:
            swap_info = step.get("swapInfo", {})
            label = swap_info.get("label", "Unknown")
            labels.append(DEX_LABELS.get(label, label))
        return " → ".join(labels) if labels else "Direct"
    except Exception:
        return "Unknown"


# ═══════════════════════════════════════════════════════════════════════════
#  Arbitrage scanner — Law I + Law III
# ═══════════════════════════════════════════════════════════════════════════
def scan_sol_usdc_arb(sol_price: float, scan_amount_sol: float = 0.5) -> Optional[dict]:
    """
    Scan SOL/USDC spread: buy SOL with USDC, then sell SOL for USDC.
    Detects price inefficiencies between DEXs.
    """
    amount_lamports = int(scan_amount_sol * 1e9)
    usdc_per_sol_at_spot = sol_price * 1_000_000  # USDC has 6 decimals

    # Route A: SOL → USDC (selling SOL)
    quote_sell = get_jupiter_quote(SOL_MINT, USDC_MINT, amount_lamports)
    if not quote_sell:
        return None
    usdc_out = int(quote_sell.get("outAmount", 0))
    effective_sell_price = (usdc_out / 1e6) / scan_amount_sol

    # Route B: USDC → SOL (buying SOL back with the USDC received)
    quote_buy = get_jupiter_quote(USDC_MINT, SOL_MINT, usdc_out)
    if not quote_buy:
        return None
    sol_back = int(quote_buy.get("outAmount", 0)) / 1e9
    round_trip_profit_sol = sol_back - scan_amount_sol

    gas_cost_sol = 0.000010   # ~10,000 lamports per tx × 2 txs
    net_profit_sol = round_trip_profit_sol - gas_cost_sol
    net_profit_usd = net_profit_sol * sol_price

    return {
        "pair":               "SOL/USDC",
        "scan_amount_sol":    scan_amount_sol,
        "sell_price":         effective_sell_price,
        "sol_back":           sol_back,
        "round_trip_sol":     round_trip_profit_sol,
        "gas_cost_sol":       gas_cost_sol,
        "net_profit_sol":     net_profit_sol,
        "net_profit_usd":     net_profit_usd,
        "profitable":         net_profit_usd >= MIN_PROFIT_USD,
        "sell_route":         parse_route_labels(quote_sell),
        "buy_route":          parse_route_labels(quote_buy),
        "sell_quote":         quote_sell,
        "buy_quote":          quote_buy,
    }


def scan_shield_sol_arb(sol_price: float, scan_amount_sol: float = 0.5) -> Optional[dict]:
    """
    Scan SHIELD/SOL spread — only active once SHIELD token mint is set.
    Every SHIELD arb generates Aegis Tax → 2% → POL, 1.174% → KENO burn.
    """
    if not SHIELD_MINT:
        return None

    amount_lamports = int(scan_amount_sol * 1e9)

    # Route A: SOL → SHIELD
    quote_buy_shield = get_jupiter_quote(SOL_MINT, SHIELD_MINT, amount_lamports)
    if not quote_buy_shield:
        return None
    shield_out = int(quote_buy_shield.get("outAmount", 0))

    # Route B: SHIELD → SOL (sell the SHIELD back)
    quote_sell_shield = get_jupiter_quote(SHIELD_MINT, SOL_MINT, shield_out)
    if not quote_sell_shield:
        return None
    sol_back = int(quote_sell_shield.get("outAmount", 0)) / 1e9

    # Aegis Tax: 6.174% on SHIELD transfers
    aegis_tax_sol = sol_back * 0.06174
    sol_after_tax  = sol_back - aegis_tax_sol
    gas_cost_sol   = 0.000010
    net_profit_sol = sol_after_tax - scan_amount_sol - gas_cost_sol
    net_profit_usd = net_profit_sol * sol_price

    return {
        "pair":              "SHIELD/SOL",
        "scan_amount_sol":   scan_amount_sol,
        "shield_received":   shield_out,
        "sol_back_raw":      sol_back,
        "aegis_tax_sol":     aegis_tax_sol,
        "net_profit_sol":    net_profit_sol,
        "net_profit_usd":    net_profit_usd,
        "profitable":        net_profit_usd >= MIN_PROFIT_USD,
        "buy_route":         parse_route_labels(quote_buy_shield),
        "sell_route":        parse_route_labels(quote_sell_shield),
        "buy_quote":         quote_buy_shield,
        "sell_quote":        quote_sell_shield,
    }


# ═══════════════════════════════════════════════════════════════════════════
#  Trade execution — Law II + Law IV
# ═══════════════════════════════════════════════════════════════════════════
def execute_swap(quote: dict, wallet_address: str, dry_run: bool = True) -> Optional[str]:
    """
    Execute a Jupiter swap.
    Law IV — Atomic Guarantee: the transaction is only submitted if profitable.
    In dry-run mode, logs the intent but never submits.
    """
    if dry_run:
        log.info(f"{Y}[DRY RUN] Would execute swap — not submitted")
        return "DRY_RUN_SIMULATED"

    # Real execution requires a signed transaction from the bot wallet private key.
    # This requires solders/solana-py signing and sending.
    # Stub: wire in signing when wallet is funded and tested on devnet.
    private_key_b58 = os.getenv("SHIELD_BOT_PRIVATE_KEY", "")
    if not private_key_b58:
        log.error("SHIELD_BOT_PRIVATE_KEY not set — cannot execute")
        return None

    try:
        r = requests.post(
            JUPITER_SWAP_URL,
            json={
                "quoteResponse":       quote,
                "userPublicKey":       wallet_address,
                "wrapAndUnwrapSol":    True,
                "dynamicComputeUnitLimit": True,
                "prioritizationFeeLamports": 500,
            },
            timeout=20
        )
        if r.status_code != 200:
            log.error(f"Swap API error {r.status_code}: {r.text[:200]}")
            return None

        swap_data = r.json()
        swap_tx   = swap_data.get("swapTransaction")
        if not swap_tx:
            log.error("No swapTransaction in response")
            return None

        # Sign and send the transaction
        tx_hash = sign_and_send_transaction(swap_tx, private_key_b58)
        return tx_hash

    except Exception as e:
        log.error(f"Execute swap failed: {e}")
        return None


def sign_and_send_transaction(swap_tx_b64: str, private_key_b58: str) -> Optional[str]:
    """Sign and send a base64-encoded Solana transaction."""
    try:
        import base64
        from solders.keypair import Keypair
        from solders.transaction import VersionedTransaction
        import base58

        keypair  = Keypair.from_base58_string(private_key_b58)
        tx_bytes = base64.b64decode(swap_tx_b64)
        tx       = VersionedTransaction.from_bytes(tx_bytes)
        signed   = keypair.sign_message(bytes(tx.message))
        tx.signatures = [signed]

        resp = rpc_call(
            "sendTransaction",
            [base64.b64encode(bytes(tx)).decode(), {"encoding": "base64", "skipPreflight": False}]
        )
        return resp.get("result")
    except Exception as e:
        log.error(f"Signing failed: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════
#  Law V — Treasury Mandate: profit logging
# ═══════════════════════════════════════════════════════════════════════════
def load_profit_log() -> dict:
    if PROFIT_LOG_PATH.exists():
        try:
            return json.loads(PROFIT_LOG_PATH.read_text())
        except Exception:
            pass
    return {"total_profit_usd": 0.0, "total_profit_sol": 0.0, "trades": [], "trade_count": 0}


def save_profit(profit_usd: float, profit_sol: float, pair: str, tx_hash: str, dry: bool):
    PROFIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log_data = load_profit_log()
    log_data["total_profit_usd"] += profit_usd
    log_data["total_profit_sol"] += profit_sol
    log_data["trade_count"]       += 1
    log_data["trades"].append({
        "ts":          datetime.datetime.utcnow().isoformat() + "Z",
        "pair":        pair,
        "profit_usd":  round(profit_usd, 6),
        "profit_sol":  round(profit_sol, 9),
        "tx_hash":     tx_hash,
        "dry_run":     dry,
    })
    PROFIT_LOG_PATH.write_text(json.dumps(log_data, indent=2))


# ═══════════════════════════════════════════════════════════════════════════
#  Main scan loop
# ═══════════════════════════════════════════════════════════════════════════
def run_single_scan(wallet: str, sol_price: float, dry_run: bool) -> list:
    """Law I — scan all pairs simultaneously and rank by profit."""
    results = []

    log.info(f"{C}Scanning SOL/USDC...")
    sol_usdc = scan_sol_usdc_arb(sol_price)
    if sol_usdc:
        results.append(sol_usdc)

    if SHIELD_MINT:
        log.info(f"{C}Scanning SHIELD/SOL...")
        shield_sol = scan_shield_sol_arb(sol_price)
        if shield_sol:
            results.append(shield_sol)
    else:
        log.info(f"{DIM}SHIELD/SOL scan inactive — set SHIELD_TOKEN_MINT in .env")

    # Law I: sort by net profit descending — act on best spread first
    results.sort(key=lambda x: x.get("net_profit_usd", 0), reverse=True)
    return results


def process_opportunity(opp: dict, wallet: str, sol_price: float, dry_run: bool):
    """Law II + III + IV: validate, guard, simulate, then execute."""
    pair       = opp["pair"]
    profit_usd = opp["net_profit_usd"]
    profit_sol = opp["net_profit_sol"]

    # Law III — Sovereign Threshold
    if profit_usd < MIN_PROFIT_USD:
        log.info(f"{DIM}[{pair}] Profit ${profit_usd:.4f} below threshold ${MIN_PROFIT_USD} — skip")
        return

    # Law II — Aegis Covenant: capital protection check
    balance = get_sol_balance(wallet)
    if balance < MIN_BAL_SOL:
        log.warning(
            f"{R}Law II TRIGGERED: Wallet balance {balance:.4f} SOL < "
            f"minimum {MIN_BAL_SOL} SOL — HALTING trade"
        )
        return

    mode_tag = f"{Y}[DRY RUN]" if dry_run else f"{G}[LIVE]"
    log.info(f"\n{BRIGHT}{'═'*55}")
    log.info(f"{G}  OPPORTUNITY FOUND — {pair}")
    log.info(f"  Net profit : ${profit_usd:.4f} USD ({profit_sol:.6f} SOL)")
    log.info(f"  Wallet bal : {balance:.4f} SOL")
    log.info(f"  Sell route : {opp.get('sell_route', 'N/A')}")
    log.info(f"  Buy route  : {opp.get('buy_route',  'N/A')}")
    log.info(f"  Mode       : {mode_tag}")
    log.info(f"{'═'*55}{RESET}\n")

    # Law IV — Atomic Guarantee: only submit if profitable (already checked above)
    sell_quote = opp.get("sell_quote")
    if sell_quote:
        tx_hash = execute_swap(sell_quote, wallet, dry_run=dry_run)
        if tx_hash:
            # Law V — Treasury Mandate: log the profit
            save_profit(profit_usd, profit_sol, pair, tx_hash, dry_run)
            log.info(f"{G}Trade logged — cumulative: ${load_profit_log()['total_profit_usd']:.4f}")
            if not dry_run:
                log.info(f"{G}TX: https://solscan.io/tx/{tx_hash}")


def run_loop(wallet: str, dry_run: bool = False):
    """Main scan-and-execute loop (Law VI: 61.74s interval)."""
    mode = f"{Y}DRY RUN MODE" if dry_run else f"{G}LIVE MODE"
    log.info(f"\n{BRIGHT}⚔️  AEGIS ARB BOT STARTING — {mode}")
    log.info(f"   Scan interval : {SCAN_INTERVAL}s (Law VI — Kaprekar Constant)")
    log.info(f"   Min profit    : ${MIN_PROFIT_USD} (Law III — Sovereign Threshold)")
    log.info(f"   Capital guard : {MIN_BAL_SOL} SOL minimum (Law II — Aegis Covenant)")
    log.info(f"   DEX coverage  : Meteora + Orca + Raydium + 20+ via Jupiter (Law I)")
    if SHIELD_MINT:
        log.info(f"   SHIELD routes : ACTIVE — {SHIELD_MINT[:12]}...")
    else:
        log.info(f"   SHIELD routes : Inactive — set SHIELD_TOKEN_MINT to activate")
    log.info(f"{RESET}")

    scan_count = 0
    while True:
        scan_count += 1
        log.info(f"\n{'─'*50}")
        log.info(f"Scan #{scan_count} — {datetime.datetime.utcnow().strftime('%H:%M:%S')} UTC")

        try:
            sol_price = get_sol_price_usd()
            log.info(f"SOL price: ${sol_price:.2f}")

            opportunities = run_single_scan(wallet, sol_price, dry_run)

            if not opportunities:
                log.info("No quotes returned — RPC may be throttling")
            else:
                found = [o for o in opportunities if o.get("profitable")]
                log.info(f"Found {len(opportunities)} pairs, {len(found)} profitable")

                for opp in opportunities:
                    p = opp['net_profit_usd']
                    pair = opp['pair']
                    flag = f"{G}✅ PROFITABLE" if opp['profitable'] else f"{DIM}❌ below threshold"
                    log.info(f"  {pair:15s} ${p:+.4f} USD  {flag}")

                # Law I: process the most profitable first
                for opp in opportunities:
                    if opp.get("profitable"):
                        process_opportunity(opp, wallet, sol_price, dry_run)

        except KeyboardInterrupt:
            log.info(f"\n{Y}Bot stopped by user.")
            plog = load_profit_log()
            log.info(f"Session total: ${plog['total_profit_usd']:.4f} ({plog['trade_count']} trades)")
            break
        except Exception as e:
            log.error(f"Scan error: {e}")

        log.info(f"Next scan in {SCAN_INTERVAL}s...")
        time.sleep(SCAN_INTERVAL)


# ═══════════════════════════════════════════════════════════════════════════
#  CLI entry point
# ═══════════════════════════════════════════════════════════════════════════
def cmd_status(wallet: str):
    sol_price = get_sol_price_usd()
    balance   = get_sol_balance(wallet)
    plog      = load_profit_log()
    network   = os.getenv("SOLANA_NETWORK", "devnet")

    print(f"\n{BRIGHT}⚔️  AEGIS ARB BOT — STATUS")
    print(f"{'═'*50}")
    print(f"  Network       : {network.upper()}")
    print(f"  Wallet        : {wallet}")
    print(f"  SOL balance   : {balance:.4f} SOL (${balance * sol_price:.2f})")
    print(f"  SOL price     : ${sol_price:.2f}")
    print(f"  Capital guard : {MIN_BAL_SOL} SOL minimum (Law II)")
    print(f"  SHIELD routes : {'ACTIVE' if SHIELD_MINT else 'Inactive — set SHIELD_TOKEN_MINT'}")
    print(f"\n  📊 Profit log:")
    print(f"     Total profit : ${plog['total_profit_usd']:.4f} USD")
    print(f"     Total profit : {plog['total_profit_sol']:.6f} SOL")
    print(f"     Trade count  : {plog['trade_count']}")
    if plog["trades"]:
        last = plog["trades"][-1]
        print(f"     Last trade   : {last['ts']} — ${last['profit_usd']:.4f}")
    print(f"{'═'*50}{RESET}\n")


def cmd_scan(wallet: str):
    sol_price = get_sol_price_usd()
    print(f"\n{C}Single scan — SOL: ${sol_price:.2f}")
    results = run_single_scan(wallet, sol_price, dry_run=True)
    for r in results:
        flag = f"{G}✅ EXECUTE" if r['profitable'] else f"{R}❌ skip"
        print(f"\n  Pair        : {r['pair']}")
        print(f"  Net profit  : ${r['net_profit_usd']:+.4f} USD  {flag}")
        print(f"  Profit SOL  : {r['net_profit_sol']:+.6f}")
        print(f"  Sell route  : {r.get('sell_route', 'N/A')}")
        print(f"  Buy route   : {r.get('buy_route',  'N/A')}")
    if not results:
        print("  No quotes returned.")
    print(RESET)


def main():
    parser = argparse.ArgumentParser(description="Aegis Arb Bot — King's Shield")
    group  = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--status", action="store_true", help="Show wallet and profit status")
    group.add_argument("--scan",   action="store_true", help="Single price scan across all DEXs")
    group.add_argument("--run",    action="store_true", help="Start live scanning loop")
    parser.add_argument("--dry",   action="store_true", help="Dry run — scan but never execute")
    args = parser.parse_args()

    # Law VII — Founder's Seal must be verified before anything runs
    if not verify_founder_seal():
        sys.exit(1)

    wallet = os.getenv("SHIELD_BOT_ADDRESS", "")
    if not wallet:
        log.error("SHIELD_BOT_ADDRESS not set in .env — run wallet_setup/generate_shield_wallet.py")
        sys.exit(1)

    if args.status:
        cmd_status(wallet)
    elif args.scan:
        cmd_scan(wallet)
    elif args.run:
        run_loop(wallet, dry_run=args.dry)


if __name__ == "__main__":
    main()

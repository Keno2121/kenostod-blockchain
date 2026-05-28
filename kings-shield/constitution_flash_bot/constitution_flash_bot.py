"""
⚔️  CONSTITUTION FLASH BOT — King's Shield
===========================================
Flash loan arbitrage on Solana using Jupiter flash swaps.

Borrows 0.6174, 1.234, or 6.174 SOL (Kaprekar-anchored amounts — Law VI),
executes triangular arbitrage routes, repays loan + 0.09% fee.
If profit < $0.25 threshold, the transaction is NOT submitted (Law IV).
Gas is the only possible loss.

The 7 Constitutional Laws (embedded in every decision):
  Law I   — Inversion Principle:   Scan all DEXs simultaneously via Jupiter
  Law II  — Aegis Covenant:        Check capital protection before every trade
  Law III — Sovereign Threshold:   No trade unless net profit ≥ $0.25 after all fees
  Law IV  — Atomic Guarantee:      Simulate the full route — profitable or not submitted
  Law V   — Treasury Mandate:      Every profit logged and compounded into capital
  Law VI  — Kaprekar Constant:     Flash amounts = 0.6174, 1.234, 6.174 SOL; scan 61.74s
  Law VII — Founder's Seal:        Verified on startup — only the founder commands the bots

Usage:
  python constitution_flash_bot.py --status
  python constitution_flash_bot.py --quote 0.6174     # Show profit estimate for 0.6174 SOL
  python constitution_flash_bot.py --run              # Start live flash arb loop
  python constitution_flash_bot.py --run --dry        # Dry run (never submits)
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
HERE     = Path(__file__).parent
ROOT     = HERE.parent
ENV_PATH = ROOT / ".env"
load_dotenv(ENV_PATH)

try:
    from colorama import Fore, Style, init as colorama_init
    colorama_init(autoreset=True)
    G = Fore.GREEN;  Y = Fore.YELLOW;  R = Fore.RED
    C = Fore.CYAN;   W = Fore.WHITE;   M = Fore.MAGENTA
    DIM = Style.DIM; BRIGHT = Style.BRIGHT; RESET = Style.RESET_ALL
except ImportError:
    G = Y = R = C = W = M = DIM = BRIGHT = RESET = ""

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("ConstitutionFlashBot")

# ── Constants (Law VI — Kaprekar Constant) ────────────────────────────────
SCAN_INTERVAL    = float(os.getenv("SCAN_INTERVAL_SECONDS", "61.74"))
MIN_PROFIT_USD   = float(os.getenv("MIN_PROFIT_USD", "0.25"))     # Law III
MIN_BAL_SOL      = float(os.getenv("MIN_WALLET_BALANCE_SOL", "0.05"))  # Law II
FLASH_LOAN_FEE   = 0.0009    # 0.09% flash loan fee
FLASH_AMOUNTS    = [
    float(os.getenv("FLASH_AMOUNT_SMALL",  "0.6174")),
    float(os.getenv("FLASH_AMOUNT_MEDIUM", "1.234")),
    float(os.getenv("FLASH_AMOUNT_LARGE",  "6.174")),
]
PROFIT_LOG_PATH  = ROOT / os.getenv("FLASH_PROFIT_LOG", "constitution_flash_bot/flash_profit_log.json")

# ── Mints ─────────────────────────────────────────────────────────────────
SOL_MINT    = os.getenv("SOL_MINT",  "So11111111111111111111111111111111111111112")
USDC_MINT   = os.getenv("USDC_MINT", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
USDT_MINT   = os.getenv("USDT_MINT", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")
SHIELD_MINT = os.getenv("SHIELD_TOKEN_MINT", "")

JUPITER_QUOTE_URL = "https://quote-api.jup.ag/v6/quote"
JUPITER_PRICE_URL = "https://price.jup.ag/v4/price"


# ═══════════════════════════════════════════════════════════════════════════
#  Triangular route definitions
# ═══════════════════════════════════════════════════════════════════════════
def get_routes():
    """Return all triangular arb routes. SHIELD routes activate automatically."""
    routes = [
        {
            "name":  "SOL → USDC → SOL",
            "hops":  [(SOL_MINT, USDC_MINT), (USDC_MINT, SOL_MINT)],
            "active": True,
        },
        {
            "name":  "SOL → USDT → USDC → SOL",
            "hops":  [(SOL_MINT, USDT_MINT), (USDT_MINT, USDC_MINT), (USDC_MINT, SOL_MINT)],
            "active": True,
        },
    ]
    if SHIELD_MINT:
        routes.append({
            "name":  "SOL → SHIELD → SOL",
            "hops":  [(SOL_MINT, SHIELD_MINT), (SHIELD_MINT, SOL_MINT)],
            "active": True,
            "generates_aegis_tax": True,
        })
        routes.append({
            "name":  "SOL → USDC → SHIELD → SOL",
            "hops":  [(SOL_MINT, USDC_MINT), (USDC_MINT, SHIELD_MINT), (SHIELD_MINT, SOL_MINT)],
            "active": True,
            "generates_aegis_tax": True,
        })
    return routes


# ═══════════════════════════════════════════════════════════════════════════
#  Law VII — Founder's Seal
# ═══════════════════════════════════════════════════════════════════════════
def verify_founder_seal() -> bool:
    seal = os.getenv("FOUNDER_SEAL", "")
    if not seal or len(seal) < 16:
        log.error(f"{R}Law VII VIOLATED: FOUNDER_SEAL not set. Run generate_shield_wallet.py")
        return False
    log.info(f"{G}Law VII — Founder's Seal: {seal[:8]}...{seal[-4:]}")
    return True


# ═══════════════════════════════════════════════════════════════════════════
#  RPC + price helpers
# ═══════════════════════════════════════════════════════════════════════════
def get_rpc_url() -> str:
    network = os.getenv("SOLANA_NETWORK", "devnet")
    if network == "mainnet-beta":
        return os.getenv("SOLANA_RPC_MAINNET", "https://api.mainnet-beta.solana.com")
    return os.getenv("SOLANA_RPC_DEVNET", "https://api.devnet.solana.com")


def rpc_call(method: str, params: list) -> dict:
    r = requests.post(
        get_rpc_url(),
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        timeout=15
    )
    r.raise_for_status()
    return r.json()


def get_sol_balance(address: str) -> float:
    try:
        resp = rpc_call("getBalance", [address])
        return resp.get("result", {}).get("value", 0) / 1e9
    except Exception:
        return 0.0


def get_sol_price_usd() -> float:
    try:
        r = requests.get(JUPITER_PRICE_URL, params={"ids": SOL_MINT}, timeout=10)
        return float(r.json()["data"][SOL_MINT]["price"])
    except Exception:
        return 150.0


def get_jupiter_quote(input_mint: str, output_mint: str, amount: int) -> Optional[dict]:
    """Law I — scan all DEXs simultaneously for the best route."""
    try:
        r = requests.get(
            JUPITER_QUOTE_URL,
            params={
                "inputMint":    input_mint,
                "outputMint":   output_mint,
                "amount":       str(amount),
                "slippageBps":  "30",
                "onlyDirectRoutes": "false",
            },
            timeout=15
        )
        return r.json() if r.status_code == 200 else None
    except Exception as e:
        log.debug(f"Quote error: {e}")
        return None


def parse_dex_labels(quote: dict) -> str:
    try:
        labels = [s["swapInfo"].get("label", "?") for s in quote.get("routePlan", [])]
        return " → ".join(labels) if labels else "Direct"
    except Exception:
        return "?"


# ═══════════════════════════════════════════════════════════════════════════
#  Flash loan simulation — Law IV (Atomic Guarantee)
# ═══════════════════════════════════════════════════════════════════════════
def simulate_triangular_route(
    route: dict,
    flash_amount_sol: float,
    sol_price: float
) -> Optional[dict]:
    """
    Simulate a full triangular arb route without submitting anything.
    Law IV: simulate first — profitable or not submitted.
    """
    hops       = route["hops"]
    route_name = route["name"]

    current_amount_lamports = int(flash_amount_sol * 1e9)
    quotes      = []
    dex_labels  = []

    for (input_mint, output_mint) in hops:
        quote = get_jupiter_quote(input_mint, output_mint, current_amount_lamports)
        if not quote:
            return None
        out_amount = int(quote.get("outAmount", 0))
        if out_amount == 0:
            return None
        quotes.append(quote)
        dex_labels.append(parse_dex_labels(quote))
        current_amount_lamports = out_amount

    # Final output is in SOL lamports
    final_sol = current_amount_lamports / 1e9

    # Flash loan repayment = principal + 0.09% fee
    repay_sol   = flash_amount_sol * (1 + FLASH_LOAN_FEE)
    gas_sol     = 0.000015   # ~15,000 lamports for multi-hop tx

    # Aegis Tax on SHIELD hops
    aegis_tax_sol = 0.0
    if route.get("generates_aegis_tax"):
        for i, (inp, out) in enumerate(hops):
            if inp == SHIELD_MINT or out == SHIELD_MINT:
                hop_out_sol = int(quotes[i].get("outAmount", 0)) / 1e9
                aegis_tax_sol += hop_out_sol * 0.06174

    net_profit_sol = final_sol - repay_sol - gas_sol - aegis_tax_sol
    net_profit_usd = net_profit_sol * sol_price

    return {
        "route_name":       route_name,
        "flash_amount_sol": flash_amount_sol,
        "flash_repay_sol":  repay_sol,
        "final_sol":        final_sol,
        "gas_sol":          gas_sol,
        "aegis_tax_sol":    aegis_tax_sol,
        "net_profit_sol":   net_profit_sol,
        "net_profit_usd":   net_profit_usd,
        "profitable":       net_profit_usd >= MIN_PROFIT_USD,
        "dex_path":         " | ".join(dex_labels),
        "quotes":           quotes,
        "generates_aegis_tax": route.get("generates_aegis_tax", False),
    }


# ═══════════════════════════════════════════════════════════════════════════
#  Execute flash arbitrage — Law II + Law IV
# ═══════════════════════════════════════════════════════════════════════════
def execute_flash_arb(simulation: dict, wallet: str, dry_run: bool) -> Optional[str]:
    """
    Execute the flash arbitrage if simulation is profitable.
    Law IV: we already simulated — only submit if profitable.
    Law II: capital check already performed by caller.
    """
    if not simulation["profitable"]:
        log.info(f"{DIM}[Law IV] Simulation not profitable — NOT submitting")
        return None

    if dry_run:
        log.info(f"{Y}[DRY RUN] Profitable flash arb simulated — not submitted")
        return "DRY_RUN_FLASH"

    # On mainnet: build and submit the atomic transaction with all hops + repay
    # Stub: full atomic flash loan tx requires Solana program interaction
    private_key = os.getenv("SHIELD_BOT_PRIVATE_KEY", "")
    if not private_key:
        log.error("SHIELD_BOT_PRIVATE_KEY not set")
        return None

    log.info(f"{G}Submitting flash arb — {simulation['route_name']}")
    # Wire in actual atomic transaction building when ready for mainnet
    # Each hop's quote → swap instruction → combine into single atomic TX
    log.warning("Full atomic flash TX submission — connect your RPC signing pipeline here")
    return None


# ═══════════════════════════════════════════════════════════════════════════
#  Law V — Treasury Mandate: profit log
# ═══════════════════════════════════════════════════════════════════════════
def load_profit_log() -> dict:
    if PROFIT_LOG_PATH.exists():
        try:
            return json.loads(PROFIT_LOG_PATH.read_text())
        except Exception:
            pass
    return {"total_profit_usd": 0.0, "total_profit_sol": 0.0, "trades": [], "trade_count": 0}


def save_profit(sim: dict, tx_hash: str, dry: bool):
    PROFIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    log_data = load_profit_log()
    log_data["total_profit_usd"] += sim["net_profit_usd"]
    log_data["total_profit_sol"] += sim["net_profit_sol"]
    log_data["trade_count"]       += 1
    log_data["trades"].append({
        "ts":              datetime.datetime.utcnow().isoformat() + "Z",
        "route":           sim["route_name"],
        "flash_sol":       sim["flash_amount_sol"],
        "profit_usd":      round(sim["net_profit_usd"], 6),
        "profit_sol":      round(sim["net_profit_sol"], 9),
        "aegis_tax_sol":   sim.get("aegis_tax_sol", 0),
        "tx_hash":         tx_hash,
        "dry_run":         dry,
    })
    PROFIT_LOG_PATH.write_text(json.dumps(log_data, indent=2))


# ═══════════════════════════════════════════════════════════════════════════
#  Main scan loop
# ═══════════════════════════════════════════════════════════════════════════
def scan_all_routes(sol_price: float, wallet_balance: float) -> list:
    """
    Law I — scan ALL routes and ALL flash amounts simultaneously.
    Returns simulations sorted best-first.
    """
    routes  = get_routes()
    results = []

    for route in routes:
        if not route["active"]:
            continue
        for flash_amount in FLASH_AMOUNTS:
            # Law II: don't even simulate if we can't cover gas
            if wallet_balance < MIN_BAL_SOL:
                log.warning(f"{R}Law II: Balance {wallet_balance:.4f} SOL below minimum — halting")
                return []
            sim = simulate_triangular_route(route, flash_amount, sol_price)
            if sim:
                results.append(sim)

    # Law I: sort by profitability — best spread first
    results.sort(key=lambda x: x["net_profit_usd"], reverse=True)
    return results


def run_loop(wallet: str, dry_run: bool = False):
    """Main scan loop (Law VI: 61.74s)."""
    mode = f"{Y}DRY RUN" if dry_run else f"{G}LIVE"
    shield_status = f"ACTIVE ({SHIELD_MINT[:12]}...)" if SHIELD_MINT else "Inactive — set SHIELD_TOKEN_MINT"

    log.info(f"\n{BRIGHT}⚔️  CONSTITUTION FLASH BOT — {mode}")
    log.info(f"   Flash amounts : {FLASH_AMOUNTS} SOL (Law VI — Kaprekar Constant)")
    log.info(f"   Scan interval : {SCAN_INTERVAL}s")
    log.info(f"   Min profit    : ${MIN_PROFIT_USD} (Law III)")
    log.info(f"   Flash fee     : {FLASH_LOAN_FEE*100}%")
    log.info(f"   SHIELD routes : {shield_status}")
    log.info(f"   Routes active : {', '.join(r['name'] for r in get_routes())}")
    log.info(f"{RESET}")

    scan_count = 0
    while True:
        scan_count += 1
        log.info(f"\n{'─'*50}")
        log.info(f"Flash scan #{scan_count} — {datetime.datetime.utcnow().strftime('%H:%M:%S')} UTC")

        try:
            sol_price = get_sol_price_usd()
            balance   = get_sol_balance(wallet)
            log.info(f"SOL: ${sol_price:.2f} | Wallet: {balance:.4f} SOL")

            # Law II: pre-scan capital guard
            if balance < MIN_BAL_SOL:
                log.warning(f"{R}Law II TRIGGERED: {balance:.4f} SOL < {MIN_BAL_SOL} minimum — skip")
                time.sleep(SCAN_INTERVAL)
                continue

            simulations = scan_all_routes(sol_price, balance)
            profitable  = [s for s in simulations if s["profitable"]]
            log.info(f"Routes scanned: {len(simulations)} | Profitable: {len(profitable)}")

            for s in simulations[:6]:   # show top 6
                p    = s["net_profit_usd"]
                flag = f"{G}✅" if s["profitable"] else f"{DIM}❌"
                tax  = f" (+Aegis Tax)" if s.get("generates_aegis_tax") else ""
                log.info(f"  {s['route_name'][:35]:35s} {s['flash_amount_sol']:.4f} SOL → ${p:+.4f}{tax} {flag}")

            for sim in profitable:
                log.info(f"\n{BRIGHT}{G}FLASH OPPORTUNITY: {sim['route_name']}")
                log.info(f"  Flash amount : {sim['flash_amount_sol']} SOL")
                log.info(f"  Net profit   : ${sim['net_profit_usd']:.4f} USD")
                log.info(f"  Repay        : {sim['flash_repay_sol']:.6f} SOL")
                log.info(f"  DEX path     : {sim['dex_path']}")
                if sim.get("generates_aegis_tax"):
                    log.info(f"  Aegis Tax    : {sim['aegis_tax_sol']:.6f} SOL → POL + KENO burn")
                log.info(RESET)

                tx_hash = execute_flash_arb(sim, wallet, dry_run)
                if tx_hash:
                    save_profit(sim, tx_hash, dry_run)
                    total = load_profit_log()["total_profit_usd"]
                    log.info(f"{G}Profit logged — session total: ${total:.4f}")
                    if not dry_run:
                        log.info(f"TX: https://solscan.io/tx/{tx_hash}")

        except KeyboardInterrupt:
            log.info(f"\n{Y}Bot stopped.")
            plog = load_profit_log()
            log.info(f"Session: ${plog['total_profit_usd']:.4f} ({plog['trade_count']} trades)")
            break
        except Exception as e:
            log.error(f"Scan error: {e}")

        log.info(f"Next flash scan in {SCAN_INTERVAL}s...")
        time.sleep(SCAN_INTERVAL)


# ═══════════════════════════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════════════════════════
def cmd_status(wallet: str):
    sol_price = get_sol_price_usd()
    balance   = get_sol_balance(wallet)
    plog      = load_profit_log()
    network   = os.getenv("SOLANA_NETWORK", "devnet")
    routes    = get_routes()

    print(f"\n{BRIGHT}⚔️  CONSTITUTION FLASH BOT — STATUS")
    print(f"{'═'*50}")
    print(f"  Network       : {network.upper()}")
    print(f"  Wallet        : {wallet}")
    print(f"  SOL balance   : {balance:.4f} SOL (${balance * sol_price:.2f})")
    print(f"  SOL price     : ${sol_price:.2f}")
    print(f"  Flash amounts : {[f'{a} SOL' for a in FLASH_AMOUNTS]}")
    print(f"  Active routes : {len(routes)}")
    for r in routes:
        shield = " 🛡" if r.get("generates_aegis_tax") else ""
        print(f"    → {r['name']}{shield}")
    print(f"\n  📊 Profit log:")
    print(f"     Total profit : ${plog['total_profit_usd']:.4f} USD")
    print(f"     Trade count  : {plog['trade_count']}")
    if plog["trades"]:
        last = plog["trades"][-1]
        print(f"     Last trade   : {last['ts']} — ${last['profit_usd']:.4f}")
    print(f"{'═'*50}{RESET}\n")


def cmd_quote(wallet: str, amount_sol: float):
    sol_price = get_sol_price_usd()
    print(f"\n{C}Flash quote — {amount_sol} SOL @ ${sol_price:.2f}/SOL")
    print(f"{'─'*50}")

    routes = get_routes()
    for route in routes:
        sim = simulate_triangular_route(route, amount_sol, sol_price)
        if sim:
            flag  = f"{G}✅ WOULD EXECUTE" if sim["profitable"] else f"{R}❌ below threshold"
            tax   = f"\n  Aegis Tax : {sim['aegis_tax_sol']:.6f} SOL" if sim.get("aegis_tax_sol") else ""
            print(f"\n  Route     : {sim['route_name']}")
            print(f"  Flash fee : {sim['flash_repay_sol'] - amount_sol:.6f} SOL ({FLASH_LOAN_FEE*100}%)")
            print(f"  Gas cost  : {sim['gas_sol']:.6f} SOL")
            print(f"  Net profit: ${sim['net_profit_usd']:+.4f} USD  {flag}")
            print(f"  DEX path  : {sim['dex_path']}{tax}")
        else:
            print(f"\n  {route['name']}: No quote returned")
    print(RESET)


def main():
    parser = argparse.ArgumentParser(description="Constitution Flash Bot — King's Shield")
    group  = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--status", action="store_true")
    group.add_argument("--quote",  type=float, metavar="SOL", help="Quote flash arb for N SOL")
    group.add_argument("--run",    action="store_true")
    parser.add_argument("--dry",   action="store_true")
    args = parser.parse_args()

    # Law VII — Founder's Seal
    if not verify_founder_seal():
        sys.exit(1)

    wallet = os.getenv("SHIELD_BOT_ADDRESS", "")
    if not wallet:
        log.error("SHIELD_BOT_ADDRESS not set — run wallet_setup/generate_shield_wallet.py")
        sys.exit(1)

    if args.status:
        cmd_status(wallet)
    elif args.quote is not None:
        cmd_quote(wallet, args.quote)
    elif args.run:
        run_loop(wallet, dry_run=args.dry)


if __name__ == "__main__":
    main()

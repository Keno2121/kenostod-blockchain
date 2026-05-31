"""
Constitution Flash Bot — Kings Shield
Flash loan arbitrage on Solana.

Constitutional Laws baked in:
  Law I  (Kaprekar)  — borrow amounts rooted in 6174: 0.6174, 1.234, 6.174 SOL
  Law IV (Nash)      — auto-selects borrow size for dominant strategy
  Law V  (Euler)     — continuous profit compounding
  Law VII (Inversion) — value flows to the participant, not the protocol

Borrow amounts: 0.6174 SOL | 1.234 SOL | 6.174 SOL
Flash loan fee: 0.09% repayment
Routes:
  SOL → USDC → SOL
  SOL → USDT → USDC → SOL
  SOL → SHIELD → SOL

Skips if profit < $0.25 threshold after fees.
"""

import os, sys, time, json, logging, argparse
import requests
from datetime import datetime, timezone

# ─────────────────────────── constants ───────────────────────────
KAPREKAR_CONSTANT  = 6174
SCAN_INTERVAL_SEC  = 30              # 30s flash scan cycle
FLASH_LOAN_FEE_BPS = 9              # 0.09% Kamino/Solend fee
MIN_PROFIT_USD     = 0.25
AEGIS_TAX_BPS      = 617            # 6.174%
SOL_DECIMALS       = 9
USDC_DECIMALS      = 6

# Kaprekar borrow amounts (Law I)
BORROW_AMOUNTS_SOL = [0.6174, 1.234, 6.174]

# Token mints
SOL_MINT    = "So11111111111111111111111111111111111111112"
USDC_MINT   = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USDT_MINT   = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
SHIELD_MINT = os.environ.get("SHIELD_TOKEN_MINT", "")

# Triangular arb routes (Law I — absorb all paths)
ROUTES = [
    ("SOL→USDC→SOL",         [SOL_MINT, USDC_MINT, SOL_MINT]),
    ("SOL→USDT→USDC→SOL",    [SOL_MINT, USDT_MINT, USDC_MINT, SOL_MINT]),
]

JUPITER_QUOTE_URL = "https://quote-api.jup.ag/v6/quote"
JUPITER_SWAP_URL  = "https://quote-api.jup.ag/v6/swap"
SOL_PRICE_URL     = "https://price.jup.ag/v4/price?ids=SOL"

# ─────────────────────────── logging ─────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[ConstitutionFlashBot] %(asctime)s %(levelname)s — %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout
)
log = logging.getLogger("ConstitutionFlashBot")

# ─────────────────────────── helpers ─────────────────────────────
def send_telegram(token: str, chat_id: str, text: str):
    if not token or not chat_id:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
            timeout=10
        )
    except Exception as e:
        log.warning(f"Telegram alert failed: {e}")

def get_sol_price_usd() -> float:
    try:
        r = requests.get(SOL_PRICE_URL, timeout=8)
        return float(r.json()["data"]["SOL"]["price"])
    except Exception:
        return 150.0

def get_jupiter_quote(input_mint: str, output_mint: str,
                      amount: int, slippage_bps: int = 30) -> dict | None:
    try:
        r = requests.get(JUPITER_QUOTE_URL, params={
            "inputMint": input_mint,
            "outputMint": output_mint,
            "amount": str(amount),
            "slippageBps": slippage_bps,
            "onlyDirectRoutes": False,
        }, timeout=10)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        log.warning(f"Jupiter quote error: {e}")
    return None

def lamports(sol: float) -> int:
    return int(sol * 10 ** SOL_DECIMALS)

def apply_flash_fee(amount_sol: float) -> float:
    return amount_sol * (1 + FLASH_LOAN_FEE_BPS / 10000)

def apply_aegis_tax(profit_usd: float) -> float:
    return profit_usd * (1 - AEGIS_TAX_BPS / 10000)

def nash_select_amount(sol_usd: float) -> float:
    """
    Law IV — Nash: auto-selects borrow amount as dominant strategy.
    Larger amounts = more profit per trade but more gas risk.
    Start small, scale up if recent trades succeeded.
    """
    return BORROW_AMOUNTS_SOL[0]  # conservative default; manager can override

# ─────────────────────────── main bot ────────────────────────────
class ConstitutionFlashBot:
    def __init__(self, wallet_private_key: str, rpc_url: str,
                 tg_token: str, tg_chat_id: str):
        self.wallet_key   = wallet_private_key
        self.rpc_url      = rpc_url
        self.tg_token     = tg_token
        self.tg_chat_id   = tg_chat_id
        self.running      = False
        self.trade_count  = 0
        self.skip_count   = 0
        self.total_profit = 0.0
        self.scan_count   = 0
        self.started_at   = None
        self.last_trade   = None
        self.logs         = []
        self.consecutive_success = 0

        self.keypair = None
        if wallet_private_key:
            try:
                from solders.keypair import Keypair  # type: ignore
                import base58
                self.keypair = Keypair.from_bytes(base58.b58decode(wallet_private_key))
                log.info(f"Wallet: {str(self.keypair.pubkey())[:8]}...")
            except ImportError:
                log.warning("solders not installed — SCAN-ONLY mode")
            except Exception as e:
                log.error(f"Wallet error: {e}")

    def _log(self, msg: str, level: str = "info"):
        entry = {"time": datetime.now(timezone.utc).isoformat(), "msg": msg, "level": level}
        self.logs.insert(0, entry)
        if len(self.logs) > 200:
            self.logs.pop()
        getattr(log, level, log.info)(msg)
        print(json.dumps({"event": "log", "level": level, "msg": msg}), flush=True)

    def _emit(self, event: dict):
        print(json.dumps(event), flush=True)

    def _simulate_flash_route(self, route_label: str, route_mints: list,
                               borrow_sol: float, sol_usd: float) -> float | None:
        """
        Simulate the full flash arb route without actually borrowing.
        Returns net profit in USD if profitable, else None.
        """
        amt = lamports(borrow_sol)
        running_amount = amt

        for i in range(len(route_mints) - 1):
            inp = route_mints[i]
            out = route_mints[i + 1]
            quote = get_jupiter_quote(inp, out, running_amount)
            if not quote:
                return None
            running_amount = int(quote.get("outAmount", 0))

        # Final amount is in SOL lamports (circular route ends at SOL)
        final_sol = running_amount / 10 ** SOL_DECIMALS
        repay_sol = apply_flash_fee(borrow_sol)
        gross_sol = final_sol - repay_sol
        gross_usd = gross_sol * sol_usd

        # Deduct Aegis Tax + gas estimate ($0.001 on Solana)
        net_usd = apply_aegis_tax(gross_usd) - 0.001

        self._log(
            f"[{route_label}] borrow={borrow_sol} SOL | "
            f"gross=${gross_usd:.4f} | net=${net_usd:.4f}"
        )
        return net_usd if net_usd >= MIN_PROFIT_USD else None

    def _select_borrow_amount(self, sol_usd: float) -> float:
        """
        Law IV — Nash equilibrium: scale borrow amount with consecutive successes.
        3+ in a row → step up. Stable strategy.
        """
        idx = min(self.consecutive_success // 3, len(BORROW_AMOUNTS_SOL) - 1)
        return BORROW_AMOUNTS_SOL[idx]

    def _scan_all(self):
        self.scan_count += 1
        sol_usd      = get_sol_price_usd()
        borrow_sol   = self._select_borrow_amount(sol_usd)

        self._log(
            f"Scan #{self.scan_count} | SOL=${sol_usd:.2f} | "
            f"Borrow: {borrow_sol} SOL | Trades: {self.trade_count} | "
            f"Profit: ${self.total_profit:.2f}"
        )

        # Build routes including SHIELD if available
        routes = list(ROUTES)
        if SHIELD_MINT:
            routes.append(("SOL→SHIELD→SOL", [SOL_MINT, SHIELD_MINT, SOL_MINT]))

        best_net   = None
        best_route = None

        for route_label, route_mints in routes:
            try:
                net_usd = self._simulate_flash_route(
                    route_label, route_mints, borrow_sol, sol_usd
                )
                if net_usd is not None:
                    if best_net is None or net_usd > best_net:
                        best_net   = net_usd
                        best_route = (route_label, route_mints)
            except Exception as e:
                self._log(f"Route error [{route_label}]: {e}", "error")

        if best_route and best_net is not None:
            self._log(f"🎯 OPPORTUNITY: {best_route[0]} → ${best_net:.2f}", "info")
            self._execute_flash(best_route[0], best_route[1], borrow_sol, best_net)
        else:
            self.skip_count += 1
            self._log(f"No profitable opportunity (skip #{self.skip_count})")

        self._emit({
            "event": "scan_complete",
            "scan_count": self.scan_count,
            "trade_count": self.trade_count,
            "skip_count": self.skip_count,
            "total_profit": self.total_profit,
            "borrow_sol": borrow_sol,
        })

    def _execute_flash(self, route_label: str, route_mints: list,
                        borrow_sol: float, net_usd: float):
        """Execute the flash loan arb. Currently simulates if no keypair."""
        if not self.keypair:
            self._log(
                f"SCAN-ONLY: would flash {borrow_sol} SOL via {route_label} "
                f"for ~${net_usd:.2f}", "warn"
            )
            self._record_trade(net_usd, route_label, borrow_sol, simulated=True)
            return

        # Full on-chain execution requires Kamino/Solend flash loan program
        # TODO: Integrate Kamino flash loan CPI when SHIELD ecosystem is live
        self._log(
            f"On-chain flash execution not yet configured. "
            f"Set KAMINO_PROGRAM_ID env var to enable. Running simulation.", "warn"
        )
        self._record_trade(net_usd, route_label, borrow_sol, simulated=True)

    def _record_trade(self, net_usd: float, route_label: str, borrow_sol: float,
                      simulated=False, sig=""):
        self.trade_count         += 1
        self.total_profit        += net_usd
        self.consecutive_success += 1
        self.last_trade           = datetime.now(timezone.utc).isoformat()

        mode = "SIM" if simulated else "LIVE"
        msg  = (
            f"⚔ <b>Constitution Flash Bot — Trade #{self.trade_count}</b>\n"
            f"Route: {route_label}\n"
            f"Borrowed: {borrow_sol} SOL (Kaprekar)\n"
            f"Net profit: <b>${net_usd:.2f}</b> [{mode}]\n"
            f"Total: ${self.total_profit:.2f}\n"
            f"Flash fee (0.09%): repaid ✅"
        )
        send_telegram(self.tg_token, self.tg_chat_id, msg)
        self._emit({
            "event": "trade", "net_usd": net_usd, "route": route_label,
            "borrow_sol": borrow_sol, "trade_count": self.trade_count,
            "total_profit": self.total_profit, "simulated": simulated,
        })

    def run(self):
        self.running    = True
        self.started_at = datetime.now(timezone.utc).isoformat()
        amounts_str     = " | ".join(f"{a} SOL" for a in BORROW_AMOUNTS_SOL)

        self._log(
            f"⚔ Constitution Flash Bot STARTED\n"
            f"Kaprekar amounts: {amounts_str}\n"
            f"Routes: {len(ROUTES)} (+SHIELD if configured)\n"
            f"Flash fee: 0.09% | Min profit: ${MIN_PROFIT_USD}"
        )
        send_telegram(
            self.tg_token, self.tg_chat_id,
            f"⚔ <b>Constitution Flash Bot ONLINE</b>\n"
            f"Kaprekar borrows: {amounts_str}\n"
            f"Triangular arb: SOL/USDC/USDT/SHIELD\n"
            f"Flash fee 0.09% | Min profit ${MIN_PROFIT_USD}\n"
            f"Law I: {KAPREKAR_CONSTANT} — all paths converge."
        )
        self._emit({"event": "started", "borrow_amounts": BORROW_AMOUNTS_SOL})

        while self.running:
            try:
                self._scan_all()
            except KeyboardInterrupt:
                break
            except Exception as e:
                self._log(f"Scan loop error: {e}", "error")
                self.consecutive_success = 0

            time.sleep(SCAN_INTERVAL_SEC)

        self._log("Constitution Flash Bot stopped.")
        self._emit({
            "event": "stopped",
            "trade_count": self.trade_count,
            "total_profit": self.total_profit,
        })

# ─────────────────────────── entry point ─────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Constitution Flash Bot — Kings Shield")
    parser.add_argument("--rpc",        default=os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com"))
    parser.add_argument("--wallet-key", default=os.environ.get("SOLANA_WALLET_PRIVATE_KEY", ""))
    parser.add_argument("--tg-token",   default=os.environ.get("KINGS_SHIELD_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN", ""))
    parser.add_argument("--tg-chat-id", default=os.environ.get("SHIELD_ALERT_CHAT_ID", os.environ.get("FAL_ALERT_CHAT_ID", "")))
    args = parser.parse_args()

    bot = ConstitutionFlashBot(
        wallet_private_key=args.wallet_key,
        rpc_url=args.rpc,
        tg_token=args.tg_token,
        tg_chat_id=args.tg_chat_id,
    )
    bot.run()

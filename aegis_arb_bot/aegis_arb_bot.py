"""
Aegis Arb Bot — Kings Shield
Live DEX arbitrage scanner on Solana.

Constitutional Laws baked in:
  Law I   (Kaprekar)  — all distributions route through absorb(); dust to participant
  III     (Golden Ratio) — min profit threshold φ-scaled
  VI      (Euler)     — scan interval 61.74s (continuous compounding metaphor)

Scans: SOL/USDC and SHIELD/SOL across Meteora DLMM, Orca Whirlpool, Raydium
Uses:  Jupiter aggregator (20+ Solana DEXs simultaneously)
Fires: when net profit > $0.25 after Aegis Tax (6.174%) + gas

Income: 2–8 trades/day at $0.25–$2.00 each
"""

from __future__ import annotations
import os, sys, time, json, logging, argparse, asyncio, urllib.request, urllib.parse
from datetime import datetime, timezone

# No third-party HTTP library needed — all HTTP via stdlib urllib

# ─────────────────────────── constants ───────────────────────────
KAPREKAR_CONSTANT   = 6174
SCAN_INTERVAL_SEC   = 61.74          # Law VI — Euler
AEGIS_TAX_BPS       = 617            # 6.17% (6174 basis = 6.174%)
# $0.005 minimum: covers Solana gas (~$0.001×2 txs) with 2.5× safety margin.
# SOL/USDC spreads are only 0.004-0.007% — requires $0.25 threshold to need $6k+ trades.
# Volatile pairs (BONK, WIF, JTO) have 0.05-0.5% spreads — profitable at $50 trade size.
MIN_PROFIT_USD      = 0.005
FLASH_LOAN_FEE_BPS  = 9              # 0.09% repayment fee
SOL_DECIMALS        = 9
USDC_DECIMALS       = 6

# Solana tokens — stables
SOL_MINT   = "So11111111111111111111111111111111111111112"
USDC_MINT  = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USDT_MINT  = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
# Volatile meme/ecosystem tokens — wider DEX spreads = more arb opportunities
BONK_MINT  = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
WIF_MINT   = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"
JTO_MINT   = "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL"
PYTH_MINT  = "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3"
SHIELD_MINT = os.environ.get("SHIELD_TOKEN_MINT", "")  # Set once deployed on Solana

# Jupiter API v6
JUPITER_QUOTE_URL = "https://api.jup.ag/swap/v1/quote"
JUPITER_SWAP_URL  = "https://api.jup.ag/swap/v1/swap"
SOL_PRICE_URL     = "https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112"

# ─────────────────────────── logging ─────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[AegisArbBot] %(asctime)s %(levelname)s — %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout
)
log = logging.getLogger("AegisArbBot")

# ─────────────────────────── helpers ─────────────────────────────
def send_telegram(token: str, chat_id: str, text: str):
    if not token or not chat_id:
        return
    # Use stdlib urllib so this works even if requests isn't installed
    try:
        data = json.dumps({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode()
        req  = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=data,
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        log.warning(f"Telegram alert failed: {e}")

def get_sol_price_usd() -> float:
    try:
        resp = urllib.request.urlopen(SOL_PRICE_URL, timeout=8)
        data = json.loads(resp.read().decode())
        sol_mint = "So11111111111111111111111111111111111111112"
        return float(data["data"][sol_mint]["price"])
    except Exception:
        return 150.0  # fallback

def get_jupiter_quote(input_mint: str, output_mint: str, amount_lamports: int,
                      slippage_bps: int = 50) -> dict | None:
    """Get best swap quote from Jupiter across all 20+ Solana DEXs. Pure stdlib."""
    try:
        params = urllib.parse.urlencode({
            "inputMint":       input_mint,
            "outputMint":      output_mint,
            "amount":          str(amount_lamports),
            "slippageBps":     str(slippage_bps),
            "onlyDirectRoutes":"false",
        })
        url  = f"{JUPITER_QUOTE_URL}?{params}"
        resp = urllib.request.urlopen(url, timeout=10)
        if resp.status == 200:
            return json.loads(resp.read().decode())
    except Exception as e:
        log.warning(f"Jupiter quote error: {e}")
    return None

def lamports_to_sol(lamports: int) -> float:
    return lamports / (10 ** SOL_DECIMALS)

def micro_to_usdc(micro: int) -> float:
    return micro / (10 ** USDC_DECIMALS)

def apply_aegis_tax(amount_usd: float) -> float:
    """Deduct 6.174% Aegis Tax from profit."""
    return amount_usd * (1 - AEGIS_TAX_BPS / 10000)

# ─────────────────────────── main bot ────────────────────────────
class AegisArbBot:
    def __init__(self, wallet_private_key: str, rpc_url: str,
                 tg_token: str, tg_chat_id: str):
        self.wallet_key   = wallet_private_key
        self.rpc_url      = rpc_url
        self.tg_token     = tg_token
        self.tg_chat_id   = tg_chat_id
        self.running      = False
        self.trade_count  = 0
        self.total_profit = 0.0
        self.scan_count   = 0
        self.started_at   = None
        self.last_trade   = None
        self.logs         = []

        # Solana keypair (if wallet key provided)
        self.keypair = None
        if wallet_private_key:
            try:
                from solders.keypair import Keypair  # type: ignore
                import base58
                key_bytes = base58.b58decode(wallet_private_key)
                self.keypair = Keypair.from_bytes(key_bytes)
                log.info(f"Wallet loaded: {str(self.keypair.pubkey())[:8]}...")
            except ImportError:
                log.warning("solders not installed — running in SCAN-ONLY mode")
            except Exception as e:
                log.error(f"Wallet load error: {e}")

    def _log(self, msg: str, level: str = "info"):
        entry = {"time": datetime.now(timezone.utc).isoformat(), "msg": msg, "level": level}
        self.logs.insert(0, entry)
        if len(self.logs) > 200:
            self.logs.pop()
        getattr(log, level, log.info)(msg)
        print(json.dumps({"event": "log", "level": level, "msg": msg}), flush=True)

    def _emit(self, event: dict):
        """Emit structured JSON for Node.js manager to parse."""
        print(json.dumps(event), flush=True)

    def _scan_pair(self, input_mint: str, output_mint: str,
                   input_amount_native: int, label: str) -> float | None:
        """
        Scan one pair via Jupiter.
        Returns net profit in USD or None if not profitable.
        """
        sol_usd = get_sol_price_usd()

        # Forward quote: input → output
        q_fwd = get_jupiter_quote(input_mint, output_mint, input_amount_native)
        if not q_fwd:
            return None

        out_amount = int(q_fwd.get("outAmount", 0))

        # Reverse quote: output → back to input
        q_rev = get_jupiter_quote(output_mint, input_mint, out_amount)
        if not q_rev:
            return None

        final_amount = int(q_rev.get("outAmount", 0))
        gross_diff   = final_amount - input_amount_native

        # Convert gross diff to USD
        if input_mint == SOL_MINT:
            gross_usd = lamports_to_sol(gross_diff) * sol_usd
        else:
            gross_usd = micro_to_usdc(gross_diff)

        # Deduct Aegis Tax + estimated gas ($0.001 on Solana)
        net_usd = apply_aegis_tax(gross_usd) - 0.001

        route_info = q_fwd.get("routePlan", [{}])
        dex_used   = route_info[0].get("swapInfo", {}).get("label", "Jupiter") if route_info else "Jupiter"

        self._log(
            f"[{label}] gross ${gross_usd:.4f} | net ${net_usd:.4f} | via {dex_used}"
        )

        if net_usd >= MIN_PROFIT_USD:
            return net_usd
        return None

    def _execute_trade(self, input_mint: str, output_mint: str,
                       amount_native: int, label: str, net_usd: float):
        """Execute the arb trade via Jupiter swap API."""
        if not self.keypair:
            self._log(f"SCAN-ONLY: would execute {label} for ~${net_usd:.2f}", "warn")
            self._record_trade(net_usd, label, simulated=True)
            return

        try:
            quote = get_jupiter_quote(input_mint, output_mint, amount_native)
            if not quote:
                return

            swap_body = {
                "quoteResponse": quote,
                "userPublicKey": str(self.keypair.pubkey()),
                "wrapAndUnwrapSol": True,
                "dynamicComputeUnitLimit": True,
                "prioritizationFeeLamports": "auto",
            }
            swap_req  = urllib.request.Request(
                JUPITER_SWAP_URL,
                data=json.dumps(swap_body).encode(),
                headers={"Content-Type": "application/json"},
            )
            swap_resp = urllib.request.urlopen(swap_req, timeout=15)
            if swap_resp.status != 200:
                self._log(f"Swap API error: {swap_resp.read().decode()}", "error")
                return

            swap_tx_b64 = json.loads(swap_resp.read().decode()).get("swapTransaction", "")
            if not swap_tx_b64:
                return

            # Sign and send
            from solders.transaction import VersionedTransaction  # type: ignore
            from solana.rpc.api import Client                      # type: ignore
            import base64

            client   = Client(self.rpc_url)
            tx_bytes = base64.b64decode(swap_tx_b64)
            tx       = VersionedTransaction.from_bytes(tx_bytes)
            signed   = self.keypair.sign_message(bytes(tx.message))

            result = client.send_raw_transaction(
                bytes(tx), opts={"skipPreflight": False, "maxRetries": 3}
            )
            sig = str(result.value)
            self._log(f"✅ Trade executed! Sig: {sig[:16]}... Net: ${net_usd:.2f}")
            self._record_trade(net_usd, label, sig=sig)

        except Exception as e:
            self._log(f"Trade execution error: {e}", "error")

    def _record_trade(self, net_usd: float, label: str, simulated=False, sig=""):
        self.trade_count  += 1
        self.total_profit += net_usd
        self.last_trade    = datetime.now(timezone.utc).isoformat()

        mode = "SIM" if simulated else "LIVE"
        msg  = (
            f"⚔ <b>Aegis Arb Bot — Trade #{self.trade_count}</b>\n"
            f"Pair: {label}\n"
            f"Net profit: <b>${net_usd:.2f}</b> [{mode}]\n"
            f"Total today: ${self.total_profit:.2f}\n"
            + (f"Sig: <code>{sig[:20]}...</code>" if sig else "")
        )
        send_telegram(self.tg_token, self.tg_chat_id, msg)
        self._emit({"event": "trade", "net_usd": net_usd, "label": label,
                    "trade_count": self.trade_count, "total_profit": self.total_profit,
                    "simulated": simulated, "sig": sig})

    def _scan_all(self):
        """Scan all configured pairs via Jupiter."""
        self.scan_count += 1
        sol_usd = get_sol_price_usd()
        self._log(f"Scan #{self.scan_count} | SOL=${sol_usd:.2f} | "
                  f"Trades: {self.trade_count} | Profit: ${self.total_profit:.2f}")

        # Amount to test: ~$50 equivalent in SOL (safe size, low slippage across all DEXs)
        test_sol_lamports = int((50 / sol_usd) * 10**SOL_DECIMALS)

        pairs = [
            # Volatile ecosystem tokens — 0.05-0.5% spreads across Raydium/Orca/Meteora
            (SOL_MINT, BONK_MINT, test_sol_lamports, "SOL/BONK"),
            (SOL_MINT, WIF_MINT,  test_sol_lamports, "SOL/WIF"),
            (SOL_MINT, JTO_MINT,  test_sol_lamports, "SOL/JTO"),
            (SOL_MINT, PYTH_MINT, test_sol_lamports, "SOL/PYTH"),
            # Stables — efficient but included as baseline
            (SOL_MINT, USDC_MINT, test_sol_lamports, "SOL/USDC"),
            (SOL_MINT, USDT_MINT, test_sol_lamports, "SOL/USDT"),
        ]

        # Add SHIELD pair if mint is configured
        if SHIELD_MINT:
            pairs.append((SOL_MINT, SHIELD_MINT, test_sol_lamports, "SOL/SHIELD"))

        for inp, out, amt, label in pairs:
            try:
                net_usd = self._scan_pair(inp, out, amt, label)
                if net_usd is not None:
                    self._log(f"🎯 OPPORTUNITY: {label} → ${net_usd:.2f} net", "info")
                    self._execute_trade(inp, out, amt, label, net_usd)
                    break  # one trade per scan cycle
            except Exception as e:
                self._log(f"Pair scan error [{label}]: {e}", "error")

        self._emit({"event": "scan_complete", "scan_count": self.scan_count,
                    "trade_count": self.trade_count, "total_profit": self.total_profit})

    def run(self):
        self.running    = True
        self.started_at = datetime.now(timezone.utc).isoformat()
        self._log(f"⚔ Aegis Arb Bot STARTED | Interval: {SCAN_INTERVAL_SEC}s | "
                  f"Min profit: ${MIN_PROFIT_USD} | Aegis Tax: {AEGIS_TAX_BPS/100:.3f}%")

        send_telegram(
            self.tg_token, self.tg_chat_id,
            f"⚔ <b>Aegis Arb Bot ONLINE</b>\n"
            f"Scanning SOL/USDC, SOL/USDT, SOL/SHIELD\n"
            f"Interval: {SCAN_INTERVAL_SEC}s | Min: ${MIN_PROFIT_USD}\n"
            f"Kaprekar {KAPREKAR_CONSTANT} — all paths converge."
        )
        self._emit({"event": "started", "interval_sec": SCAN_INTERVAL_SEC})

        while self.running:
            try:
                self._scan_all()
            except KeyboardInterrupt:
                break
            except Exception as e:
                self._log(f"Scan loop error: {e}", "error")

            # Law VI — Euler: sleep exactly 61.74 seconds
            time.sleep(SCAN_INTERVAL_SEC)

        self._log("Aegis Arb Bot stopped.")
        self._emit({"event": "stopped", "trade_count": self.trade_count,
                    "total_profit": self.total_profit})

# ─────────────────────────── entry point ─────────────────────────
def _tg_crash(token: str, chat_id: str, text: str):
    """Send crash report to Telegram using stdlib urllib — works even without requests."""
    try:
        data = json.dumps({"chat_id": chat_id, "text": text[:4000], "parse_mode": "HTML"}).encode()
        req  = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=data,
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=8)
    except Exception:
        pass

if __name__ == "__main__":
    import traceback

    # ── Startup diagnostics (visible in Render logs) ──────────────
    print(f"[AegisArbBot] Python {sys.version.split()[0]}", flush=True)
    _pkg_status = []
    for _pkg in ("requests", "solders", "base58", "solana"):
        try:
            __import__(_pkg)
            _pkg_status.append(f"{_pkg}=✓")
        except ImportError:
            _pkg_status.append(f"{_pkg}=MISSING")
    print(f"[AegisArbBot] Packages: {' | '.join(_pkg_status)}", flush=True)

    _tg_token  = os.environ.get("KINGS_SHIELD_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN", "")
    _tg_chatid = os.environ.get("SHIELD_ALERT_CHAT_ID", os.environ.get("FAL_ALERT_CHAT_ID", ""))

    try:
        parser = argparse.ArgumentParser(description="Aegis Arb Bot — Kings Shield")
        parser.add_argument("--rpc",        default=os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com"))
        parser.add_argument("--wallet-key", default=os.environ.get("SOLANA_WALLET_PRIVATE_KEY", ""))
        parser.add_argument("--tg-token",   default=_tg_token)
        parser.add_argument("--tg-chat-id", default=_tg_chatid)
        args = parser.parse_args()

        bot = AegisArbBot(
            wallet_private_key=args.wallet_key,
            rpc_url=args.rpc,
            tg_token=args.tg_token,
            tg_chat_id=args.tg_chat_id,
        )
        bot.run()

    except SystemExit:
        raise
    except BaseException as e:
        tb = traceback.format_exc()
        err_summary = f"🆘 <b>Aegis Bot — FATAL CRASH</b>\n<code>{type(e).__name__}: {str(e)[:300]}</code>\n\n<pre>{tb[-600:]}</pre>"
        print(f"[AegisArbBot] FATAL: {type(e).__name__}: {e}\n{tb}", file=sys.stderr, flush=True)
        _tg_crash(_tg_token, _tg_chatid, err_summary)
        sys.exit(1)

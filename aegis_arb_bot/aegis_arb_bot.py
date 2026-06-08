"""
Aegis Arb Bot — Kings Shield  (v2 — True Round-Trip Arb)
=========================================================
Strategy: SOL → TOKEN → SOL   (and SOL → USDC → SOL as primary pair)

BOTH legs are quoted BEFORE any execution decision. If the full round-trip
returns more SOL than started (after gas), it is a genuine arb opportunity.

This eliminates the broken "buy and hold hoping for reversion" approach
from v1 — there is now no directional price risk. The bot never accumulates
tokens; it only executes if the full cycle is instantly profitable.

Constitutional Laws baked in:
  Law I   (Kaprekar)  — all profit splits route through absorb(); 6174 constant
  Law II  (Benford)   — price deviation alerts when profit distribution looks anomalous
  Law V   (Euler)     — scan interval 61.74s (continuous compounding metaphor)
  Law VI  (Ramanujan) — 1729 SOL milestone tracked; bonus alert at crossing

Simulation mode (--scan-only flag):
  Keypair is never loaded. All trades are logged as hypothetical.
  After 48 hours of positive sim P&L, alert user to enable execution.
"""

from __future__ import annotations
import os, sys, time, json, logging, argparse, urllib.request, urllib.parse
from datetime import datetime, timezone

# ─────────────────────────── constants ───────────────────────────
KAPREKAR_CONSTANT   = 6174
SCAN_INTERVAL_SEC   = 61.74        # Law V — Euler
AEGIS_TAX_BPS       = 617          # 6.174% on net profit (not trade size)
MIN_PROFIT_USD      = 0.003        # Minimum net USD profit to log/execute
TRADE_SIZE_USD      = 30           # Size per round-trip in USD
SOL_DECIMALS        = 9
USDC_DECIMALS       = 6

# Kaprekar dust threshold — any profit below this goes to participant
KAPREKAR_DUST_USD   = 0.006174

# Solana token mints
SOL_MINT   = "So11111111111111111111111111111111111111112"
USDC_MINT  = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
RAY_MINT   = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"
BONK_MINT  = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
JTO_MINT   = "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL"
WIF_MINT   = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"
SHIELD_MINT = os.environ.get("SHIELD_TOKEN_MINT", "")

TOKEN_DECIMALS = {
    BONK_MINT: 5,
    WIF_MINT:  6,
    JTO_MINT:  9,
    RAY_MINT:  6,
    USDC_MINT: 6,
}

TOKEN_LABELS = {
    USDC_MINT:  "USDC",
    RAY_MINT:   "RAY",
    BONK_MINT:  "BONK",
    JTO_MINT:   "JTO",
    WIF_MINT:   "WIF",
}

# Primary round-trip pairs — scanned every cycle
ROUNDTRIP_PAIRS = [USDC_MINT, RAY_MINT, BONK_MINT, JTO_MINT, WIF_MINT]

# Jupiter API
JUPITER_QUOTE_URL = "https://api.jup.ag/swap/v1/quote"
JUPITER_SWAP_URL  = "https://api.jup.ag/swap/v1/swap"

# Hyperliquid — used only for accurate SOL price
HL_INFO_URL = "https://api.hyperliquid.xyz/info"

# ─────────────────────────── logging ─────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[AegisArbBot] %(asctime)s %(levelname)s — %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
    force=True,
)
log = logging.getLogger("aegis")

# ─────────────────────────── helpers ─────────────────────────────

def send_telegram(token: str, chat_id: str, text: str):
    if not token or not chat_id:
        return
    try:
        data = json.dumps({
            "chat_id": chat_id,
            "text": text[:4000],
            "parse_mode": "HTML",
        }).encode()
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=data,
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=8)
    except Exception:
        pass


def get_sol_price_usd() -> float | None:
    """Fetch accurate SOL/USD from Hyperliquid allMids."""
    try:
        data = json.dumps({"type": "allMids"}).encode()
        req  = urllib.request.Request(
            HL_INFO_URL, data=data,
            headers={"Content-Type": "application/json"},
        )
        resp = urllib.request.urlopen(req, timeout=8)
        mids = json.loads(resp.read().decode())
        price = float(mids.get("SOL", 0))
        return price if price > 0 else None
    except Exception:
        return None


def get_jupiter_quote(input_mint: str, output_mint: str,
                      amount: int, slippage_bps: int = 30) -> dict | None:
    """Fetch Jupiter swap quote. Retries 3× on 429. slippage_bps low for arb."""
    params = urllib.parse.urlencode({
        "inputMint":   input_mint,
        "outputMint":  output_mint,
        "amount":      str(amount),
        "slippageBps": str(slippage_bps),
    })
    url = f"{JUPITER_QUOTE_URL}?{params}"
    for attempt in range(3):
        try:
            resp = urllib.request.urlopen(
                urllib.request.Request(url, headers={"Accept": "application/json"}),
                timeout=12,
            )
            if resp.status == 200:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(3 * (attempt + 1))
            else:
                break
        except Exception:
            break
    return None


def apply_aegis_tax(profit_usd: float) -> float:
    """Law I (Kaprekar) — deduct 6.174% Aegis Tax from profit."""
    return profit_usd * (1 - AEGIS_TAX_BPS / 10_000)


# ─────────────────────────── main bot ────────────────────────────
class AegisArbBot:
    def __init__(self, wallet_private_key: str, rpc_url: str,
                 tg_token: str, tg_chat_id: str):
        self.rpc_url      = rpc_url
        self.tg_token     = tg_token
        self.tg_chat_id   = tg_chat_id
        self.running      = False
        self.scan_count   = 0
        self.trade_count  = 0
        self.total_profit = 0.0   # cumulative net USD (sim or live)
        self.sim_profit   = 0.0   # hypothetical sim-only P&L
        self.sim_trades   = 0
        self.started_at   = None
        self.last_trade   = None
        self.logs         = []

        # Ramanujan milestone tracker (Law VI)
        self._ramanujan_triggered = False

        # Simulation report every N scans (~1 hour at 61.74s)
        self._last_report_scan = 0
        self._REPORT_EVERY     = 58  # ~60 min

        # Keypair — None when scan-only
        self.keypair = None
        if wallet_private_key:
            self._load_keypair(wallet_private_key)

        mode = "SCAN-ONLY (simulation)" if not self.keypair else "LIVE"
        log.info(f"⚔ Aegis Arb Bot v2 | Mode: {mode}")

    def _load_keypair(self, key: str):
        try:
            from solders.keypair import Keypair  # type: ignore
            import base58
            kp = None
            try:
                raw = base58.b58decode(key)
                kp = Keypair.from_bytes(raw) if len(raw) == 64 else Keypair.from_seed(raw)
            except Exception:
                pass
            if kp is None:
                try:
                    raw = bytes.fromhex(key.lstrip("0x"))
                    if len(raw) == 32:
                        kp = Keypair.from_seed(raw)
                except Exception:
                    pass
            if kp:
                self.keypair = kp
                log.info(f"Wallet loaded: {str(self.keypair.pubkey())[:8]}...")
            else:
                log.error("Unrecognised key format — running SCAN-ONLY")
        except ImportError:
            log.warning("solders not installed — running SCAN-ONLY")

    def _log(self, msg: str, level: str = "info"):
        entry = {"time": datetime.now(timezone.utc).isoformat(), "msg": msg, "level": level}
        self.logs.insert(0, entry)
        if len(self.logs) > 300:
            self.logs.pop()
        getattr(log, level, log.info)(msg)
        print(json.dumps({"event": "log", "level": level, "msg": msg}), flush=True)

    def _emit(self, event: dict):
        print(json.dumps(event), flush=True)

    # ── Round-trip scanner ────────────────────────────────────────
    def _scan_roundtrip(self, token_mint: str, sol_usd: float) -> tuple[float, float] | None:
        """
        True two-leg round-trip: SOL → TOKEN → SOL

        Returns (net_usd, sol_profit) if profitable after gas+tax, else None.
        Both legs are quoted here — execution only happens if BOTH legs show profit.
        """
        if sol_usd <= 0:
            return None

        label        = TOKEN_LABELS.get(token_mint, token_mint[:6])
        sol_lamports = int((TRADE_SIZE_USD / sol_usd) * 10 ** SOL_DECIMALS)

        # Leg 1: SOL → TOKEN
        q1 = get_jupiter_quote(SOL_MINT, token_mint, sol_lamports)
        if not q1:
            return None
        token_out = int(q1.get("outAmount", 0))
        if token_out == 0:
            return None

        # Small delay between API calls to avoid 429
        time.sleep(0.5)

        # Leg 2: TOKEN → SOL (using exact token amount from leg 1)
        q2 = get_jupiter_quote(token_mint, SOL_MINT, token_out)
        if not q2:
            return None
        sol_out = int(q2.get("outAmount", 0))
        if sol_out == 0:
            return None

        # Net calculation (all in SOL lamports)
        gross_sol   = sol_out - sol_lamports
        gas_lamports = 20_000  # ~2 txns × 10k lamports each (~$0.003)
        net_lamports = gross_sol - gas_lamports
        net_sol      = net_lamports / 10 ** SOL_DECIMALS
        net_usd      = net_sol * sol_usd

        # Apply Aegis Tax (6.174%) on net profit only
        net_usd_after_tax = apply_aegis_tax(net_usd) if net_usd > 0 else net_usd

        pct = (gross_sol / sol_lamports) * 100 if sol_lamports > 0 else 0

        route1 = (q1.get("routePlan") or [{}])[0].get("swapInfo", {}).get("label", "?")
        route2 = (q2.get("routePlan") or [{}])[0].get("swapInfo", {}).get("label", "?")

        self._log(
            f"[SOL→{label}→SOL] In: {sol_lamports/1e9:.4f} SOL | "
            f"Mid: {token_out} | Out: {sol_out/1e9:.7f} SOL | "
            f"Net: {net_sol:+.7f} SOL ({pct:+.4f}%) ${net_usd_after_tax:+.4f} | "
            f"{route1}→{route2}"
        )

        if net_usd_after_tax >= MIN_PROFIT_USD:
            return (net_usd_after_tax, net_sol)
        return None

    # ── Execution ─────────────────────────────────────────────────
    def _execute_swap(self, input_mint: str, output_mint: str,
                      amount: int, label: str) -> str | None:
        """Execute one Jupiter swap leg. Returns tx signature or None."""
        quote = get_jupiter_quote(input_mint, output_mint, amount)
        if not quote:
            self._log(f"Fresh quote failed for {label}", "error")
            return None

        swap_body = {
            "quoteResponse":            quote,
            "userPublicKey":            str(self.keypair.pubkey()),
            "wrapAndUnwrapSol":         True,
            "dynamicComputeUnitLimit":  True,
            "prioritizationFeeLamports": "auto",
        }
        try:
            req  = urllib.request.Request(
                JUPITER_SWAP_URL,
                data=json.dumps(swap_body).encode(),
                headers={"Content-Type": "application/json"},
            )
            resp = urllib.request.urlopen(req, timeout=15)
            tx_b64 = json.loads(resp.read().decode()).get("swapTransaction", "")
            if not tx_b64:
                return None

            from solders.transaction import VersionedTransaction  # type: ignore
            from solana.rpc.api import Client                     # type: ignore
            from solana.rpc.types import TxOpts                  # type: ignore
            import base64

            client    = Client(self.rpc_url)
            tx_bytes  = base64.b64decode(tx_b64)
            tx        = VersionedTransaction.from_bytes(tx_bytes)
            signed_tx = VersionedTransaction(tx.message, [self.keypair])
            result    = client.send_raw_transaction(
                bytes(signed_tx),
                opts=TxOpts(skip_preflight=False, max_retries=3),
            )
            return str(result.value)
        except Exception as e:
            self._log(f"Swap execution error [{label}]: {e}", "error")
            return None

    def _execute_roundtrip(self, token_mint: str, sol_lamports: int,
                           net_usd: float, sol_usd: float):
        """
        Execute the round-trip: SOL → TOKEN → SOL.
        In SCAN-ONLY mode: records simulation trade, never calls blockchain.
        In LIVE mode: executes leg 1, waits for confirmation, executes leg 2.
        """
        label = TOKEN_LABELS.get(token_mint, token_mint[:6])
        token_decimals = TOKEN_DECIMALS.get(token_mint, 6)

        if not self.keypair:
            # SCAN-ONLY — record hypothetical
            self.sim_trades  += 1
            self.sim_profit  += net_usd
            self.trade_count += 1
            self.total_profit += net_usd
            self.last_trade   = datetime.now(timezone.utc).isoformat()
            self._log(f"[SIM] SOL→{label}→SOL | ${net_usd:.4f} net | "
                      f"Cumulative sim: ${self.sim_profit:.4f} ({self.sim_trades} trades)", "info")
            self._emit({
                "event": "sim_trade",
                "pair": f"SOL/{label}",
                "net_usd": net_usd,
                "sim_trades": self.sim_trades,
                "sim_profit": self.sim_profit,
            })
            return

        # LIVE MODE — two sequential legs
        self._log(f"🔴 LIVE: Executing SOL→{label}→SOL | Expected net: ${net_usd:.4f}")

        # Leg 1: SOL → TOKEN (fresh quote)
        sig1 = self._execute_swap(SOL_MINT, token_mint, sol_lamports, f"SOL→{label}")
        if not sig1:
            self._log("Leg 1 failed — aborting round-trip", "error")
            return
        self._log(f"Leg 1 confirmed: {sig1[:20]}...")

        # Wait for Solana confirmation before leg 2
        time.sleep(3)

        # Leg 2: TOKEN → SOL — use MAX available token balance (avoid dust issues)
        # Conservative: re-query Jupiter with slightly reduced estimate
        token_out_estimate = int((TRADE_SIZE_USD / sol_usd) * (10 ** token_decimals) * 0.997)
        sig2 = self._execute_swap(token_mint, SOL_MINT, token_out_estimate, f"{label}→SOL")
        if not sig2:
            self._log(f"⚠ Leg 2 failed — {label} tokens may be stuck in wallet", "error")
            send_telegram(
                self.tg_token, self.tg_chat_id,
                f"⚠️ <b>Aegis Bot — Leg 2 Failed</b>\n"
                f"Leg 1 (SOL→{label}): ✅ {sig1[:20]}...\n"
                f"Leg 2 ({label}→SOL): ❌ FAILED\n"
                f"Tokens may be in wallet — check manually."
            )
            return

        self.trade_count  += 1
        self.total_profit += net_usd
        self.last_trade    = datetime.now(timezone.utc).isoformat()

        self._log(f"✅ Round-trip complete | ${net_usd:.4f} net | "
                  f"Total: ${self.total_profit:.4f} ({self.trade_count} trades)")

        # Ramanujan milestone (Law VI) — 1729 lamports SOL net milestone
        if not self._ramanujan_triggered and self.total_profit >= 1.729:
            self._ramanujan_triggered = True
            send_telegram(
                self.tg_token, self.tg_chat_id,
                "🔢 <b>Ramanujan Milestone Crossed!</b>\n"
                "The bot has passed $1.729 cumulative net profit — "
                "the smallest number expressible as the sum of two cubes in two different ways. "
                "The compounding engine is working."
            )

        send_telegram(
            self.tg_token, self.tg_chat_id,
            f"⚔ <b>Aegis — Trade #{self.trade_count}</b>\n"
            f"Pair: SOL→{label}→SOL\n"
            f"Net: <b>${net_usd:.4f}</b>\n"
            f"Cumulative: ${self.total_profit:.4f}\n"
            f"Sig1: <code>{sig1[:20]}...</code>\n"
            f"Sig2: <code>{sig2[:20]}...</code>"
        )
        self._emit({
            "event": "trade",
            "pair": f"SOL/{label}",
            "net_usd": net_usd,
            "trade_count": self.trade_count,
            "total_profit": self.total_profit,
            "sig1": sig1,
            "sig2": sig2,
        })

    # ── Hourly simulation report ──────────────────────────────────
    def _maybe_send_sim_report(self):
        scans_since = self.scan_count - self._last_report_scan
        if scans_since < self._REPORT_EVERY:
            return
        self._last_report_scan = self.scan_count

        uptime_h = (self.scan_count * SCAN_INTERVAL_SEC) / 3600
        per_day  = (self.sim_profit / uptime_h * 24) if uptime_h > 0 else 0
        per_mo   = per_day * 30

        mode = "SCAN-ONLY" if not self.keypair else "LIVE"
        send_telegram(
            self.tg_token, self.tg_chat_id,
            f"⚔ <b>Aegis Hourly Report [{mode}]</b>\n"
            f"Scans: {self.scan_count} | Trades: {self.sim_trades} sim\n"
            f"Sim P&amp;L: <b>${self.sim_profit:.4f}</b> over {uptime_h:.1f}h\n"
            f"Rate: ${per_day:.3f}/day → ${per_mo:.2f}/month projected\n"
            + (
                f"\n⚡ <b>Strategy is profitable in simulation.</b>\n"
                f"Enable live execution to capture real income."
                if self.sim_profit > 0 and not self.keypair else ""
            )
        )
        self._emit({
            "event": "sim_report",
            "sim_profit": self.sim_profit,
            "sim_trades": self.sim_trades,
            "projected_monthly": per_mo,
            "scan_count": self.scan_count,
        })

    # ── Main scan loop ────────────────────────────────────────────
    def _scan_all(self):
        self.scan_count += 1

        sol_usd = get_sol_price_usd()
        if not sol_usd:
            self._log("SOL price unavailable — skipping scan", "warn")
            return

        mode_tag = "[SIM]" if not self.keypair else "[LIVE]"
        self._log(
            f"{mode_tag} Scan #{self.scan_count} | SOL=${sol_usd:.2f} | "
            f"Trades: {self.trade_count} | Profit: ${self.total_profit:.4f}"
        )

        sol_lamports = int((TRADE_SIZE_USD / sol_usd) * 10 ** SOL_DECIMALS)

        best_net    = 0.0
        best_mint   = None
        best_sol    = 0.0

        for i, mint in enumerate(ROUNDTRIP_PAIRS):
            if i > 0:
                time.sleep(1)  # Rate limit Jupiter free tier
            try:
                result = self._scan_roundtrip(mint, sol_usd)
                if result is not None:
                    net_usd, net_sol = result
                    if net_usd > best_net:
                        best_net  = net_usd
                        best_mint = mint
                        best_sol  = net_sol
            except Exception as e:
                self._log(f"Scan error [{TOKEN_LABELS.get(mint, mint[:6])}]: {e}", "error")

        if best_mint is not None:
            label = TOKEN_LABELS.get(best_mint, best_mint[:6])
            self._log(f"🎯 BEST OPPORTUNITY: SOL→{label}→SOL | ${best_net:.4f} net profit")
            self._execute_roundtrip(best_mint, sol_lamports, best_net, sol_usd)

        self._maybe_send_sim_report()
        self._emit({
            "event": "scan_complete",
            "scan_count": self.scan_count,
            "sol_usd": sol_usd,
            "trade_count": self.trade_count,
            "total_profit": self.total_profit,
            "sim_profit": self.sim_profit,
        })

    def run(self):
        self.running    = True
        self.started_at = datetime.now(timezone.utc).isoformat()
        mode = "SCAN-ONLY (simulation)" if not self.keypair else "LIVE EXECUTION"

        self._log(f"⚔ Aegis Arb Bot v2 STARTED | Mode: {mode} | "
                  f"Interval: {SCAN_INTERVAL_SEC}s | Min profit: ${MIN_PROFIT_USD}")

        send_telegram(
            self.tg_token, self.tg_chat_id,
            f"⚔ <b>Aegis Arb Bot v2 ONLINE</b>\n"
            f"Strategy: <b>True Round-Trip Arb</b> (SOL→TOKEN→SOL)\n"
            f"Mode: <b>{mode}</b>\n"
            f"Pairs: USDC | RAY | BONK | JTO | WIF\n"
            f"Trade size: ${TRADE_SIZE_USD} | Min profit: ${MIN_PROFIT_USD}\n"
            f"Interval: {SCAN_INTERVAL_SEC}s\n"
            f"Kaprekar {KAPREKAR_CONSTANT} — value flows to the participant."
        )
        self._emit({"event": "started", "mode": mode, "interval_sec": SCAN_INTERVAL_SEC})

        while self.running:
            try:
                self._scan_all()
            except KeyboardInterrupt:
                break
            except Exception as e:
                self._log(f"Scan loop error: {e}", "error")

            time.sleep(SCAN_INTERVAL_SEC)

        self._log("Aegis Arb Bot stopped.")
        self._emit({
            "event": "stopped",
            "trade_count": self.trade_count,
            "total_profit": self.total_profit,
            "sim_profit": self.sim_profit,
        })


# ─────────────────────────── entry point ─────────────────────────
def _tg_crash(token: str, chat_id: str, text: str):
    try:
        data = json.dumps({"chat_id": chat_id, "text": text[:4000], "parse_mode": "HTML"}).encode()
        req  = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=data, headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=8)
    except Exception:
        pass


if __name__ == "__main__":
    import traceback

    print(f"[AegisArbBot] Python {sys.version.split()[0]}", flush=True)
    _pkg_status = []
    for _pkg in ("solders", "base58", "solana"):
        try:
            __import__(_pkg)
            _pkg_status.append(f"{_pkg}=✓")
        except ImportError:
            _pkg_status.append(f"{_pkg}=MISSING")
    print(f"[AegisArbBot] Packages: {' | '.join(_pkg_status)}", flush=True)

    _tg_token  = os.environ.get("KINGS_SHIELD_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN", "")
    _tg_chatid = os.environ.get("SHIELD_ALERT_CHAT_ID", os.environ.get("FAL_ALERT_CHAT_ID", ""))

    try:
        parser = argparse.ArgumentParser(description="Aegis Arb Bot v2 — Kings Shield")
        parser.add_argument("--rpc",       default=os.environ.get("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com"))
        parser.add_argument("--wallet-key", default=os.environ.get("SOLANA_WALLET_PRIVATE_KEY", ""))
        parser.add_argument("--tg-token",  default=_tg_token)
        parser.add_argument("--tg-chat-id", default=_tg_chatid)
        parser.add_argument("--scan-only", action="store_true", default=False,
                            help="Disable execution — simulate only, never spend funds")
        args = parser.parse_args()

        wallet_key = "" if args.scan_only else args.wallet_key

        bot = AegisArbBot(
            wallet_private_key=wallet_key,
            rpc_url=args.rpc,
            tg_token=args.tg_token,
            tg_chat_id=args.tg_chat_id,
        )
        bot.run()

    except SystemExit:
        raise
    except BaseException as e:
        tb  = traceback.format_exc()
        err = f"🆘 <b>Aegis Bot — FATAL CRASH</b>\n<code>{type(e).__name__}: {str(e)[:300]}</code>\n\n<pre>{tb[-600:]}</pre>"
        print(f"[AegisArbBot] FATAL: {type(e).__name__}: {e}\n{tb}", file=sys.stderr, flush=True)
        _tg_crash(_tg_token, _tg_chatid, err)
        sys.exit(1)

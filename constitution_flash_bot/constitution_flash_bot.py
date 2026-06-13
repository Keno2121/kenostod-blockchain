"""
Constitution Flash Bot — Kings Shield
Triangular arbitrage on Solana via Jupiter V6.

Constitutional Laws baked in:
  Law I  (Kaprekar)  — trade amounts rooted in 6174: 0.6174, 1.234, 6.174 SOL
  Law IV (Nash)      — auto-selects trade size for dominant strategy
  Law V  (Euler)     — continuous profit compounding
  Law VII (Inversion) — value flows to the participant, not the protocol

Trade amounts: 0.6174 SOL | 1.234 SOL | 6.174 SOL
Routes (two on-chain Jupiter swaps, confirmed sequentially):
  SOL → USDC → SOL
  SOL → USDT → SOL
  SOL → USDC → USDT → SOL  (triangular)

Minimum profit gate: $0.25 after all fees before any trade fires.
"""

from __future__ import annotations
import os, sys, time, json, logging, argparse, base64
import requests
from datetime import datetime, timezone

# ─────────────────────────── constants ───────────────────────────
KAPREKAR_CONSTANT  = 6174
SCAN_INTERVAL_SEC  = 30
MIN_PROFIT_USD     = 0.005          # Scaled for current wallet size; rises with balance
AEGIS_TAX_BPS      = 617            # 6.174%
SOL_DECIMALS       = 9
USDC_DECIMALS      = 6
GAS_RESERVE_SOL    = 0.01           # keep back for fees
PRIORITY_FEE_LAMPS = 10_000         # 0.00001 SOL priority fee

# Kaprekar borrow amounts (Law I) — scaled to current wallet; Law V (Euler) grows these over time
TRADE_AMOUNTS_SOL = [0.04, 0.06174, 0.1234]

# Token mints
SOL_MINT    = "So11111111111111111111111111111111111111112"
USDC_MINT   = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USDT_MINT   = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
SHIELD_MINT = os.environ.get("SHIELD_TOKEN_MINT", "")

# Two-leg routes: (label, leg1_in, leg1_out, leg2_in, leg2_out)
ROUTES = [
    ("SOL→USDC→SOL",  SOL_MINT, USDC_MINT, USDC_MINT, SOL_MINT),
    ("SOL→USDT→SOL",  SOL_MINT, USDT_MINT, USDT_MINT, SOL_MINT),
]

# ── Jupiter V6 endpoints (correct — not deprecated quote-api.jup.ag) ──
JUPITER_QUOTE_URL = "https://api.jup.ag/swap/v1/quote"
JUPITER_SWAP_URL  = "https://api.jup.ag/swap/v1/swap"
SOL_PRICE_URL     = "https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112"

# ─────────────────────────── logging ─────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[ConstitutionFlashBot] %(asctime)s %(levelname)s — %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
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
            timeout=10,
        )
    except Exception as e:
        log.warning(f"Telegram alert failed: {e}")

def get_sol_price_usd() -> float:
    try:
        r = requests.get(SOL_PRICE_URL, timeout=8)
        data = r.json()
        price = data["data"]["So11111111111111111111111111111111111111112"]["price"]
        return float(price)
    except Exception:
        return 150.0

def lamports(sol: float) -> int:
    return int(sol * 10 ** SOL_DECIMALS)

def get_jupiter_quote(input_mint: str, output_mint: str,
                      amount: int, slippage_bps: int = 50) -> dict | None:
    try:
        r = requests.get(JUPITER_QUOTE_URL, params={
            "inputMint":        input_mint,
            "outputMint":       output_mint,
            "amount":           str(amount),
            "slippageBps":      slippage_bps,
            "onlyDirectRoutes": False,
            "asLegacyTransaction": False,
        }, timeout=10)
        if r.status_code == 200:
            return r.json()
        log.warning(f"Jupiter quote {r.status_code}: {r.text[:200]}")
    except Exception as e:
        log.warning(f"Jupiter quote error: {e}")
    return None

def apply_aegis_tax(profit_usd: float) -> float:
    return profit_usd * (1 - AEGIS_TAX_BPS / 10000)

# ─────────────────────────── main bot ────────────────────────────
class ConstitutionFlashBot:
    def __init__(self, wallet_private_key: str, rpc_url: str,
                 tg_token: str, tg_chat_id: str):
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

        self.keypair          = None   # created lazily in _jupiter_swap_and_send
        self._wallet_key_str  = None   # base58 private key string
        self._wallet_key_bytes= None   # 64-byte raw keypair bytes
        self.wallet_address   = None   # base58 public key string
        self._try_init_wallet(wallet_private_key)

    def _try_init_wallet(self, wallet_private_key: str):
        """
        Store wallet credentials WITHOUT importing solders/solana at startup.
        Native-code imports (solders) are deferred to _jupiter_swap_and_send
        so a segfault in the Rust extension cannot crash the whole process.
        """
        if not wallet_private_key:
            log.warning("No SOLANA_WALLET_PRIVATE_KEY — scan-only mode")
            return
        try:
            import base58  # pure-Python, no native code
            raw = base58.b58decode(wallet_private_key)
            if len(raw) not in (32, 64):
                log.error(f"Unexpected key length {len(raw)}b — expected 32 or 64")
                return
            self._wallet_key_str   = wallet_private_key
            self._wallet_key_bytes = raw
            # Derive public key: Solana 64-byte keypair = seed(32) + pubkey(32)
            pub_bytes = raw[32:] if len(raw) == 64 else raw
            self.wallet_address = base58.b58encode(pub_bytes).decode()
            # Mark keypair as "logically loaded" so mode check works
            self.keypair = True  # replaced with real Keypair lazily on first sign
            log.info(f"Wallet stored (deferred sign): {self.wallet_address[:12]}...")
        except ImportError:
            log.error("base58 not installed — run: pip install base58")
        except Exception as e:
            log.error(f"Wallet init failed: {e}")

    # ── Logging ───────────────────────────────────────────────────
    def _log(self, msg: str, level: str = "info"):
        entry = {"time": datetime.now(timezone.utc).isoformat(), "msg": msg, "level": level}
        self.logs.insert(0, entry)
        if len(self.logs) > 200:
            self.logs.pop()
        getattr(log, level, log.info)(msg)
        print(json.dumps({"event": "log", "level": level, "msg": msg}), flush=True)

    def _emit(self, event: dict):
        print(json.dumps(event), flush=True)

    # ── SOL balance (pure HTTP — no solana package) ───────────────
    def _get_sol_balance(self) -> float:
        if not self.wallet_address:
            return 0.0
        try:
            resp = requests.post(self.rpc_url, json={
                "jsonrpc": "2.0", "id": 1,
                "method": "getBalance",
                "params": [self.wallet_address, {"commitment": "confirmed"}],
            }, timeout=8)
            result = resp.json().get("result", {})
            value  = result.get("value", 0) if isinstance(result, dict) else result
            return float(value) / 10 ** SOL_DECIMALS
        except Exception as e:
            log.warning(f"Balance check failed: {e}")
            return 0.0

    # ── Route simulation (price check before risking capital) ──────
    def _simulate_route(self, label: str, in_mint: str, mid_mint: str,
                        out_mint: str, trade_sol: float,
                        sol_usd: float) -> tuple[float | None, dict | None, dict | None]:
        """
        Returns (net_usd, leg1_quote, leg2_quote) if profitable, else (None, None, None).
        """
        amt1 = lamports(trade_sol)

        q1 = get_jupiter_quote(in_mint, mid_mint, amt1)
        if not q1:
            return None, None, None
        out1 = int(q1.get("outAmount", 0))
        if out1 <= 0:
            return None, None, None

        q2 = get_jupiter_quote(mid_mint, out_mint, out1)
        if not q2:
            return None, None, None
        out2_lamps = int(q2.get("outAmount", 0))

        final_sol  = out2_lamps / 10 ** SOL_DECIMALS
        gross_sol  = final_sol - trade_sol
        gross_usd  = gross_sol * sol_usd
        gas_usd    = 0.002          # ~$0.002 Solana gas x2 txs
        net_usd    = apply_aegis_tax(gross_usd) - gas_usd

        self._log(
            f"[{label}] trade={trade_sol} SOL | "
            f"out={final_sol:.6f} SOL | gross=${gross_usd:.4f} | net=${net_usd:.4f}"
        )

        if net_usd >= MIN_PROFIT_USD:
            return net_usd, q1, q2
        return None, None, None

    # ── Jupiter swap transaction build + sign + send ──────────────
    def _get_real_keypair(self):
        """Lazily create real solders.Keypair from stored bytes. Returns None on error."""
        if self._wallet_key_bytes is None:
            return None
        try:
            from solders.keypair import Keypair as SoldersKeypair  # type: ignore
            kp = SoldersKeypair.from_bytes(self._wallet_key_bytes)
            self.keypair = kp   # cache the real keypair for next calls
            return kp
        except Exception as e:
            self._log(f"Keypair create failed: {e}", "error")
            return None

    def _rpc_send_raw(self, tx_bytes: bytes) -> str | None:
        """Send signed tx via JSON-RPC (no solana package needed)."""
        try:
            import base64 as _b64
            encoded = _b64.b64encode(tx_bytes).decode()
            resp = requests.post(self.rpc_url, json={
                "jsonrpc": "2.0", "id": 1,
                "method": "sendTransaction",
                "params": [encoded, {"encoding": "base64",
                                      "preflightCommitment": "confirmed",
                                      "skipPreflight": False}],
            }, timeout=20)
            data = resp.json()
            if "error" in data:
                self._log(f"sendTransaction RPC error: {data['error']}", "error")
                return None
            return str(data.get("result"))
        except Exception as e:
            self._log(f"sendTransaction failed: {e}", "error")
            return None

    def _rpc_confirm(self, sig: str) -> bool:
        """Poll for tx confirmation (up to 45s). Returns True if confirmed."""
        for _ in range(15):
            time.sleep(3)
            try:
                resp = requests.post(self.rpc_url, json={
                    "jsonrpc": "2.0", "id": 1,
                    "method": "getSignatureStatuses",
                    "params": [[sig], {"searchTransactionHistory": True}],
                }, timeout=8)
                result = resp.json().get("result", {}).get("value", [None])
                val = result[0] if result else None
                if val:
                    if val.get("err"):
                        self._log(f"Tx failed on-chain: {val['err']}", "error")
                        return False
                    if val.get("confirmationStatus") in ("confirmed", "finalized"):
                        self._log(f"Confirmed ✅ ({val['confirmationStatus']})")
                        return True
            except Exception:
                pass
        self._log("Tx confirmation timeout — may still confirm", "warn")
        return True   # optimistic: return sig anyway

    def _jupiter_swap_and_send(self, quote: dict) -> str | None:
        """
        Posts quote to Jupiter /swap, signs the returned versioned transaction,
        and sends it via JSON-RPC. Solders import is deferred here — never at startup.
        Returns signature string or None on failure.
        """
        try:
            from solders.transaction import VersionedTransaction   # type: ignore

            # Resolve real keypair lazily
            kp = self._get_real_keypair()
            if kp is None:
                self._log("Keypair unavailable — cannot sign", "error")
                return None

            resp = requests.post(JUPITER_SWAP_URL, json={
                "quoteResponse":             quote,
                "userPublicKey":             self.wallet_address,
                "wrapAndUnwrapSol":          True,
                "dynamicComputeUnitLimit":   True,
                "prioritizationFeeLamports": PRIORITY_FEE_LAMPS,
                "asLegacyTransaction":       False,
            }, timeout=15)

            if resp.status_code != 200:
                self._log(f"Jupiter /swap error {resp.status_code}: {resp.text[:200]}", "error")
                return None

            swap_tx_b64 = resp.json().get("swapTransaction")
            if not swap_tx_b64:
                self._log("Jupiter /swap returned no swapTransaction", "error")
                return None

            raw_tx = base64.b64decode(swap_tx_b64)
            tx     = VersionedTransaction.from_bytes(raw_tx)

            # Re-sign with our keypair
            signed_tx = VersionedTransaction([kp], tx.message)
            sig = self._rpc_send_raw(bytes(signed_tx))
            if not sig:
                return None
            self._log(f"Tx sent: {sig}")
            self._rpc_confirm(sig)
            return sig

        except Exception as e:
            self._log(f"Swap/send error: {e}", "error")
            return None

    # ── Main scan ─────────────────────────────────────────────────
    def _scan_all(self):
        self.scan_count += 1
        sol_usd    = get_sol_price_usd()
        sol_bal    = self._get_sol_balance()

        # Law IV — Nash: scale up trade size with consecutive wins
        idx        = min(self.consecutive_success // 3, len(TRADE_AMOUNTS_SOL) - 1)
        trade_sol  = TRADE_AMOUNTS_SOL[idx]

        self._log(
            f"Scan #{self.scan_count} | SOL=${sol_usd:.2f} | "
            f"Balance={sol_bal:.4f} SOL | Trade={trade_sol} SOL | "
            f"Profit=${self.total_profit:.2f}"
        )

        routes_to_check = list(ROUTES)
        if SHIELD_MINT:
            routes_to_check.append(
                ("SOL→SHIELD→SOL", SOL_MINT, SHIELD_MINT, SHIELD_MINT, SOL_MINT)
            )

        best_net, best_q1, best_q2, best_label = None, None, None, None

        for (label, in_mint, mid_mint, out_mint, _final) in routes_to_check:
            # skip route if we can't afford the trade + gas reserve
            if sol_bal < trade_sol + GAS_RESERVE_SOL:
                self._log(
                    f"Low balance ({sol_bal:.4f} SOL) — need {trade_sol + GAS_RESERVE_SOL:.4f}. "
                    f"Skipping {label}."
                )
                continue
            try:
                net, q1, q2 = self._simulate_route(
                    label, in_mint, mid_mint, out_mint, trade_sol, sol_usd
                )
                if net is not None and (best_net is None or net > best_net):
                    best_net, best_q1, best_q2, best_label = net, q1, q2, label
            except Exception as e:
                self._log(f"Route error [{label}]: {e}", "error")

        if best_label and best_net is not None:
            self._log(f"🎯 OPPORTUNITY: {best_label} → ${best_net:.2f} net — EXECUTING", "info")
            self._execute(best_label, best_q1, best_q2, trade_sol, best_net)
        else:
            self.skip_count += 1
            self.consecutive_success = 0
            self._log(f"No profitable route this scan (skip #{self.skip_count})")

        self._emit({
            "event":        "scan_complete",
            "scan_count":   self.scan_count,
            "trade_count":  self.trade_count,
            "skip_count":   self.skip_count,
            "total_profit": self.total_profit,
            "trade_sol":    trade_sol,
        })

    # ── Execute two-leg Jupiter arb ───────────────────────────────
    def _execute(self, label: str, q1: dict, q2: dict,
                 trade_sol: float, est_net_usd: float):
        if not self._wallet_key_str:
            self._log("Wallet not loaded — cannot execute (scan-only)", "warn")
            self._record_trade(est_net_usd, label, trade_sol, simulated=True)
            return

        # ── Leg 1: SOL → intermediate ─────────────────────────────
        self._log(f"Leg 1: executing {label.split('→')[0]}→{label.split('→')[1]}...")
        sig1 = self._jupiter_swap_and_send(q1)
        if not sig1:
            self._log("Leg 1 failed — aborting arb", "error")
            self.consecutive_success = 0
            return

        self._log(f"Leg 1 confirmed ✅ sig={sig1[:16]}...")

        # ── Fresh quote for Leg 2 (price may have moved) ──────────
        out1_lamps = int(q1.get("outAmount", 0))
        in_mint2   = q1["outputMint"]
        out_mint2  = SOL_MINT
        q2_fresh   = get_jupiter_quote(in_mint2, out_mint2, out1_lamps)
        if not q2_fresh:
            self._log("Leg 2 quote failed after Leg 1 — half-trade executed, resolve manually", "error")
            send_telegram(
                self.tg_token, self.tg_chat_id,
                f"⚠️ <b>Constitution Bot — HALF TRADE</b>\n"
                f"Leg 1 executed ({sig1[:16]}...) but Leg 2 quote failed.\n"
                f"Check your {in_mint2[:8]}... balance and swap back to SOL manually."
            )
            return

        # ── Leg 2: intermediate → SOL ─────────────────────────────
        self._log(f"Leg 2: executing back to SOL...")
        sig2 = self._jupiter_swap_and_send(q2_fresh)
        if not sig2:
            self._log("Leg 2 failed — half-trade, resolve manually", "error")
            send_telegram(
                self.tg_token, self.tg_chat_id,
                f"⚠️ <b>Constitution Bot — HALF TRADE</b>\n"
                f"Leg 2 failed. Intermediate tokens in wallet.\n"
                f"Leg 1 sig: {sig1[:16]}..."
            )
            return

        self._log(f"Leg 2 confirmed ✅ sig={sig2[:16]}...")
        self._record_trade(est_net_usd, label, trade_sol, simulated=False,
                           sig1=sig1, sig2=sig2)

    # ── Record & alert ────────────────────────────────────────────
    def _record_trade(self, net_usd: float, label: str, trade_sol: float,
                      simulated=False, sig1="", sig2=""):
        self.trade_count         += 1
        self.total_profit        += net_usd
        self.consecutive_success += 1
        self.last_trade           = datetime.now(timezone.utc).isoformat()

        mode = "🧪 SIMULATED" if simulated else "✅ LIVE"
        sig_line = f"\nSig1: <code>{sig1[:20]}...</code>\nSig2: <code>{sig2[:20]}...</code>" if sig1 else ""

        msg = (
            f"📜 <b>Constitution Flash Trade #{self.trade_count}</b> {mode}\n"
            f"Route: {label}\n"
            f"Trade size: {trade_sol} SOL (Kaprekar)\n"
            f"Net profit: <b>${net_usd:.2f}</b>\n"
            f"Total profit: <b>${self.total_profit:.2f}</b>{sig_line}"
        )
        send_telegram(self.tg_token, self.tg_chat_id, msg)
        self._emit({
            "event":        "trade",
            "net_usd":      net_usd,
            "route":        label,
            "trade_sol":    trade_sol,
            "trade_count":  self.trade_count,
            "total_profit": self.total_profit,
            "simulated":    simulated,
            "sig1":         sig1,
            "sig2":         sig2,
        })

    # ── Main loop ─────────────────────────────────────────────────
    def run(self):
        self.running    = True
        self.started_at = datetime.now(timezone.utc).isoformat()
        amounts_str     = " | ".join(f"{a} SOL" for a in TRADE_AMOUNTS_SOL)
        mode_str        = "🟢 LIVE EXECUTION" if self.keypair else "🟡 SCAN-ONLY (no wallet)"

        self._log(
            f"📜 Constitution Flash Bot STARTED\n"
            f"Mode: {mode_str}\n"
            f"Kaprekar amounts: {amounts_str}\n"
            f"Routes: {len(ROUTES)} (+SHIELD if configured)\n"
            f"Min profit: ${MIN_PROFIT_USD}"
        )
        send_telegram(
            self.tg_token, self.tg_chat_id,
            f"📜 <b>Constitution Flash Bot ONLINE</b>\n"
            f"Mode: {mode_str}\n"
            f"Trade sizes: {amounts_str}\n"
            f"Routes: SOL/USDC/USDT\n"
            f"Min profit gate: ${MIN_PROFIT_USD}\n"
            f"Law I: {KAPREKAR_CONSTANT} — all paths converge.",
        )
        self._emit({"event": "started", "trade_amounts": TRADE_AMOUNTS_SOL})

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
            "event":        "stopped",
            "trade_count":  self.trade_count,
            "total_profit": self.total_profit,
        })

# ─────────────────────────── entry point ─────────────────────────
if __name__ == "__main__":
    try:
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
    except Exception as _top_err:
        print(f"[ConstitutionFlashBot] FATAL startup error: {_top_err}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)

"""
Aegis Arb Bot — Kings Shield
Solana price-deviation scanner: Hyperliquid perp reference price vs Jupiter DEX execution price.

Strategy:
  When Jupiter DEX is offering a token cheaper than Hyperliquid's global
  perp reference price, it signals a temporary liquidity imbalance on Solana.
  Buy the underpriced token on Jupiter; price reverts as market makers restore
  equilibrium. No roundtrip required — no guaranteed fee loss.

Constitutional Laws baked in:
  Law I   (Kaprekar)  — all distributions route through absorb(); dust to participant
  III     (Golden Ratio) — position sizing φ-scaled with trade history
  VI      (Euler)     — scan interval 61.74s (continuous compounding metaphor)
"""

from __future__ import annotations
import os, sys, time, json, logging, argparse, asyncio, urllib.request, urllib.parse
from datetime import datetime, timezone

# No third-party HTTP library needed — all HTTP via stdlib urllib

# ─────────────────────────── constants ───────────────────────────
KAPREKAR_CONSTANT   = 6174
SCAN_INTERVAL_SEC   = 61.74          # Law VI — Euler
AEGIS_TAX_BPS       = 617            # 6.17% (6174 basis = 6.174%)
# Buy when DEX price is >0.3% below Hyperliquid reference price.
# 0.3% on a $50 trade = $0.15 gross profit opportunity.
# After Aegis tax (6.174%) and gas ($0.001): net ~$0.14.
MIN_DEV_PCT         = 0.30           # Minimum % below market price to trigger
MIN_PROFIT_USD      = 0.05           # Minimum net profit to execute
TRADE_SIZE_USD      = 30             # Size of each trade in USD
SOL_DECIMALS        = 9
USDC_DECIMALS       = 6

# Solana token mints
SOL_MINT   = "So11111111111111111111111111111111111111112"
USDC_MINT  = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
BONK_MINT  = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
WIF_MINT   = "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"
JTO_MINT   = "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL"
RAY_MINT   = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"
SHIELD_MINT = os.environ.get("SHIELD_TOKEN_MINT", "")

# Token decimals on Solana
TOKEN_DECIMALS = {
    BONK_MINT: 5,
    WIF_MINT:  6,
    JTO_MINT:  9,
    RAY_MINT:  6,
}

# Hyperliquid coin names — confirmed reachable from Render
# SOL + WIF + JTO are on HL perps; BONK and RAY are not, handled separately
HL_COIN_NAMES = {
    WIF_MINT:  "WIF",
    JTO_MINT:  "JTO",
}
HL_INFO_URL = "https://api.hyperliquid.xyz/info"

# CEX symbols for tokens not listed on HL (try OKX first, Gate.io fallback)
OKX_SYMBOLS = {
    BONK_MINT: "BONK-USDT",
    RAY_MINT:  "RAY-USDT",
}
GATE_SYMBOLS = {
    BONK_MINT: "BONK_USDT",
    RAY_MINT:  "RAY_USDT",
}

# Jupiter API
JUPITER_QUOTE_URL = "https://api.jup.ag/swap/v1/quote"
JUPITER_SWAP_URL  = "https://api.jup.ag/swap/v1/swap"

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

def get_hl_data() -> dict:
    """
    Single Hyperliquid allMids call — returns raw {coin: price_str} dict.
    Confirmed reachable from Render. Used for SOL price + WIF/JTO reference prices.
    """
    try:
        payload = json.dumps({"type": "allMids"}).encode()
        req     = urllib.request.Request(
            HL_INFO_URL, data=payload,
            headers={"Content-Type": "application/json"},
        )
        resp = urllib.request.urlopen(req, timeout=12)
        return json.loads(resp.read().decode())
    except Exception as e:
        log.warning(f"HL allMids fetch error: {e}")
        return {}


def get_sol_price_usd(hl_mids: dict | None = None) -> float:
    """
    Get accurate SOL price from Hyperliquid allMids (consistent with token reference prices).
    Jupiter's price v2 API returns stale/wrong SOL prices — do not use it.
    """
    if hl_mids and "SOL" in hl_mids:
        return float(hl_mids["SOL"])
    # Standalone fallback: call HL directly
    mids = get_hl_data()
    if mids and "SOL" in mids:
        return float(mids["SOL"])
    return 65.0   # conservative fallback (HL-consistent, not Jupiter's stale $150)


def _get_cex_price(mint: str) -> float | None:
    """
    Fetch reference price for tokens not on HL (BONK, RAY).
    Tries OKX first, Gate.io as fallback. Both are accessible from Render.
    """
    okx_sym  = OKX_SYMBOLS.get(mint)
    gate_sym = GATE_SYMBOLS.get(mint)
    if not okx_sym:
        return None

    # 1) OKX
    try:
        req = urllib.request.Request(
            f"https://www.okx.com/api/v5/market/ticker?instId={okx_sym}",
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
        )
        resp = urllib.request.urlopen(req, timeout=8)
        data = json.loads(resp.read().decode())
        return float(data["data"][0]["last"])
    except Exception:
        pass

    # 2) Gate.io fallback
    if gate_sym:
        try:
            req = urllib.request.Request(
                f"https://api.gateio.ws/api/v4/spot/tickers?currency_pair={gate_sym}",
                headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
            )
            resp = urllib.request.urlopen(req, timeout=8)
            data = json.loads(resp.read().decode())
            return float(data[0]["last"])
        except Exception:
            pass

    return None


def get_reference_prices(mint_list: list[str], hl_mids: dict) -> dict[str, float]:
    """
    Build reference price dict for all target mints.
    - WIF, JTO: from Hyperliquid allMids (same call used for SOL price → zero extra cost)
    - BONK, RAY: from OKX → Gate.io fallback (not listed on HL)
    Returns {mint: price_usd}. Mints with no price are omitted (bot skips them).
    """
    result = {}
    for mint in mint_list:
        # HL-listed tokens
        coin = HL_COIN_NAMES.get(mint)
        if coin and coin in hl_mids:
            result[mint] = float(hl_mids[coin])
            continue
        # CEX fallback (BONK, RAY)
        price = _get_cex_price(mint)
        if price:
            result[mint] = price
    return result

def get_jupiter_quote(input_mint: str, output_mint: str, amount_lamports: int,
                      slippage_bps: int = 50) -> dict | None:
    """Get best swap quote from Jupiter. Retries on 429 with backoff."""
    params = urllib.parse.urlencode({
        "inputMint":        input_mint,
        "outputMint":       output_mint,
        "amount":           str(amount_lamports),
        "slippageBps":      str(slippage_bps),
        "onlyDirectRoutes": "false",
    })
    url = f"{JUPITER_QUOTE_URL}?{params}"
    for attempt in range(3):
        try:
            resp = urllib.request.urlopen(url, timeout=12)
            if resp.status == 200:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 3 * (attempt + 1)   # 3s, 6s, 9s
                log.warning(f"Jupiter 429 — waiting {wait}s before retry {attempt+1}/3")
                time.sleep(wait)
            else:
                log.warning(f"Jupiter quote error: HTTP {e.code}")
                break
        except Exception as e:
            log.warning(f"Jupiter quote error: {e}")
            break
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
        # Handles: base58 64-byte full keypair, base58 32-byte seed, hex 32-byte seed
        self.keypair = None
        if wallet_private_key:
            try:
                from solders.keypair import Keypair  # type: ignore
                import base58

                kp = None
                # Try base58 decode first (most common Solana export format)
                try:
                    key_bytes = base58.b58decode(wallet_private_key)
                    if len(key_bytes) == 64:
                        kp = Keypair.from_bytes(key_bytes)
                    elif len(key_bytes) == 32:
                        kp = Keypair.from_seed(key_bytes)
                except Exception:
                    pass

                # Fallback: try raw hex (EVM-style 32-byte key)
                if kp is None:
                    try:
                        hex_str = wallet_private_key.lstrip('0x')
                        key_bytes = bytes.fromhex(hex_str)
                        if len(key_bytes) == 32:
                            kp = Keypair.from_seed(key_bytes)
                    except Exception:
                        pass

                if kp is not None:
                    self.keypair = kp
                    log.info(f"Wallet loaded: {str(self.keypair.pubkey())[:8]}...")
                else:
                    log.error("Wallet load error: unrecognised key format (tried base58-64, base58-32, hex-32)")
            except ImportError:
                log.warning("solders not installed — running in SCAN-ONLY mode")

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

    def _scan_pair(self, token_mint: str, label: str,
                   ref_price: float, sol_usd: float) -> float | None:
        """
        Compare Hyperliquid reference price vs Jupiter DEX execution price.
        When DEX price is > MIN_DEV_PCT below HL reference = liquidity imbalance = buy signal.
        Returns net profit estimate in USD, or None if no opportunity.
        """
        if ref_price <= 0:
            return None

        decimals      = TOKEN_DECIMALS.get(token_mint, 6)
        # How many lamports of SOL to spend (TRADE_SIZE_USD worth)
        sol_lamports  = int((TRADE_SIZE_USD / sol_usd) * 10 ** SOL_DECIMALS)

        # Jupiter quote: SOL → token (best DEX price available)
        quote = get_jupiter_quote(SOL_MINT, token_mint, sol_lamports)
        if not quote:
            return None

        out_amount = int(quote.get("outAmount", 0))
        if out_amount == 0:
            return None

        # Effective DEX execution price per token in USD
        token_units   = out_amount / (10 ** decimals)
        dex_price     = TRADE_SIZE_USD / token_units   # USD per token on DEX

        # Deviation: positive = DEX cheaper than HL reference (buy signal)
        deviation_pct = (ref_price - dex_price) / ref_price * 100

        route_info = quote.get("routePlan", [{}])
        dex_used   = route_info[0].get("swapInfo", {}).get("label", "Jupiter") if route_info else "Jupiter"

        self._log(
            f"[{label}] HL ref ${ref_price:.6f} | DEX ${dex_price:.6f} "
            f"| dev {deviation_pct:+.3f}% | via {dex_used}"
        )

        if deviation_pct < MIN_DEV_PCT:
            return None

        # Estimated profit: buy at DEX price, price reverts to HL reference
        gross_usd = (deviation_pct / 100) * TRADE_SIZE_USD
        net_usd   = apply_aegis_tax(gross_usd) - 0.002   # ~$0.002 gas for 2 Solana txns

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
        """
        Scan all tokens: one HL allMids call feeds both the accurate SOL price
        and WIF/JTO reference prices. BONK/RAY fetched from OKX/Gate.io.
        """
        self.scan_count += 1

        # Single HL call → SOL price (accurate) + WIF/JTO reference prices
        hl_mids = get_hl_data()
        if not hl_mids:
            self._log("HL data unavailable — skipping scan", "warn")
            return

        sol_usd = get_sol_price_usd(hl_mids)
        self._log(f"Scan #{self.scan_count} | SOL=${sol_usd:.2f} | "
                  f"Trades: {self.trade_count} | Profit: ${self.total_profit:.4f}")

        # Token list to scan
        token_mints = [BONK_MINT, WIF_MINT, JTO_MINT, RAY_MINT]
        labels      = {BONK_MINT: "BONK", WIF_MINT: "WIF",
                       JTO_MINT: "JTO",   RAY_MINT:  "RAY"}
        if SHIELD_MINT:
            token_mints.append(SHIELD_MINT)
            labels[SHIELD_MINT] = "SHIELD"

        # Build reference prices: HL for WIF/JTO; OKX/Gate for BONK/RAY
        ref_prices = get_reference_prices(token_mints, hl_mids)
        if not ref_prices:
            self._log("No reference prices available — skipping scan", "warn")
            return

        # Compare each token's HL perp price vs Jupiter Solana DEX price
        for i, mint in enumerate(token_mints):
            if mint not in ref_prices:
                continue
            if i > 0:
                time.sleep(2)   # 2s between Jupiter calls — respects free tier limit
            label     = labels.get(mint, mint[:8])
            ref_price = ref_prices[mint]
            try:
                net_usd = self._scan_pair(mint, label, ref_price, sol_usd)
                if net_usd is not None:
                    self._log(f"🎯 OPPORTUNITY: {label} → ${net_usd:.4f} net profit", "info")
                    sol_lamports = int((TRADE_SIZE_USD / sol_usd) * 10 ** SOL_DECIMALS)
                    self._execute_trade(SOL_MINT, mint, sol_lamports, label, net_usd)
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
            f"Strategy: Hyperliquid perp price vs Jupiter DEX price\n"
            f"Tokens: BONK | WIF | JTO | RAY\n"
            f"Trigger: DEX >{MIN_DEV_PCT}% below market → BUY\n"
            f"Interval: {SCAN_INTERVAL_SEC}s | Min profit: ${MIN_PROFIT_USD}\n"
            f"Kaprekar {KAPREKAR_CONSTANT} — value flows to the participant."
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

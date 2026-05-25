#!/usr/bin/env python3
"""
Aegis Cross-Chain Relay
=======================
Monitors the King's Shield Aegis Tax treasury on Solana.
When accumulated SOL exceeds threshold → bridges to BSC → triggers KENOAutoBurn.

Flywheel Step:
  Solana (Aegis Tax SOL) → Wormhole/manual bridge → BSC (KENOAutoBurn)
  → PancakeSwap buys KENO → burned to 0xdead → supply ↓ price ↑

Setup:
  pip install solana web3 python-telegram-bot requests python-dotenv
  Set env vars in keno-arb-bots/.env (reuses same config)
"""

import os, time, json, logging, requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../keno-arb-bots/.env"))

# ── Config ────────────────────────────────────────────────────────────────
SOLANA_RPC         = os.getenv("SOLANA_RPC", "https://api.mainnet-beta.solana.com")
AEGIS_TREASURY_SOL = os.getenv("AEGIS_TREASURY_WALLET", "")   # Solana treasury pubkey
BSC_RPC            = os.getenv("BSC_RPC", "https://bsc-dataseed1.binance.org")
KENO_AUTOBURN_ADDR = os.getenv("KENO_AUTOBURN_CONTRACT", "")   # filled after deploy
RELAY_PRIVATE_KEY  = os.getenv("NEW_WALLET_PRIVATE_KEY", "")   # bot wallet signs BSC tx

TELEGRAM_TOKEN     = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID") or os.getenv("FAL_ALERT_CHAT_ID", "")

# Trigger burn when treasury holds ≥ this much SOL
BURN_THRESHOLD_SOL = float(os.getenv("AEGIS_BURN_THRESHOLD_SOL", "1.0"))
# Max slippage for PancakeSwap (5%)
MAX_SLIPPAGE_BPS   = 500
# Poll interval (seconds)
POLL_INTERVAL      = int(os.getenv("AEGIS_POLL_INTERVAL", "300"))  # 5 min

# ── Logging ───────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [AEGIS] %(levelname)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
log = logging.getLogger("aegis_relay")

# ── KENOAutoBurn ABI (minimal) ────────────────────────────────────────────
AUTOBURN_ABI = json.loads("""[
  {"name":"executeBurn","type":"function","stateMutability":"nonpayable",
   "inputs":[{"name":"minKenoOut","type":"uint256"}],"outputs":[]},
  {"name":"getBurnQuote","type":"function","stateMutability":"view",
   "inputs":[],"outputs":[{"name":"kenoOut","type":"uint256"}]},
  {"name":"stats","type":"function","stateMutability":"view","inputs":[],
   "outputs":[
     {"name":"_totalBurned","type":"uint256"},
     {"name":"_totalBnbUsed","type":"uint256"},
     {"name":"_burnCount","type":"uint256"},
     {"name":"_pendingBnb","type":"uint256"}
   ]}
]""")

# ── Telegram ──────────────────────────────────────────────────────────────
def tg(msg: str):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": msg, "parse_mode": "HTML"},
            timeout=10
        )
    except Exception as e:
        log.warning(f"Telegram error: {e}")

# ── Solana: Check Treasury Balance ────────────────────────────────────────
def get_sol_balance(pubkey: str) -> float:
    """Return SOL balance of a Solana wallet."""
    try:
        resp = requests.post(
            SOLANA_RPC,
            json={"jsonrpc": "2.0", "id": 1, "method": "getBalance",
                  "params": [pubkey]},
            timeout=10
        )
        data = resp.json()
        lamports = data.get("result", {}).get("value", 0)
        return lamports / 1e9
    except Exception as e:
        log.error(f"Solana RPC error: {e}")
        return 0.0

# ── BSC: Trigger Burn ─────────────────────────────────────────────────────
def trigger_keno_burn(w3, contract, relay_account) -> dict | None:
    """Get quote, then call executeBurn on KENOAutoBurn contract."""
    try:
        quote = contract.functions.getBurnQuote().call()
        if quote == 0:
            log.info("No BNB in AutoBurn contract yet.")
            return None

        # Apply slippage: minKenoOut = quote * (1 - slippage)
        min_keno = int(quote * (10000 - MAX_SLIPPAGE_BPS) / 10000)

        nonce = w3.eth.get_transaction_count(relay_account.address)
        gas_price = w3.eth.gas_price

        tx = contract.functions.executeBurn(min_keno).build_transaction({
            "from":     relay_account.address,
            "nonce":    nonce,
            "gas":      300_000,
            "gasPrice": int(gas_price * 1.2),
        })

        signed = relay_account.sign_transaction(tx)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        result = {
            "tx_hash":    tx_hash.hex(),
            "quote_keno": quote / 1e18,
            "min_keno":   min_keno / 1e18,
            "status":     receipt.status,
        }
        return result

    except Exception as e:
        log.error(f"BSC burn tx failed: {e}")
        return None

# ── Bridge Stub ───────────────────────────────────────────────────────────
def bridge_sol_to_bnb(sol_amount: float) -> bool:
    """
    STUB: Bridge SOL from Aegis treasury to BSC KENOAutoBurn contract.

    Production implementation options:
      A) Wormhole SDK — programmatic cross-chain transfer
      B) deBridge — REST API bridge
      C) Manual: alert operator via Telegram to manually bridge + send BNB

    For now: send Telegram alert for manual bridging.
    """
    msg = (
        f"🌉 <b>Aegis Bridge Alert</b>\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"Treasury holds <b>{sol_amount:.4f} SOL</b> ready to bridge.\n\n"
        f"Action required:\n"
        f"1. Bridge SOL → BNB (via Allbridge/deBridge)\n"
        f"2. Send BNB to KENOAutoBurn: <code>{KENO_AUTOBURN_ADDR}</code>\n"
        f"3. Relay will auto-trigger burn once BNB arrives.\n\n"
        f"<i>Auto-bridging via Wormhole SDK — coming in v2</i>"
    )
    tg(msg)
    log.info(f"Bridge alert sent for {sol_amount:.4f} SOL")
    return True  # v2 will return actual bridge success

# ── Main Loop ─────────────────────────────────────────────────────────────
def main():
    from web3 import Web3

    if not AEGIS_TREASURY_SOL:
        log.error("AEGIS_TREASURY_WALLET not set. Add it to your .env")
        return
    if not KENO_AUTOBURN_ADDR:
        log.error("KENO_AUTOBURN_CONTRACT not set. Deploy contract first.")
        return
    if not RELAY_PRIVATE_KEY:
        log.error("NEW_WALLET_PRIVATE_KEY not set.")
        return

    w3 = Web3(Web3.HTTPProvider(BSC_RPC))
    if not w3.is_connected():
        log.error("Cannot connect to BSC RPC")
        return

    relay_account = w3.eth.account.from_key(RELAY_PRIVATE_KEY)
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(KENO_AUTOBURN_ADDR),
        abi=AUTOBURN_ABI
    )

    log.info("═══════════════════════════════════════════")
    log.info("  Aegis Cross-Chain Relay — Starting")
    log.info(f"  Solana Treasury: {AEGIS_TREASURY_SOL}")
    log.info(f"  KENOAutoBurn:    {KENO_AUTOBURN_ADDR}")
    log.info(f"  Relay wallet:    {relay_account.address}")
    log.info(f"  Burn threshold:  {BURN_THRESHOLD_SOL} SOL")
    log.info(f"  Poll interval:   {POLL_INTERVAL}s")
    log.info("═══════════════════════════════════════════")

    tg(
        f"🛡️ <b>Aegis Relay Started</b>\n"
        f"Monitoring treasury: <code>{AEGIS_TREASURY_SOL[:8]}...{AEGIS_TREASURY_SOL[-4:]}</code>\n"
        f"Burn threshold: {BURN_THRESHOLD_SOL} SOL\n"
        f"<i>King's Shield → KENO Burn flywheel active</i>"
    )

    burn_session_count = 0
    burn_session_keno  = 0.0

    while True:
        try:
            now = datetime.now(timezone.utc).strftime("%H:%M UTC")

            # 1. Check Solana treasury
            sol_bal = get_sol_balance(AEGIS_TREASURY_SOL)
            log.info(f"[{now}] Aegis treasury: {sol_bal:.4f} SOL")

            if sol_bal >= BURN_THRESHOLD_SOL:
                log.info(f"Threshold reached ({sol_bal:.4f} SOL ≥ {BURN_THRESHOLD_SOL})")

                # 2. Bridge SOL → BNB (alert operator in v1, auto in v2)
                bridge_sol_to_bnb(sol_bal)

                # 3. Check if BNB is waiting in the AutoBurn contract
                pending_bnb_wei = w3.eth.get_balance(
                    Web3.to_checksum_address(KENO_AUTOBURN_ADDR)
                )
                pending_bnb = pending_bnb_wei / 1e18

                if pending_bnb > 0.001:  # > 0.001 BNB (covers gas)
                    log.info(f"  BNB ready in AutoBurn: {pending_bnb:.4f} BNB — executing burn...")
                    result = trigger_keno_burn(w3, contract, relay_account)

                    if result and result.get("status") == 1:
                        keno_burned = result.get("quote_keno", 0)
                        burn_session_count += 1
                        burn_session_keno  += keno_burned

                        log.info(f"  ✅ Burn SUCCESS — {keno_burned:.0f} KENO burned")
                        tg(
                            f"🔥 <b>KENO Auto-Burn Executed!</b>\n"
                            f"━━━━━━━━━━━━━━━━━━\n"
                            f"♻️ BNB In:      {pending_bnb:.4f} BNB\n"
                            f"🔥 KENO Burned: {keno_burned:,.0f} KENO\n"
                            f"📊 Session total: {burn_session_keno:,.0f} KENO burned\n"
                            f"🔗 <a href='https://bscscan.com/tx/{result['tx_hash']}'>BscScan</a>\n\n"
                            f"<i>KENO supply ↓ → Price ↑ → SHIELD narrative strengthens 🛡️</i>"
                        )
                    else:
                        log.warning(f"  Burn failed or pending: {result}")
                else:
                    log.info(f"  Waiting for BNB in AutoBurn contract ({pending_bnb:.4f} BNB)")

            # Get updated stats
            try:
                s = contract.functions.stats().call()
                log.info(
                    f"  AutoBurn stats: {s[2]} burns | "
                    f"{s[0]/1e18:,.0f} KENO total burned | "
                    f"{s[1]/1e18:.4f} BNB used"
                )
            except Exception:
                pass

        except KeyboardInterrupt:
            log.info("Relay stopped by user.")
            tg(f"⏹️ Aegis Relay stopped. Session: {burn_session_keno:,.0f} KENO burned.")
            break
        except Exception as e:
            log.error(f"Loop error: {e}")
            tg(f"🚨 <b>Aegis Relay Error</b>\n{str(e)[:200]}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()

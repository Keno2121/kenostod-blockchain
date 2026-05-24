"""
Telegram Notifier — KENO Arb Bots
Sends trade alerts directly to your Telegram chat.

Add to .env:
  TELEGRAM_BOT_TOKEN=your_bot_token
  TELEGRAM_CHAT_ID=your_chat_id   ← get this by messaging your bot and visiting:
                                     https://api.telegram.org/bot<TOKEN>/getUpdates
"""

import os
import json
import urllib.request
import urllib.error
from datetime import datetime

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.getenv("TELEGRAM_CHAT_ID", "")

BNB_PRICE_USD = 600.0  # approximate


def _send(text: str) -> bool:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = json.dumps({
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "HTML"
    }).encode()
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status == 200
    except Exception:
        return False


def notify_arb_executed(bot_name: str, profit_bnb: float, direction: str,
                         tx_hash: str = "", network: str = "mainnet"):
    profit_usd = profit_bnb * BNB_PRICE_USD
    explorer   = "https://bscscan.com/tx/" if network == "mainnet" else "https://testnet.bscscan.com/tx/"
    tx_line    = f'\n🔗 <a href="{explorer}{tx_hash}">View on BscScan</a>' if tx_hash else ""
    msg = (
        f"⚡ <b>KENO Arb Bot — Trade Executed</b>\n"
        f"━━━━━━━━━━━━━━━━━\n"
        f"🤖 Bot: {bot_name}\n"
        f"📈 Direction: {direction}\n"
        f"💰 Profit: <b>+{profit_bnb:.6f} BNB</b> (~${profit_usd:.2f})\n"
        f"🌐 Network: {network.upper()}\n"
        f"⏰ {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
        f"{tx_line}"
    )
    _send(msg)


def notify_flash_arb(profit_bnb: float, direction: int, borrow_bnb: float,
                      tx_hash: str = "", network: str = "mainnet"):
    profit_usd = profit_bnb * BNB_PRICE_USD
    dir_label  = ["PC→BiSwap", "BiSwap→PC"][direction]
    explorer   = "https://bscscan.com/tx/" if network == "mainnet" else "https://testnet.bscscan.com/tx/"
    tx_line    = f'\n🔗 <a href="{explorer}{tx_hash}">View on BscScan</a>' if tx_hash else ""
    msg = (
        f"🔮 <b>Flash Orb Bot — Flash Arb Executed</b>\n"
        f"━━━━━━━━━━━━━━━━━\n"
        f"⚡ Type: Zero-Capital Flash Loan\n"
        f"💵 Borrowed: {borrow_bnb} WBNB\n"
        f"📈 Direction: {dir_label}\n"
        f"💰 Profit: <b>+{profit_bnb:.6f} WBNB</b> (~${profit_usd:.2f})\n"
        f"🌐 Network: {network.upper()}\n"
        f"⏰ {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
        f"{tx_line}"
    )
    _send(msg)


def notify_opportunity_missed(reason: str, spread_pct: float):
    """Sent when a spread was detected but conditions weren't met."""
    msg = (
        f"⏳ <b>Arb Opportunity — Not Executed</b>\n"
        f"Spread: {spread_pct:.3f}%\n"
        f"Reason: {reason}"
    )
    _send(msg)


def notify_error(bot_name: str, error: str):
    msg = (
        f"🚨 <b>KENO Arb Bot Error</b>\n"
        f"Bot: {bot_name}\n"
        f"Error: {error}\n"
        f"⏰ {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )
    _send(msg)


def notify_bot_started(bot_name: str, network: str, wallet: str):
    msg = (
        f"🟢 <b>KENO Arb Bot Started</b>\n"
        f"━━━━━━━━━━━━━━━━━\n"
        f"🤖 Bot: {bot_name}\n"
        f"🌐 Network: {network.upper()}\n"
        f"👛 Wallet: <code>{wallet[:6]}...{wallet[-4:]}</code>\n"
        f"⏰ {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )
    _send(msg)


def notify_daily_summary(executions: int, total_profit_bnb: float, uptime_hours: float):
    profit_usd = total_profit_bnb * BNB_PRICE_USD
    msg = (
        f"📊 <b>KENO Arb Bot — Daily Summary</b>\n"
        f"━━━━━━━━━━━━━━━━━\n"
        f"✅ Trades Executed: {executions}\n"
        f"💰 Total Profit: <b>{total_profit_bnb:.6f} BNB</b> (~${profit_usd:.2f})\n"
        f"⏱ Uptime: {uptime_hours:.1f} hours\n"
        f"⏰ {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    )
    _send(msg)


def get_chat_id_help() -> str:
    """Returns instructions for finding your Telegram chat ID."""
    return (
        f"To get your Telegram chat ID:\n"
        f"1. Message your bot on Telegram\n"
        f"2. Visit: https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates\n"
        f"3. Copy the 'chat.id' number\n"
        f"4. Add TELEGRAM_CHAT_ID=<that number> to keno-arb-bots/.env"
    )

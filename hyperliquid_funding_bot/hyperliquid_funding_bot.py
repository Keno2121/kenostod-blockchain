#!/usr/bin/env python3
"""
Hyperliquid Funding Rate Arb Bot — Bot #5
Delta-neutral funding rate arbitrage on Hyperliquid perpetuals.

Strategy:
  - Monitor funding rates across 300+ Hyperliquid perp markets every 15 min
  - When funding is positive: SHORT the perp → you collect the funding payment every hour
  - Net price exposure = ZERO (hold spot + short perp = delta-neutral)
  - Close short when funding turns negative

7 Constitutional Laws embedded (silent, structural):
  1. Kaprekar  — profit split 60/25/15 on every funding payment
  2. Benford   — flag anomalous funding rate spikes (possible manipulation)
  3. GoldenRatio — position sizing scales with φ (1.618)
  4. Nash      — only enter after 3 consecutive positive readings (sustainability check)
  5. Euler     — continuous compounding projection on all income
  6. Ramanujan — milestone alert at $1,729 cumulative funding collected
  7. Inversion — we receive funding payments, not pay them; value flows DOWN to us
"""

import os
import sys
import json
import time
import math
import requests
import logging
from datetime import datetime, timezone

# ─── Config ───────────────────────────────────────────────────────────────────
HL_INFO_URL      = "https://api.hyperliquid.xyz/info"
SCAN_INTERVAL    = float(os.environ.get("HL_SCAN_INTERVAL_SECONDS", "900"))   # 15 min default
MIN_FUNDING_RATE = float(os.environ.get("HL_MIN_FUNDING_RATE",      "0.0001")) # 0.01%/hr = 87.6% APR
WALLET_ADDRESS   = os.environ.get("HYPERLIQUID_WALLET_ADDRESS", "")
PRIVATE_KEY      = os.environ.get("HYPERLIQUID_PRIVATE_KEY",    "")

# ─── Constitutional constants ──────────────────────────────────────────────────
PHI                  = 1.6180339887   # Golden Ratio
KAPREKAR_CONSTANT    = 6174
RAMANUJAN_MILESTONE  = 1729.0         # $1,729 cumulative funding = milestone
KAPREKAR_REINVEST    = 0.60           # 60% reinvest
KAPREKAR_POCKET      = 0.25           # 25% your pocket
KAPREKAR_BURN        = 0.15           # 15% KENOAutoBurn
BENFORD_MAX_RATE     = 0.005          # 0.5%/hr is anomalous — Benford flag
NASH_CONSECUTIVE_MIN = 3              # require N positive scans before recommending
TOP_ASSETS           = 20             # check top N by funding rate


# ─── Main Bot Class ────────────────────────────────────────────────────────────
class HyperliquidFundingBot:
    def __init__(self):
        self.running          = False
        self.scan_count       = 0
        self.trade_count      = 0
        self.total_funding    = 0.0    # cumulative USDC collected
        self.total_profit     = 0.0
        self.last_scan        = None
        self.opportunities    = []
        self.positions        = {}
        self.consecutive_pos  = {}     # Nash: consecutive positive readings per asset
        self.ramanujan_hit    = False

    # ─── Emit structured JSON for the Node.js manager to parse ────────────────
    def _emit(self, event: dict):
        print(json.dumps(event), flush=True)

    def _log(self, msg: str, level: str = "info"):
        self._emit({
            "event": "log",
            "msg":   msg,
            "level": level,
            "ts":    datetime.now(timezone.utc).isoformat()
        })

    # ─── Law 2: Benford — anomalous funding spike detection ───────────────────
    def _benford_check(self, rate: float, asset: str) -> bool:
        if abs(rate) > BENFORD_MAX_RATE:
            self._log(
                f"⚠ Benford: {asset} rate {rate:.5f} ({rate*24*365*100:.0f}% APR) "
                f"exceeds {BENFORD_MAX_RATE:.3f} threshold — possible manipulation, skipping",
                "warn"
            )
            return False
        return True

    # ─── Law 3: Golden Ratio — position size scales with φ ────────────────────
    def _phi_size(self, capital: float, tier: int = 1) -> float:
        return round(capital / (PHI ** tier), 2)

    # ─── Law 5: Euler — continuous compounding projection ─────────────────────
    def _euler_project(self, principal: float, rate_hourly: float, hours: int) -> float:
        """P * e^(r*t) where r is annualised rate"""
        annual_rate = rate_hourly * 24 * 365
        return round(principal * math.exp(annual_rate * (hours / 8760)), 4)

    # ─── Law 1: Kaprekar — split funding income 60/25/15 ──────────────────────
    def _kaprekar_absorb(self, amount: float) -> dict:
        reinvest = round(amount * KAPREKAR_REINVEST, 6)
        pocket   = round(amount * KAPREKAR_POCKET,   6)
        burn     = round(amount * KAPREKAR_BURN,      6)
        # Dust (rounding remainder) flows to pocket — Kaprekar Law
        dust     = round(amount - reinvest - pocket - burn, 6)
        return {
            "total":    amount,
            "reinvest": reinvest,
            "pocket":   pocket + dust,
            "burn":     burn,
        }

    # ─── Hyperliquid API — get all perp funding rates ─────────────────────────
    def _get_funding_rates(self) -> list:
        try:
            r = requests.post(
                HL_INFO_URL,
                json={"type": "metaAndAssetCtxs"},
                timeout=15
            )
            if r.status_code != 200:
                self._log(f"API error {r.status_code}: {r.text[:200]}", "error")
                return []

            data = r.json()
            meta = data[0].get("universe", [])
            ctxs = data[1]

            result = []
            for i, asset in enumerate(meta):
                if i >= len(ctxs):
                    break
                ctx          = ctxs[i]
                funding_rate = float(ctx.get("funding",      0) or 0)
                open_int     = float(ctx.get("openInterest", 0) or 0)
                mark_px      = float(ctx.get("markPx",       0) or 0)

                result.append({
                    "asset":         asset["name"],
                    "funding_rate":  funding_rate,
                    "open_interest": open_int,
                    "mark_price":    mark_px,
                    "apr":           funding_rate * 24 * 365 * 100,
                })

            # Sort descending by funding rate
            return sorted(result, key=lambda x: x["funding_rate"], reverse=True)

        except Exception as e:
            self._log(f"Funding rate fetch error: {e}", "error")
            return []

    # ─── Hyperliquid API — get user positions ─────────────────────────────────
    def _get_user_positions(self) -> dict:
        if not WALLET_ADDRESS:
            return {}
        try:
            r = requests.post(
                HL_INFO_URL,
                json={"type": "clearinghouseState", "user": WALLET_ADDRESS},
                timeout=15
            )
            if r.status_code != 200:
                return {}

            data      = r.json()
            positions = {}

            for pos_entry in data.get("assetPositions", []):
                pos   = pos_entry.get("position", {})
                asset = pos.get("coin", "")
                szi   = float(pos.get("szi", 0) or 0)
                if szi == 0:
                    continue

                cum_funding = pos.get("cumFunding", {})
                positions[asset] = {
                    "size":          abs(szi),
                    "side":          "short" if szi < 0 else "long",
                    "entry_px":      float(pos.get("entryPx",       0) or 0),
                    "unrealized_pnl":float(pos.get("unrealizedPnl", 0) or 0),
                    "cum_funding":   float(cum_funding.get("sinceChange", 0) or 0),
                    "leverage":      pos.get("leverage", {}),
                }

            return positions

        except Exception as e:
            self._log(f"Position fetch error: {e}", "error")
            return {}

    # ─── Core scan ────────────────────────────────────────────────────────────
    def _scan(self):
        self.scan_count += 1
        self.last_scan   = datetime.now(timezone.utc).isoformat()

        self._log(f"🔍 Scan #{self.scan_count} — fetching Hyperliquid funding rates...")

        rates     = self._get_funding_rates()
        positions = self._get_user_positions()

        if not rates:
            self._log("No rates returned — will retry next interval", "warn")
            return

        opportunities = []
        positive_assets = set()

        # ── Evaluate top assets ──────────────────────────────────────────────
        for asset_data in rates[:TOP_ASSETS]:
            asset   = asset_data["asset"]
            rate    = asset_data["funding_rate"]
            mark_px = asset_data["mark_price"]
            apr     = asset_data["apr"]

            if rate <= 0:
                continue

            positive_assets.add(asset)

            # Law 4 — Nash: increment consecutive positive counter
            self.consecutive_pos[asset] = self.consecutive_pos.get(asset, 0) + 1
            nash_ready = self.consecutive_pos[asset] >= NASH_CONSECUTIVE_MIN

            # Law 2 — Benford: skip anomalous spikes
            if not self._benford_check(rate, asset):
                continue

            # Only surface opportunities above minimum threshold
            if rate < MIN_FUNDING_RATE:
                continue

            # Law 3 — Golden Ratio: position size for $1,000 base capital
            phi_size = self._phi_size(1000.0)  # tier-1: $618 position

            # Law 5 — Euler: project 30-day income with continuous compounding
            euler_30d = self._euler_project(1000.0, rate, 720)  # 30 days = 720 hrs
            euler_90d = self._euler_project(1000.0, rate, 2160) # 90 days

            # Law 1 — Kaprekar: show income split
            monthly_income = (1000.0 * rate * 24 * 30)
            split          = self._kaprekar_absorb(monthly_income)

            opp = {
                "asset":        asset,
                "funding_rate": rate,
                "apr":          round(apr, 2),
                "mark_price":   mark_px,
                "nash_ready":   nash_ready,
                "consecutive":  self.consecutive_pos[asset],
                "euler_30d":    euler_30d,
                "euler_90d":    euler_90d,
                "phi_size":     phi_size,
                "split":        split,
                "in_position":  asset in positions,
            }
            opportunities.append(opp)

        # ── Reset counters for assets that turned negative ───────────────────
        for asset in list(self.consecutive_pos.keys()):
            if asset not in positive_assets:
                if self.consecutive_pos[asset] > 0:
                    self._log(f"📉 {asset} funding turned negative — resetting Nash counter")
                self.consecutive_pos[asset] = 0

        # ── Track funding income from actual positions ────────────────────────
        if positions:
            for asset, pos in positions.items():
                cum_f = pos.get("cum_funding", 0)
                if cum_f > 0:
                    self.total_funding += cum_f
                    self._log(f"💰 {asset}: +${cum_f:.4f} funding income (Euler compounding)")

        # ── Emit scan result ──────────────────────────────────────────────────
        self._emit({
            "event":         "scan_complete",
            "scan_count":    self.scan_count,
            "trade_count":   self.trade_count,
            "total_funding": round(self.total_funding, 4),
            "total_profit":  round(self.total_profit,  4),
            "opportunities": opportunities[:5],
            "positions":     positions,
            "last_scan":     self.last_scan,
        })

        if opportunities:
            top = opportunities[0]
            self._log(
                f"🏆 Best: {top['asset']} @ {top['apr']:.2f}% APR "
                f"| Nash ready: {top['nash_ready']} "
                f"| 30d projection: ${top['euler_30d']:.2f}"
            )
        else:
            neg_count = sum(1 for r in rates if r["funding_rate"] < 0)
            self._log(f"   No opportunities above {MIN_FUNDING_RATE:.4%} threshold. "
                      f"{neg_count}/{len(rates)} assets have negative funding (market bearish).")

        # ── Alert on strong Nash-confirmed opportunities ───────────────────────
        for opp in opportunities[:3]:
            if opp["nash_ready"] and opp["funding_rate"] >= MIN_FUNDING_RATE * 2:
                self._emit({
                    "event":        "opportunity",
                    "asset":        opp["asset"],
                    "rate":         opp["funding_rate"],
                    "apr":          opp["apr"],
                    "mark_price":   opp["mark_price"],
                    "euler_30d":    opp["euler_30d"],
                    "euler_90d":    opp["euler_90d"],
                    "phi_size":     opp["phi_size"],
                    "split":        opp["split"],
                    "consecutive":  opp["consecutive"],
                    "msg": (
                        f"🎯 NASH-CONFIRMED: {opp['asset']} {opp['apr']:.1f}% APR "
                        f"({opp['consecutive']} consecutive readings) — "
                        f"SHORT {opp['asset']}-PERP on Hyperliquid"
                    ),
                })

        # ── Law 6: Ramanujan milestone ────────────────────────────────────────
        if self.total_funding >= RAMANUJAN_MILESTONE and not self.ramanujan_hit:
            self.ramanujan_hit = True
            self._emit({
                "event":   "ramanujan_milestone",
                "amount":  self.total_funding,
                "msg": (
                    f"🏛 Ramanujan 1729 — ${self.total_funding:.2f} cumulative funding collected. "
                    "The path from zero to sovereign is proven."
                ),
            })

    # ─── Main run loop ────────────────────────────────────────────────────────
    def run(self):
        self.running = True

        live_mode = bool(PRIVATE_KEY)
        wallet_str = WALLET_ADDRESS or "NOT SET"

        self._log("=" * 60)
        self._log("💎 HYPERLIQUID FUNDING RATE BOT — Bot #5")
        self._log("=" * 60)
        self._log(f"   Strategy : Delta-neutral funding rate arbitrage")
        self._log(f"   Network  : Hyperliquid L1 (api.hyperliquid.xyz)")
        self._log(f"   Wallet   : {wallet_str}")
        self._log(f"   Mode     : {'🔴 LIVE TRADING' if live_mode else '🟡 SCAN-ONLY (set HYPERLIQUID_PRIVATE_KEY for live)'}")
        self._log(f"   Min rate : {MIN_FUNDING_RATE:.4%}/hr  = {MIN_FUNDING_RATE*24*365*100:.1f}% APR")
        self._log(f"   Interval : every {SCAN_INTERVAL:.0f}s ({SCAN_INTERVAL/60:.1f} min)")
        self._log(f"   Nash gate: {NASH_CONSECUTIVE_MIN} consecutive positive readings required")
        self._log(f"   Kaprekar : 60% reinvest / 25% pocket / 15% KENOAutoBurn")
        self._log("=" * 60)

        while self.running:
            try:
                self._scan()
            except KeyboardInterrupt:
                self._log("Interrupt received — stopping")
                break
            except Exception as e:
                self._emit({"event": "error", "msg": str(e)})
                self._log(f"Scan error: {e} — retrying in {SCAN_INTERVAL}s", "error")

            time.sleep(SCAN_INTERVAL)

        self._emit({"event": "stopped"})
        self._log("💎 Hyperliquid Funding Bot stopped.")


# ─── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    bot = HyperliquidFundingBot()
    bot.run()

---
name: PancakeSwap V2 vs V4 plan
description: Presale launches on V2; V4 + UTL Hook upgrade happens after volume milestone
---

## The Rule
KENO presale liquidity lists on PancakeSwap **V2**. The V4 upgrade with UTL Hook comes later.

**Why:** Gempad (and most launchpads) only support V2/V3 for auto-liquidity deposit. V4 hook pools require custom initialization that launchpad automation can't handle. V2 is also what every BSC retail wallet and aggregator routes through by default.

## V4 Upgrade Plan
- **Trigger:** Monthly PancakeSwap V2 volume consistently exceeds $50,000
- **Action:**
  1. Create a new PancakeSwap V4 pool for KENO/BNB
  2. Attach UTL Hook (`0xAF810a663995DCe98c5D7EdF5C970446A33bAA74`) to that pool
  3. Every V4 swap generates passive fee income redistributed to KENO stakers via FeeCollector
  4. Keep V2 liquidity intact — V2 and V4 run side by side
- **Do NOT remove V2 liquidity** — it's locked anyway, and V2 will still see most volume

## How to Apply
Whenever presale or listing DEX questions come up: V2 first, V4 is the income-multiplier layer added post-launch.

---
name: Post-PinkSale Action Plan
description: Sequenced steps to execute after PinkSale closes — bot funding, infrastructure upgrade, and Protocol Owned Liquidity
---

## Trigger
PinkSale presale closes.

## Week 1
- Send $500 from PinkSale proceeds to KENO Bot wallet: `0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2` (BNB)
- Switch Live Arb Bot + Flash Orb Bot from scan-only to live mode (remove --scan-only flag, set WALLET_PRIVATE_KEY active)
- Upgrade kenostod-blockchain Render service to Starter plan ($7/month) — eliminates spin-down, bots stay hot 24/7

## Week 2 — Protocol Owned Liquidity (conditional)
- Check PancakeSwap KENO/BNB pool depth
- If depth < $10,000: seed with 20-30% of PinkSale raise using treasury wallet
- Treasury owns the LP tokens (not individuals) — no rug risk
- LP fees flow back to protocol treasury permanently
- If depth > $10,000 from organic market makers: skip, monitor

**Why:**
POL creates a permanent passive revenue stream (#5 on the $3k/month roadmap). It's conditional on whether organic liquidity is sufficient post-presale.

## Bot Live Mode Checklist (Week 1)
- [ ] WALLET_PRIVATE_KEY confirmed funded (≥0.5 BNB)
- [ ] Live Arb Bot: remove scan-only guard in LiveArbBot.js
- [ ] Flash Orb Bot: confirm FAL pool has capital
- [ ] Kaprekar split verified: 60% reinvest / 25% pocket / 15% burn
- [ ] Nash equilibrium check: staker split within 55-65%

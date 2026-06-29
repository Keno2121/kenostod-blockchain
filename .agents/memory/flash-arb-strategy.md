---
name: Flash Arb & Solana Arb Strategy Findings
description: Confirmed viability and economics of flash loan arb (BSC) and Jupiter round-trip arb (Solana)
---

## FlashArbLoan2 (BSC)
- Contract `0x24428f4c0A1FCEd87e84241F103f4aa4FFaD51Be` IS deployed and callable on BSC mainnet
- Use `quoteBest(amountWei)` as a FREE view call to check profitability before spending any gas
- Only executes `executeFlashArb()` (costs gas) when quoteBest returns profitable=true
- Gas cost per flash tx: ~600,000 gas × BSC current price (0.1 gwei June 2026) = 0.00006 BNB = ~$0.036
- Bot wallet 0.012 BNB = ~116 flash executions before hitting 0.005 BNB gas reserve
- WBNB/USDT spread between BiSwap and PancakeSwap averages 0.052% — below 0.09% flash loan fee
- Flash arb is NOT profitable at average spreads; only works during volatile market conditions
- quoteBest() returns false during calm markets — this is CORRECT behavior, not a bug

**Why:** Flash loan fee is 0.09%. Average observed spread 0.052% does not cover it. Bot correctly does nothing.

**How to apply:** Trust quoteBest() as the authoritative signal. Do not lower minProfitUSD below $0.25. When market pumps/dumps, spreads widen to 0.2-0.5% and the bot will auto-execute. Keep gas reserve ≥ 0.005 BNB.

## Jupiter Round-Trip Arb (Solana)
- SOL→USDC→SOL round-trip showed +0.0113% once, but averaged NEGATIVE across 5+ trials
- Jupiter's internal routing already arbitrages pool imbalances — retail bots cannot reliably capture the spread
- Round-trip arb WITHOUT MEV infrastructure (Jito bundles) is NOT viable for consistent income
- Aegis bot v1 was broken: only had a BUY leg (SOL→token), never sold. Was accumulation speculation, not arb.
- Aegis bot v2 rebuilt with true two-leg round-trip simulation, scan-only, tracks hypothetical P&L

**Why:** Jupiter aggregates across all Solana DEXes simultaneously. By the time a retail bot quotes and executes, the spread is usually gone. MEV searchers close gaps in <100ms.

**How to apply:** Keep Aegis bot in SCAN-ONLY mode indefinitely unless simulation P&L shows consistently positive results over 7+ days. Never re-enable directional (buy-and-hold) mode.

## HL Funding Rate (June 2026 market state)
- SOL, BTC, ETH funding rates all near-zero or negative (shorts pay longs)
- DriftFundingBot threshold: 80% APR — not triggered
- No entry signals for funding rate capture right now
- Will auto-trigger if rates spike during market volatility

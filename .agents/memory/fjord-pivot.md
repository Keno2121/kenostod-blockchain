---
name: Fjord LBP pivot
description: QCT was blocked on Fjord by "Invalid asset value"; KENO on BSC is the new Fjord target; QCT moves to Hyperliquid HIP-1
---

## Rule
Do not retry QCT on Fjord without first resolving the fee-on-transfer issue with Fjord support (ticket open in Discord, Ticket#6207).

## Why
QCT has a 2% transfer fee (Tithe & Triumph protocol). Fjord's frontend does a balance-check simulation that detects fee-on-transfer tokens and blocks them with "Invalid asset value" — even with baseFee=0, the contract code structure triggers static detection. This was not resolvable via fee exemptions alone.

## Current state (as of Jun 2, 2026)
- QCT on Fjord: ❌ blocked, support ticket open
- Fjord contract `0x53e6dd5164a07f98d296f05c5e139c2a5651a7b8` on Base still has QCT + WETH approvals set (can revoke later)
- QCT fee exemption for Fjord contract is set (can leave or revoke)
- QCT baseFee restored to 200 bps ✅

## New plan
- KENO (BSC, standard ERC20, no transfer fee) → Fjord LBP on BSC; kit at `keno-v2/FJORD_LAUNCH_KIT.md`
- QCT → Hyperliquid HIP-1 Dutch auction (same mechanism, no fee-on-transfer issues); guide at `queens-chariot/hyperliquid/HIP1_LAUNCH_GUIDE.md`

## How to apply
When user asks about Fjord: default to KENO kit. When user asks about QCT launch: default to HL HIP-1 guide.

---
name: Bot wallets and key setup
description: Correct wallet addresses, secret names, and dangerous addresses to avoid
---

## BSC Bot Wallet
- Address: `0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2`
- Secret: `WALLET_PRIVATE_KEY` (was renamed from NEW_WALLET_PRIVATE_KEY)
- Bot: FlashOrbBot / LiveArbBot in `src/`

## Solana Bot Wallet
- Address: `CLgn5H6j3QhD9HnJgKFcfnymg5BCuC41K7Ze7SmTjzVr`
- Private key stored in `kings-shield/.env` as `SOLANA_PRIVATE_KEY`
- Funded with ~0.1217 SOL

## DANGER — Never Fund
- `0x4AA73FadfFd71E6549867a37455EA957A52Cf849` (Resi-Fi) — MetaMask Smart Account on BSC, auto-sweeps all incoming BNB. User lost ~$100 funding this address.
- `0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf` — deployer wallet, compromised.

**Why:** These were hard-learned lessons from real lost funds. Always double-check the destination before any on-chain send.

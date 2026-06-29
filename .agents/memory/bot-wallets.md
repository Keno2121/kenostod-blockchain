---
name: Bot wallets and key setup
description: Correct wallet addresses, secret names, and dangerous addresses to avoid
---

## BSC Bot Wallet
- Address: `0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2`
- Secret: `BOT_WALLET_PRIVATE_KEY` (64-char hex, no 0x prefix — add `0x` prefix when passing to ethers)
- WARNING: `KENO_WALLET_PRIVATE_KEY` secret stores the **address** not the key — useless for signing
- Bot: FlashOrbBot / LiveArbBot in `src/`
- Has 921.6M KENO v2; 10M staked in UTLStaking v2 as of June 15 2026

## Solana Bot Wallet
- Address: `CLgn5H6j3QhD9HnJgKFcfnymg5BCuC41K7Ze7SmTjzVr`
- Private key stored in `kings-shield/.env` as `SOLANA_PRIVATE_KEY`
- Funded with ~0.1217 SOL

## Resi-Fi (KENO v2 Owner)
- Address: `0x4AA73FadfFd71E6549867a37455EA957A52Cf849`
- Secret: `NEW_WALLET_PRIVATE_KEY`
- EIP-7702 delegated account — plain BNB transfers revert (auto-sweep). Use selfdestruct trick to fund gas.

## DANGER — Never Fund
- `0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf` — deployer wallet, compromised.

**Why:** KENO_WALLET_PRIVATE_KEY was misnamed — it stores the wallet address, not the key. BOT_WALLET_PRIVATE_KEY is the correct secret for bot wallet signing. Hard-learned from real lost funds.

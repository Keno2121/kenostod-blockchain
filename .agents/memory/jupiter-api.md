---
name: Jupiter API endpoints
description: Working Jupiter API URLs for Solana bots in this Replit environment
---

## Working Endpoint (confirmed from Replit)
- Quote: `https://api.jup.ag/swap/v1/quote`
- Swap: `https://api.jup.ag/swap/v1/swap`
- Price: `https://api.jup.ag/price/v2`

## Blocked / Broken Endpoints
- `https://quote-api.jup.ag/v6/quote` — connection refused from Replit
- `https://lite-api.jup.ag/v6/quote` — connection refused from Replit
- `https://jupiter-swap-api.quiknode.pro/v6/quote` — connection refused

## Solana Network Env Var
- Set `SOLANA_NETWORK=mainnet` (NOT `mainnet-beta`)
- Bots check for both: `if network in ("mainnet-beta", "mainnet")`

**Why:** Replit networking blocks some Jupiter CDN routes. The `api.jup.ag` domain works reliably. The SOLANA_NETWORK mismatch caused bots to silently use devnet RPC and show 0 balance despite wallet being funded.

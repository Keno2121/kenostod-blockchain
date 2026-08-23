---
name: FAL BOT Chain Deployment
description: FALPool and FALFlashArbBOT addresses on BOT Chain mainnet and testnet, integration notes.
---

# FAL BOT Chain Deployment

## Mainnet (chain 677)

| Contract | Address |
|---|---|
| FALPool | `0x5065DDd17B35427131d7EA0387Ba68dC26d61fD1` |
| FALFlashArbBOT | `0x446b29625fBE8F8Fe254E8fEf7e296224DB4C2d8` |
| KENO (stake token) | `0x137a5Fc22a76Ec42490F2421a81935d124baE714` |
| WBOT | `0xD5452816194a3784dBa983426cCe7c122F4abd30` |
| KENO/WBOT BDEX Pool | `0x0E5CDa3A501010331774B3cdB66Fa15425c5D251` |

Env vars set: `FALP_BOTCHAIN_ADDRESS`, `FALP_ARB_BOT_BOTCHAIN`

## Testnet (chain 968, BOHR)

| Contract | Address |
|---|---|
| FALPool | `0x446b29625fBE8F8Fe254E8fEf7e296224DB4C2d8` |
| FALFlashArbBOT | `0x9048733Da99B2d90Ade13fCBfAd3B2d05C47775E` |

Env vars set: `FALP_TESTNET_ADDRESS`, `FALP_ARB_BOT_TESTNET`

## Architecture

- FALPool: same contract as BSC. Rewards in native BOT (not BNB). `call{value}` pattern is chain-agnostic.
- FALFlashArbBOT: new V3 flash contract. Uses BDEX V3 `pool.flash()` + `uniswapV3FlashCallback`. 5% of every arb profit goes to FALPool stakers; 95% to owner.
- `injectProfit()`: owner sends BOT manually; 5% → FALPool, 95% → owner. Use to seed rewards before arb volume exists.
- Flash arb viable when ≥2 BDEX pools have same pair at different prices. Currently only KENO/WBOT exists — manual injection is the funding path for now.

## API Endpoints (server.js)

- `GET /api/falp/botchain/info` — pool stats (public)
- `GET /api/falp/botchain/deposit-info/:address` — user position (public)
- `GET /api/falp/botchain/arb-stats` — FALFlashArbBOT stats (public)
- `POST /api/falp/botchain/inject-profit` — founder-only, routes BOT through arbBot (5% stakers)
- `POST /api/falp/botchain/deposit-profit` — founder-only, sends BOT directly to FALPool

## Deploy Scripts

```
cd falp && npm run deploy:botchain           # mainnet
cd falp && npm run deploy:botchain-testnet   # testnet (chain 968)
```

Deployment records saved in `falp/deployments/fal-botchain-latest.json` and `fal-botchain-testnet-latest.json`.

**Why:**
BOT Chain uses BDEX (Uniswap V3 fork). Flash arb requires V3 `pool.flash()` + callback pattern, not PancakeSwap V2 `swap()` callback. FALPool is chain-agnostic — native token rewards work identically.

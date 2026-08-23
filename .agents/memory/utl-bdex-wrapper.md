---
name: UTL BDEX Wrapper
description: Live UTLBDEXWrapper deployment on BOT Chain mainnet — addresses, fee config, and verification notes
---

## Contract Details
- **Network:** BOT Chain Mainnet (Chain ID 677)
- **Address:** `0x829658BE065C75C174639701672dE820E4683ca7`
- **Explorer:** https://scan.botchain.ai/address/0x829658BE065C75C174639701672dE820E4683ca7
- **Deployer / Owner:** `0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2` (bot wallet)
- **Deploy TX:** `0x248091284cecf9ffad344417a170e532ad393d3344f52cd9dc767366c3e049f7`
- **Deployed:** 2026-08-23
- **Record file:** `utl/deployments/botchain-bdex-wrapper.json`

## Testnet Deployment
- **Network:** BOT Chain Testnet (Chain ID 968, RPC: https://rpc.bohr.life)
- **Address:** `0x5065DDd17B35427131d7EA0387Ba68dC26d61fD1`
- **Record file:** `utl/deployments/botchain-bdex-wrapper-testnet.json`

## Key Addresses Used
- **WBOT:** `0xD5452816194a3784dBa983426cCe7c122F4abd30`
- **BDEX Router:** `0x07032d47A1b9f8460cBeE9dC17c1d3E438693929` (confirmed by selector `0x414bf389` = V3 exactInputSingle)
- **UTL FeeCollector:** `0xBb44a52b2B69D820cA1792Ca9a496e9F00B2F9E7`
- **UTL Fee:** 10 bps (0.1%)

## How It Works
- `swapExactBOTForTokens` — native BOT in, token out; fee deducted from BOT before swap
- `swapExactTokensForBOT` — token in, native BOT out; fee deducted from BOT received
- `swapExactTokensForTokens` — token→token; fee deducted from input token
- All fees go directly to FeeCollector in a single atomic transaction

## BDEX Contract Map (BOT Chain — same addresses on mainnet and testnet)
- WBOT: `0xD5452816194a3784dBa983426cCe7c122F4abd30`
- V3 Factory: `0x1C51c173323ec11BB4e3C4fD2314c225Dc4b5419`
- NftPositionManager: `0xDAc3FcFF004d8a8675b94E44941A1a2e3b240090`
- SwapRouter: `0x07032d47A1b9f8460cBeE9dC17c1d3E438693929`
- DEX URL: https://dex.botchain.ai/#/swap

**Why:** Standard Uniswap V3 router addresses do NOT exist on BOT Chain — confirmed by code check. The router was found by tracing recent WBOT Transfer logs on-chain (top caller with 81 calls, 10,088 bytes, selector 0x414bf389).

## Verification
- Source verification submitted via Blockscout flat-source API (same approach as KENO)
- Standard `npx hardhat verify` fails: Etherscan V2 doesn't support chain 677; Sourcify returns HTML
- Use: POST https://scan.botchain.ai/api/v2/smart-contracts/{addr}/verification/via/flattened-code

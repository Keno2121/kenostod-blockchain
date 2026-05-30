---
name: KENO v2 deployment
description: KENO token v2 deployed on BSC mainnet — contract address, wallet setup, why v1 was abandoned
---

## KENO v2 — BSC Mainnet

**Contract:** `0x48bb049afe50b050b458624dc6233acd51024ab4`
**Network:** BSC Mainnet (chainId: 56)
**Deploy tx:** `0xcd21402e21683f1ae4bbf894be4f49c774813ec637c5882e3875efb57197ac89`
**Deployed:** 2026-05-30
**Source:** `keno-v2/KenostodToken.sol`
**Deployment record:** `keno-v2/deployments/keno-v2-bsc.json`

### Wallet setup
- **Owner:** `0x4AA73FadfFd71E6549867a37455EA957A52Cf849` (Resi-Fi MetaMask)
- **teamWallet / treasuryWallet / liquidityWallet:** `0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2` (bot wallet)
- All 1,000,000,000 KENO minted to bot wallet at construction

### Why v1 was abandoned
- KENO v1 (`0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E`) had teamWallet, treasuryWallet, liquidityWallet ALL hardcoded to the compromised deployer `0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf`
- No function to update those wallet addresses existed
- teamReleaseTime locked until Nov 10, 2026 — and even then would have sent to compromised wallet
- No mint function — no way to get tokens out
- v1 deployer was the only holder so no migration needed

### Key features of v2
- `setPresaleContract(addr)` — for DxSale integration
- `setTeamWallet/setTreasuryWallet/setLiquidityWallet` — owner can update wallets (v1 didn't have this)
- `updateWhitelist(addr, bool)` overloaded for single + array
- No time locks, no compromised addresses
- Standard ERC-20 compatible with all DEXes

**Why:** v1 contract architecture was fundamentally broken (all value paths led to a wallet nobody controlled). v2 is the canonical KENO token going forward.

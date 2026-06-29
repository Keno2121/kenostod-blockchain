---
name: QCT Queens Chariot Deployment
description: Third token of the Sovereign Trinity — Base chain, ERC-20, 6 fee protocols, 7 Constitutional Laws
---

# Queens Chariot Token (QCT) — Deployment Notes

## Sovereign Trinity — ALL LIVE
- KENO — BSC BEP-20 `0x48bb049afe50b050b458624dc6233acd51024ab4`
- SHIELD — Solana SPL `CZLG5tcXJ8iNr4fpnp731z3R2RdrDhwxk3pUszV1fhvw`
- **QCT — Base ERC-20 `0x137a5Fc22a76Ec42490F2421a81935d124baE714` ✅ LIVE**

## Live Deployment Record
- **Contract:** `0x137a5Fc22a76Ec42490F2421a81935d124baE714`
- **Deployer:** `0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2` (KENO bot wallet)
- **Deployed:** 2026-06-01, block 46769213
- **Tx:** `0x95b64cdf1928e6565b93fac687be29a8b01529ae89a724a4bf4bb2684f0c31ad`
- **Basescan:** https://basescan.org/address/0x137a5Fc22a76Ec42490F2421a81935d124baE714
- **Supply:** 980,000,000 QCT (1B − 2% Queen's Burn at genesis = 20M burned)
- **Record file:** `queens-chariot/deployments/qct-base.json`

## Critical Wallet Key Notes
- `QCT_DEPLOYER_KEY` secret = actual KENO bot private key — use for ANY Base chain signing
- `KENO_WALLET_PRIVATE_KEY` secret = set to the wallet ADDRESS (42 chars), NOT the private key — cannot sign with it
- `NEW_WALLET_PRIVATE_KEY` (0x4AA73...) **has contract code on Base** — cannot use as EOA signer on Base, only works on chains where it's a regular wallet
- All 6 allocation wallets currently point to `0xC20b9a51...` (deployer) — move to dedicated cold wallets before Fjord LBP goes live

## Contract location
- Source: `queens-chariot/contracts/QueensChariot.sol`
- Hardhat: `queens-chariot/hardhat.config.js` — uses `QCT_DEPLOYER_KEY` (priority) → `KENO_WALLET_PRIVATE_KEY` → `NEW_WALLET_PRIVATE_KEY`
- Compile: `cd queens-chariot && npx hardhat compile` — confirmed clean (solidity 0.8.24, OZ v5)

## Key constants
- Total supply: 1,000,000,000 QCT (1B)
- Queen's Burn: 2% burned at constructor (980M circulating)
- KAPREKAR_CONSTANT: 6174
- RAMANUJAN_QCT: 1729 × 1e18 (milestone event)
- PHI: 1618/1000 (Golden Ratio shape for tier multipliers)

## 6 Fee Protocols (all in _update hook)
1. Tithe & Triumph: baseFee=200bp (2%), max 10% cap
2. SSWFR: sovereignPool → stake-weighted rebates
3. Temporal Taxonomy: Squire/Knight/Baron/Duke/Sovereign tiers (30/90/181/366 days)
4. Prosperity Cascade: 40/30/20/10 split, 0/24h/48h/72h delays
5. Guardian's Gambit: same-block + >20tx/hr detection, +300bp surcharge
6. Alchemical AMM: volatility bands [20,50,100,200]bp via owner/oracle

## Queen Bot Auto-Connection
Queen bot reads `queens-chariot/deployments/qct-base.json` on every 30s chain poll.
Confirmed working on 2026-06-01: auto-detected contract at startup, logs "QCT contract found at 0x137a5... — connecting to Base chain."
No restart needed after deployment — bot connects within 30 seconds of deploy file appearing.

## Fjord LBP Next Steps
- 78,400,000 QCT (8% partnerships allocation) earmarked for Fjord LBP
- Full submission kit: `queens-chariot/FJORD_LAUNCH_KIT.md`
- URL: https://fjordfoundry.com → user must connect MetaMask and submit manually
- After LBP: add Aerodrome (Base) QCT/ETH pool, then call `setDexPair()` to activate Alchemical AMM fees

## Post-deploy checklist
1. Verify on Basescan: `cd queens-chariot && npm run verify:mainnet 0x137a5Fc22a76Ec42490F2421a81935d124baE714`
2. Fjord LBP — see FJORD_LAUNCH_KIT.md
3. setDexPair() for Aerodrome pool address (after LBP)
4. Lock liquidityFortress on Unicrypt or Team.Finance
5. Transfer ownership to Gnosis Safe multisig
6. Submit for CertiK/Trail of Bits audit

**Why:** QCT is Base's institutional credibility angle for the Trinity. Value flows down to holders via Inversion Law — community 40% always first, treasury 10% last (72h delay). Protocol runs itself once deployed.

---
name: QCT Queens Chariot Deployment
description: Third token of the Sovereign Trinity — Base chain, ERC-20, 6 fee protocols, 7 Constitutional Laws
---

# Queens Chariot Token (QCT) — Deployment Notes

## Sovereign Trinity
- KENO — BSC BEP-20 `0x48bb049afe50b050b458624dc6233acd51024ab4`
- SHIELD — Solana SPL `CZLG5tcXJ8iNr4fpnp731z3R2RdrDhwxk3pUszV1fhvw`
- QCT — Base ERC-20 (not yet deployed, contract ready)

## Contract location
- Source: `queens-chariot/contracts/QueensChariot.sol`
- Hardhat: `queens-chariot/hardhat.config.js` (same pattern as wkeno)
- Deploy: `queens-chariot/scripts/deploy.js`
- Deployer wallet: `NEW_WALLET_PRIVATE_KEY` (same as wKENO deployer)
- Compile: `cd queens-chariot && npx hardhat compile` — confirmed clean

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

## Deployment env vars needed before mainnet
- QCT_PROSPERITY_POOL, QCT_LIQUIDITY_FORTRESS, QCT_DEV_TREASURY
- QCT_FOUNDING_COURT, QCT_PARTNERSHIPS, QCT_EMERGENCY_RESERVE
- BASESCAN_API_KEY (for verify step)

## Post-deploy checklist
1. setDexPair() for Uniswap V3 / Aerodrome pool address
2. Lock liquidityFortress on Unicrypt or Team.Finance
3. Transfer ownership to Gnosis Safe multisig
4. npm run verify:mainnet (Basescan)
5. Submit for CertiK/Trail of Bits audit
6. Set up Alchemical AMM keeper for volatility updates

**Why:** QCT is Base's institutional credibility angle for the Trinity. Value flows down to holders via Inversion Law — community 40% always first, treasury 10% last (72h delay).

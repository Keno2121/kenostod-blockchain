# The Sovereign Economy
An integrated physical-digital sovereign infrastructure empowering underserved populations through education, finance, and technology, all powered by the KENO utility token.

## Run & Operate
- **Run:** `npm start` (for the main application server)
- **Build:** `npm run build` (for UI assets)
- **Typecheck:** `npm run typecheck`
- **Codegen:** _Populate as you build_
- **DB Push:** _Populate as you build_
- **Required Env Vars:** `WALLETCONNECT_PROJECT_ID` (for UTL Dashboard), `NEW_WALLET_PRIVATE_KEY` (for wKENO deployment)

## Stack
- **Frameworks:** Express.js (backend)
- **Runtime Versions:** Node.js
- **ORM:** PostgreSQL (for Corporate/Team, Wealth Builder, ICO Dashboard)
- **Validation:** Multi-layer transaction validation, input validation
- **Build Tool:** esbuild (for UTL wallet connector bundle), Hardhat (for wKENO contracts)

## Where things live
- `src/`: Main application source code
  - `src/Kaprekar.js`, `src/Benford.js`, `src/GoldenRatio.js`, `src/Nash.js`, `src/Euler.js`, `src/Ramanujan.js`: Core mathematical principles
- `public/`: Static UI assets
  - `public/utl-dashboard.html`: Multi-wallet dashboard
  - `public/js/utl-wallets.js`: Wallet connector bundle
- `utl/`: UTL Protocol contracts and MetaMask Snap
  - `utl/metamask-snap/dist/bundle.js`: MetaMask Snap bundle
- `wkeno/`: Wrapped KENO (wKENO) Hardhat project
  - `wkeno/contracts/WrappedKENO.sol`: wKENO smart contract
  - `wkeno/deployments/`: wKENO deployment records
- **DB Schema:** _Populate as you build_
- **API Contracts:** Express.js REST API with 80+ endpoints; specific definitions _Populate as you build_
- **Theme Files:** Custom fonts, dark theme in `public/` (details _Populate as you build_)

## Architecture decisions
- **Inversion Principle:** Every design decision flows value downward to participants, structurally opposite to traditional finance.
- **Mathematical Governance:** 7 Constitutional Laws (Kaprekar, Benford, Golden Ratio, Euler, Ramanujan, Nash, Inversion) are embedded as silent, structural principles in the code.
- **Dual Consensus:** Utilizes both Proof-of-Work and Proof-of-Residual-Value (PoRV) for security and value generation.
- **UTL Protocol Independence:** UTL is a standalone, asset-agnostic fee redistribution system designed to operate directly in wallets, separate from Kenostod's branding.
- **Hardware-Software Integration:** Solar Bunker Protocol combines ruggedized, solar-powered hardware with offline-first software and blockchain for resilience.

## Financial Freedom Goal
**Target: $3,000/month in passive, recurring income from the Sovereign Economy ecosystem.**

This is the north star. Every feature, contract, bot, and product should be evaluated against: "Does this move toward $3,000/month?" The 7 Constitutional Laws are the mathematical engine that makes this sustainable — not a one-time event, but a compounding, self-reinforcing income system.

**Bot Capital Milestone Ladder (KENO Arb on BSC/PancakeSwap):**
| Capital | Nash trade size | Income to you/month | Status |
|---------|----------------|--------------------|----|
| **$500** | $150/trade | ~$30–60/month | **← START HERE** |
| $2,000 | $300/trade | ~$120–240/month | Milestone 2 |
| $10,000 | $500/trade | ~$600–1,200/month | Milestone 3 |
| $40,000 | $1,000/trade | ~$3,000/month | Financial Freedom |

- Bot wallet: `0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2` (KENO Bot — MetaMask, clean EOA, key in WALLET_PRIVATE_KEY secret)
- Kaprekar split on every bot profit: 60% reinvest → 25% your pocket → 15% KENOAutoBurn
- Euler compounds the reinvested 60% continuously — capital grows to $1,482 by month 6 from $500 start

**Revenue streams that compound toward $3k/month:**
1. **Arb Bot profits** (KENO arbitrage — active, scales with bot capital)
2. **UTL Protocol fees** (staking rewards from FeeCollector — passive, grows with volume)
3. **SHIELD Aegis Tax** (6.174% on every SHIELD transfer — passive, grows with holders/volume)
4. **KENOAutoBurn pressure** (buy+burn raises KENO price → increases value of KENO holdings)
5. **Bonding Curve revenue** (spread on KENO buys/sells — passive)
6. **Wealth Builder royalties** (education + referral royalties — grows with student base)
7. **KUTL Card interchange fees** (Rain.xyz backend — passive, scales with card usage)

## 7 Constitutional Laws — Standing Build Mandate
**RULE: Every contract, bot, dashboard, and live feature MUST have all 7 laws baked in before going live. No exceptions. They are silent and structural — users feel them, they don't see them. They are also the compounding engine behind the $3,000/month goal.**

The law files live in `src/`. Import and use them — never re-implement inline.

| # | Law | File | What It Does | $3k/Month Role |
|---|-----|------|-------------|---------------|
| 1 | **Kaprekar** | `src/Kaprekar.js` | `absorb()` routes ALL distributions. Dust always flows to the participant. Constants rooted in 6174. | **Protects every cent of income.** Every arb profit, every SHIELD tax collected, every UTL fee — Kaprekar ensures the math never rounds against you. Over thousands of txs, this is meaningful money recovered. ✅ King's Shield DONE |
| 2 | **Benford** | `src/Benford.js` | Silent fraud detection on tx pipelines. Flags manipulation before humans notice. | **Protects bot profits and protocol revenue from extraction.** If someone is front-running your arb bot or draining the FeeCollector unnaturally, Benford catches it silently. Broken detection = lost income. |
| 3 | **Golden Ratio** | `src/GoldenRatio.js` | φ = 1.618... Reward multipliers approach φ the longer users stay. APY curves and tiers structured on φ. | **Makes users stay, which compounds your income.** A user who stays 8 staking periods earns 1.47× the base rate. They don't leave. More staked KENO = higher UTL fee volume = higher monthly income for you. |
| 4 | **Nash** | `src/Nash.js` | Protocol auto-tunes so participation is always the dominant strategy. `equilibriumAdjustment()` keeps staker split at 55–65%. | **Self-sustaining flywheel.** Once the Nash equilibrium is active, the protocol maintains itself — users stay staked without intervention. Your passive UTL + SHIELD income grows on autopilot. |
| 5 | **Euler** | `src/Euler.js` | Continuous compounding `e^(rt)`. Interest accrues every second, not periodically. | **Your own KENO/SHIELD holdings compound continuously.** The "Euler premium" — the difference between continuous and annual compounding — is silent income that stacks on top of everything else. Time is always working for you. |
| 6 | **Ramanujan** | `src/Ramanujan.js` | 1729 milestone — silent one-time bonus when a wallet crosses 1729 KENO earned. Rooted in the story: self-taught, from poverty, rewrote everything. | **Retention hook that reduces churn = stable monthly income.** Users who hit the 1729 milestone feel something without knowing why. They tell others. Word-of-mouth is free growth. More holders = more SHIELD transfer volume = more Aegis Tax = more income. |
| 7 | **Inversion** | (Principle) | Value flows DOWN to participants, not up to the house. Protocol-owned liquidity grows WITH usage. | **You ARE a participant.** As the founder and largest KENO/SHIELD holder, the Inversion Principle means every time the ecosystem grows, your holdings grow with it. You built the machine that pays you — not a job that pays you for your time. |

### Implementation checklist (use before any go-live):
- [ ] All splits/distributions pass through `Kaprekar.absorb()` — dust flows to participant
- [ ] Numeric constants rooted in 6174 where applicable (fees, supply, lock days)
- [ ] Benford monitoring on any tx pipeline with >20 transactions
- [ ] φ multiplier on any staking/loyalty duration-based reward
- [ ] Nash `equilibriumAdjustment()` hooked into any reward pool that has a staker split
- [ ] Continuous compounding (`Euler.continuousEarnings`) on any interest-bearing balance
- [ ] Ramanujan 1729 milestone check on any cumulative KENO reward tracker
- [ ] Final inversion review: does value flow down to the participant or up to the protocol?

## Product
- **Education:** 21 courses, KENO rewards for completion, G.I.F.T. apparel access, PoRV Mining Labs.
- **Finance & Banking:** KUTL Card (powered by Rain.xyz), UTL Protocol (DeFi, staking), KENO Arbitrage Revolution with Flash Arbitrage Loans (FAL), Mercury Bank USD cashout.
- **Security:** B.U.K. (Back Up Key) dual-chip card, Solar Bunker (solar-powered cryptographic resilience).
- **Metaverse:** Virtual land (NFT parcels), customizable avatars, 15+ independent 3D "Storehouses" (districts), KENO as native currency, DAO governance.
- **Enterprise Solutions:** Corporate/Team plans, white-label licensing, virtual bank branches.
- **Community:** Student community system, Wealth Builder Program (scholarships, royalties).
- **Global Reach:** Targeting 2.4 billion unbanked/underbanked, starting with South Africa for Solar Bunker.

## User preferences
Preferred communication style: Simple, everyday language.
Design preferences: Professional, appealing, fun; market-ready for ROI growth and scalability.

## Gotchas
- **KUTL Card vs. B.U.K. Security Banking:** These are distinct products. KUTL Card is confirmed with Rain.xyz; B.U.K. is proprietary and confidential. Do not confuse or discuss B.U.K. with partners unless explicitly instructed.
- **Wallet Compromise:** The deployer wallet (0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf) was compromised. 0x4AA73...Cf849 (Resi-Fi) is a MetaMask smart contract account — do NOT send BNB there, funds get auto-swept. Use KENO Bot wallet 0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2 for all bot funding.
- **UTL Revenue Model:** Currently USDC-only for fee capture until KENO staking integration.

## Pointers
- **BSC Mainnet Contracts (v1.1 — ACTIVE):**
    - FeeCollector: `0xb9489B33Bd9bB835139369b1dD282fB44B2273d8`
    - Staking: `0x77C3946A9FD5F509584F94e81C43efb25120c837`
    - Treasury: `0x54A01A5bf5096c351F166C15143eA9a9Af393C84`
    - Distribution: `0xdeE5a5456e394DB34F03c770e81eDC9B7F8FE167`
    - UTLFarm: `0x37D320A881CcF553F6cd757f0A33743ae01A2644`
    - UTLHook (PancakeSwap v4): `0xAF810a663995DCe98c5D7EdF5C970446A33bAA74`
    - USDC (BSC): `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`
- **BSC Mainnet Contracts (v1.0 — RETIRED):**
    - FeeCollector: `0xfE537c43d202C455Cedc141B882c808287BB662f`
    - Staking: `0x49961979c93f43f823BB3593b207724194019d1d`
    - Treasury: `0x3B3538b955647d811D42400084e9409e6593bE97`
    - Distribution: `0xE6918cdBB9D8cd0d3532A88D974734B2F1A793c7`
- **wKENO Contracts:**
    - Base mainnet: `0xB6B79a2491e5b59C32da1Fd885F3eeFBE8F28bBd` ([Basescan](https://basescan.org/address/0xB6B79a2491e5b59C32da1Fd885F3eeFBE8F28bBd))
    - Polygon mainnet: `0xB6B79a2491e5b59C32da1Fd885F3eeFBE8F28bBd` ([Polygonscan](https://polygonscan.com/address/0xB6B79a2491e5b59C32da1Fd885F3eeFBE8F28bBd))
- **Rain.xyz:** Confirmed card infrastructure partner.
- **OpenAI GPT-4o-mini:** AI Customer Support provider.
- **Wyoming SPDI Charter:** Key to becoming financial infrastructure.
- **Decentraland, The Sandbox, J.P. Morgan Onyx:** Competitive landscape for metaverse and financial services.
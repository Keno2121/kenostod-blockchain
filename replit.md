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
- **Wallet Compromise:** The deployer wallet (0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf) was compromised. Ownership of existing contracts needs to be transferred to the new safe wallet (0x4AA73FadfFd71E6549867a37455EA957A52Cf849) once funded.
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
# Overview

Kenostod Blockchain Academy LLC is the entry point to **The Sovereign Economy** — a physical-digital sovereign infrastructure built under the T.D.I.R. Foundation with 8 independent ventures all converging on KENO. The platform includes education (21 courses), banking (KUTL Card / Cybrid BaaS), DeFi (UTL Protocol / UTLFarm), security hardware (B.U.K. Back Up Key), smart apparel (G.I.F.T.), and a licensing empire of 6 patent-pending technologies. KENO is a BEP-20 utility token on BNB Smart Chain, earned through education, not purchased.

---

## Founding Philosophy — The Inversion Principle

**Everything built here is designed to be the structural opposite of how the old economy was built.**

The old wealth systems — Rothschild banking, Rockefeller verticals, J.P. Morgan financial consolidation, and the dynasties that followed — were not accidents. They were architectures deliberately engineered to concentrate wealth upward and keep it there permanently. Debt dependency, vertical monopolies, gatekept capital, and extraction from the masses were the mechanisms. Those systems oppressed the majority to enrich the few at the top.

**The Sovereign Economy inverts every one of those mechanisms:**

| Old Economy (Dynasty Model) | The Sovereign Economy (Inversion Model) |
|---|---|
| Charged tuition to access knowledge that made institutions rich | Pays students KENO for completing education |
| Hoarded gold, issued fiat tied to nothing | KENO is earned, not printed — supply is fixed at 1B |
| Banks charged the poor for account access | KENO earned in class loads directly onto a spendable card |
| Fees collected privately, flows to the top | UTL Protocol fees are on-chain, auditable, redistributed |
| Status through exclusion and gatekeeping | G.I.F.T. Eureka earned by showing up and learning |
| Private protection only for the wealthy | B.U.K. security banking accessible to every cardholder |
| Infrastructure owned by dynasties, masses pay rent | Licensing empire built by T.D.I.R., fees flow back to Foundation |
| M&A to consolidate power upward | Each pillar is independently licensable — value stays distributed |

**This principle guides every design decision going forward.** When building any new feature, document, pitch, or system — ask: does this flow value toward the people, or toward the top? If it flows toward the top, it is wrong. Rebuild it.

Tagline: **Strong. Unbreakable. Yours.** — not theirs.

---

# User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Professional, appealing, fun; market-ready for ROI growth and scalability.

# System Architecture

## Core Blockchain & Consensus
The system features a modular blockchain with SHA-256 Proof-of-Work, UTXO-style transactions, secp256k1 digital signatures, a 5-minute transaction reversal window, and social recovery. It supports dual consensus modes: Proof-of-Work and Proof-of-Residual-Value (PoRV), which uses AI/ML computations for value generation and KENO deflation. Data is file-based.

## Transaction & Financial Systems
A merchant payment gateway supports registration, API keys, QR code payments, invoicing, KENO/USD conversion, and a 4-tier incentive program. An exchange platform facilitates KENO/USD, KENO/BTC, and KENO/ETH pairs with full order book functionality. KENO tokenomics include adjustable mining rewards and transaction fees.

## API Layer & UI/UX
The platform provides a modern, responsive web interface with a tabbed UI, dark theme, animations, custom fonts, and a live crypto ticker. An Express.js REST API offers over 80 endpoints. The UI supports multi-language internationalization (6 languages), persistent user preferences, a "First Lesson Free" onboarding experience, and a "Graduate Club Recognition System."

## AI Customer Support
An AI-powered chatbot, powered by OpenAI GPT-4o-mini via Replit AI Integrations, offers 24/7 technical support.

## KENO Arbitrage Revolution™
This system provides an arbitrage-native educational cryptocurrency with Flash Arbitrage Loans (FAL™), an Arbitrage Incentive Protocol (AIP™), and reputation-based loan limits. It includes performance tracking, scheduled arbitrage competitions, and an educational dashboard. It integrates with major exchanges for real-time market data to calculate educational arbitrage opportunities.

## Flash Arbitrage Loan Pools (FALP) System
A DeFi-inspired liquidity pooling system allowing users to pool KENO tokens for collective arbitrage. Features include pool creation with risk levels, liquidity deposits, pool borrowing for flash loans, automatic profit distribution, lock period bonuses, risk tiers, a pool leaderboard, and contributor tracking.

## Universal Transaction Layer (UTL) — Standalone Protocol
UTL is a standalone, independent protocol separate from Kenostod. It is an asset-agnostic fee redistribution system designed to live directly inside wallets (MetaMask Snap + Phantom), not as a website feature. UTL generates independent revenue to fund all Kenostod operations.

**Deployed Contracts (BSC Mainnet, Feb 16, 2026):**
- FeeCollector: 0xfE537c43d202C455Cedc141B882c808287BB662f
- Staking: 0x49961979c93f43f823BB3593b207724194019d1d
- Treasury: 0x3B3538b955647d811D42400084e9409e6593bE97
- Distribution: 0xE6918cdBB9D8cd0d3532A88D974734B2F1A793c7
- USDC (BSC): 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d

**Wallet Integrations:**
- MetaMask Snap: Transaction insight panel showing UTL fee calculations, opt-in/out, dashboard, auto-compound, weekly reports. Snap bundle at utl/metamask-snap/dist/bundle.js.
- Phantom: Browser SDK integration with App ID a162b37d-d2c5-431d-8195-4f5054da5baa. Domain verified via DNS TXT record.

**Multi-Wallet Dashboard (public/utl-dashboard.html):**
- MetaMask: Direct injection via window.ethereum
- WalletConnect: QR code connection for 300+ mobile wallets (Trust Wallet, Rainbow, etc.). Requires WALLETCONNECT_PROJECT_ID env var from cloud.walletconnect.com.
- Coinbase Wallet: SDK integration for mobile app and Smart Wallet
- All wallets connect to live BSC contracts with full staking, transaction, and rewards functionality
- Wallet connector bundle built with esbuild at public/js/utl-wallets.js
- Config API at /api/utl/config provides WalletConnect project ID and contract addresses

**Revenue Model:** 0.1% fee capture → 60% stakers, 40% treasury. UTL is a fully independent protocol with no ties to Kenostod branding or operations. Currently USDC-only until KENO staking post-Bridge.xyz meeting (March 6, 2026).

## Security Model
Security features include client-side transaction signing, digital signatures, multi-layer transaction validation, cryptographic block linking, transparent token supply tracking, PoRV security, wallet signature authentication, replay attack protection, rate limiting, CSRF protection, input validation, and server-side course verification.

## Corporate/Team Plans (B2B Revenue System)
An enterprise-grade system using PostgreSQL for managing organizations, members, learning progress, and subscriptions, with Stripe integration for billing. A dedicated "For Organizations" landing page targets enterprise customers with tiered licensing.

## Wealth Builder Program
This program offers blockchain education and opportunities through a student rewards system, tiered perpetual royalty NFTs (RVT), a scholarship fund, a career center, a referral program, a wealth tracker dashboard, and financial literacy courses, supported by PostgreSQL.

## Student Community System
A platform for student interaction, featuring discussion topics, peer help, graduate mentorship, arbitrage tips sharing, and role badges.

## G.I.F.T. Apparel System
Patent-pending smart apparel with embedded NFC/BLE shield technology enables Kenostod graduates to recognize each other via proximity detection, light flickering, and audio cues, with blockchain verification.

## Legal & Licensing System
Provides a legal framework for intellectual property protection and commercial licensing, including Terms of Service, a Commercial Licensing portal, copyright footers, and PostgreSQL tables for managing commercial API licenses.

## Graduate Merchandise Fulfillment System
A complete merchandise request and fulfillment system for verified graduates, including verification, a request form with wallet-based authentication, admin management, and Printful API integration.

## ICO Investor Dashboard System
A comprehensive investor transparency system with a real-time countdown, live fundraising metrics, KYC verification readiness, smart contract transparency (BscScan integration), funding progress visualization, token distribution chart, recent investor activity feed, and 24h growth indicators. Utilizes PostgreSQL.

## Revenue Systems
Revenue is generated through diverse streams including ICO token sales, course subscriptions, corporate B2B training, white-label licensing, G.I.F.T. smart apparel, FAL/FALP technology licensing (MACRO); AI chat premium, quiz retakes, featured posts, pool creation/boost, badge minting, arbitrage alerts, tip platform fees, mentor verification (MICRO); and exchange trading fees, merchant gateway fees, FAL/FALP platform fees, NFT secondary sales royalties (PASSIVE). Premium memberships are also offered.

## Node Sale System
A system for selling three node tiers (Scholar, Educator, Academy) with five utility functions: course validation, KENO distribution, FAL calculations, credential verification, and B.U.K security events. Supported by a PostgreSQL-backed whitelist registration system.

## Card Products — CRITICAL DISTINCTION

**KUTL Card** (Kenostod Universal Transaction Layer)
- The active card product being built NOW via Finlego/Cybrid BaaS partnership
- Standard card infrastructure — current development and partner focus
- Cybrid Flow of Funds Review: April 22, 2026 at 1:00 PM EST
- Card service available Q3 2026 per Cybrid
- What Rain, Bridge, and Cybrid know about — public-facing product

**B.U.K. Security Banking** (Back Up Key)
- COMPLETELY SEPARATE product — not the same as KUTL Card
- Built around a proprietary dual chip card concept — first of its kind in the industry
- NOT shared with any partners yet — kept confidential until Kenostod has traction
- Development begins AFTER KUTL Card is live
- Do NOT confuse with KUTL Card or mention to partners unless user instructs

## Security — Wallet Compromise (April 2026)
- Deployer wallet Account 2 (0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf) was compromised via EIP-7702 drain attack
- All 5 contracts (KENO, Staking, FeeCollector, Treasury, Distribution) are still owned by the compromised address
- New safe wallet created: 0x4AA73FadfFd71E6549867a37455EA957A52Cf849
- Pending: ownership transfer requires 0.002 BNB gas — user funding tonight
- transfer-ownership.js script is ready — restart watcher when user is ready

## Mercury Bank USD Cashout System
Integration with Mercury Business Banking API allows students to add encrypted bank details and request KENO-to-USD withdrawals, with admin approval leading to ACH transfers.

# External Dependencies

-   **elliptic**: secp256k1 elliptic curve cryptography.
-   **crypto-js**: SHA-256 hashing.
-   **express**: REST API server framework.
-   **cors**: Cross-origin resource sharing.
-   **Node.js**: JavaScript runtime environment.
-   **npm**: Package manager.
-   **Stripe**: Corporate plan subscription management and billing.
-   **PayPal**: USD deposit/withdrawal integration.
-   **CoinGecko API**: Real-time crypto market data.
-   **PostgreSQL**: Database for corporate/team plan, Wealth Builder Program, and ICO investor dashboard.
-   **OpenAI GPT-4o-mini**: AI Customer Support chatbot.
-   **Replit AI Integrations**: Integration for AI Customer Support.
-   **Printful**: Automated merchandise order fulfillment.
-   **Replit Mail**: Email notifications.
-   **Mercury Bank API**: Business banking for USD cashouts via ACH transfers.
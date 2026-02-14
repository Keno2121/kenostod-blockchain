# Overview

Kenostod Blockchain Academy is an educational platform offering a blockchain simulator and the Knowledge Utility Token (KUT) KENO. KENO is earned by completing 21 educational courses and grants access to Flash Arbitrage Loan (FAL™) features. The platform aims to create a self-funding ecosystem where graduates generate revenue through FAL™, fostering employment and funding scholarships. KENO is a BEP-20 utility token, not a security, verified on BscScan.

The future vision includes the T.D.I.R. Foundation, an offshore umbrella foundation for all investments, integrating projects like solar energy with KENO holder discounts. The "Kingdom Philosophy" emphasizes a democratized wealth-building model through RVT NFTs, FALP pooled profits, and referral programs, ensuring all participants share in prosperity.

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

## Universal Transaction Layer (UTL)
The UTL infrastructure includes four Solidity smart contracts (UTLFeeCollector, UTLTreasury, UTLStaking, UTLDistribution) for 0.1% fee capture, a 5-tier staking system, Merkle-tree claim distribution, and a 48-hour timelock treasury. A MetaMask Snap provides transaction insights, dashboard, auto-compounding, and weekly reports. Revenue split allocates 60% to stakers, 15% to Kenostod operations, 10% to scholarships, 10% to T.D.I.R., and 5% to insurance.

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
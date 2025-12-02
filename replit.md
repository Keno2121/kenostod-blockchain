# Overview

Kenostod Blockchain Academy is an educational platform featuring a blockchain simulator and a demonstration cryptocurrency, KENO. It aims to teach advanced blockchain concepts like Proof-of-Residual-Value (PoRV), transaction reversal, and social recovery, offering hands-on experience with cryptocurrency fundamentals including dual consensus modes (PoW/PoRV), full wallet functionality, advanced transaction processing, a simulated merchant payment gateway, and an exchange trading simulation. KENO is a real ERC-20/BEP-20 token on the Binance Smart Chain. The project's vision is to provide blockchain education and passive income opportunities, evolving into a self-funding ecosystem where graduates generate revenue through Flash Arbitrage Loans (FAL™) on a live Kenostod Blockchain, creating employment and funding scholarships.

# User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Professional, appealing, fun; market-ready for ROI growth and scalability.
Contact email: kenostod21@gmail.com

# System Architecture

## Core Blockchain & Consensus
The system utilizes a modular blockchain with SHA-256 Proof-of-Work, UTXO-style transactions, secp256k1 digital signatures, a 5-minute transaction reversal window, and social recovery. It supports dual consensus modes: Proof-of-Work and Proof-of-Residual-Value (PoRV), where PoRV generates value via AI/ML computations, creating a deflationary mechanism for KENO. Data persistence is file-based.

## Transaction & Financial Systems
A merchant payment gateway supports registration, API keys, QR code payments, invoicing, KENO/USD conversion, and a 4-tier incentive program. An exchange platform facilitates KENO/USD, KENO/BTC, and KENO/ETH pairs with a full order book and market/limit orders, secured by cryptographic order signature verification. The KENO token features adjustable mining rewards and transaction fees. PayPal integration is used for ICO purchases.

## API Layer & UI/UX
The platform offers a modern, responsive web interface with a tabbed UI, dark theme, animations, custom fonts, and a live crypto ticker. An Express.js REST API server provides over 80 endpoints. The UI supports multi-language internationalization (6 languages), persistent user preferences, a custom modal-based free trial guide, and a "Graduate Club Recognition System" for verified course completion.

## AI Customer Support
An AI-powered chatbot, utilizing OpenAI GPT-4o-mini via Replit AI Integrations, provides 24/7 technical support for platform features and blockchain concepts.

## KENO Arbitrage Revolution™
This system introduces an arbitrage-native educational cryptocurrency with Flash Arbitrage Loans (FAL™), an Arbitrage Incentive Protocol (AIP™), and reputation-based loan limits. It includes performance tracking, scheduled arbitrage competitions, and an educational dashboard. It currently integrates with multiple exchanges (Binance, Coinbase, Kraken, KuCoin, Huobi) to fetch real-time market data for educational arbitrage opportunity calculation, without actual trading.

## Flash Arbitrage Loan Pools (FALP) System
A DeFi-inspired liquidity pooling system where users pool KENO tokens for collective arbitrage opportunities. Features include pool creation with risk levels and lock periods, liquidity deposits, pool borrowing for flash loans, automatic profit distribution, lock period bonuses, risk tiers, a pool leaderboard, and contributor tracking.

## Security Model
Security features include client-side transaction signing, digital signatures, multi-layer transaction validation, cryptographic block linking, transparent token supply tracking, PoRV security, wallet signature authentication, replay attack protection, rate limiting, CSRF protection, input validation, and server-side course verification.

## Corporate/Team Plans (B2B Revenue System)
An enterprise-grade system using PostgreSQL for managing organizations, members, learning progress, and subscriptions, with Stripe integration for billing.

## Wealth Builder Program
This program provides blockchain education and passive income opportunities through a student rewards system, tiered perpetual royalty NFTs (RVT), a scholarship fund, a career center, a referral program, a wealth tracker dashboard, and financial literacy courses, supported by PostgreSQL.

## Student Community System
A platform for student-to-student interaction with discussion topics, a peer help system, graduate mentorship, arbitrage tips sharing, and role badges.

## G.I.F.T. Apparel System
Patent-pending smart apparel with embedded shield technology (NFC/BLE) for Kenostod graduates to recognize each other through proximity detection, light flickering, evolution chimes, and a unique "Eureka" moment for first greetings, with blockchain verification.

## Legal & Licensing System
Provides a legal framework for intellectual property protection and commercial licensing, including Terms of Service, a Commercial Licensing portal, copyright footers, and PostgreSQL tables for managing commercial API licenses.

## Graduate Merchandise Fulfillment System
A complete merchandise request and fulfillment system for verified graduates, including verification, a request form with wallet-based authentication, admin management, and Printful API integration.

## ICO Investor Dashboard System
A comprehensive investor transparency system with a real-time countdown timer, live fundraising metrics, KYC verification submission (Persona/Sumsub readiness), smart contract transparency (BscScan integration), funding progress visualization, token distribution chart, recent investor activity feed, and 24h growth indicators. Utilizes PostgreSQL for data tracking.

## Revenue Systems
Revenue is generated through over 15 streams including ICO token sales, course subscriptions, corporate B2B training, white-label licensing, G.I.F.T. smart apparel, FAL/FALP technology licensing (MACRO); AI chat premium, quiz retakes, featured posts, pool creation/boost, badge minting, arbitrage alerts, tip platform fees, mentor verification (MICRO); and exchange trading fees, merchant gateway fees, FAL/FALP platform fees, NFT secondary sales royalties (PASSIVE). Premium memberships (Student Pro, Trader Pro, Graduate Elite) are also offered.

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
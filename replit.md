# Overview

Kenostod Blockchain Academy is an educational platform offering a blockchain simulator and a demonstration cryptocurrency, KENO. It aims to educate users on advanced blockchain concepts such as Proof-of-Residual-Value (PoRV), transaction reversal, and social recovery. The platform provides hands-on experience with cryptocurrency fundamentals, including dual consensus modes (PoW/PoRV), full wallet functionality, advanced transaction processing, a simulated merchant payment gateway, and an exchange trading simulation. KENO is a real ERC-20/BEP-20 token on the Binance Smart Chain with an ongoing ICO. The project's vision is to provide blockchain education and passive income opportunities to combat economic hardship.

## Future Vision: Live Kenostod Blockchain with Real Arbitrage Revenue

**STRATEGIC EXPANSION (4-Phase Plan, 2025-2028+)**

The Kenostod Blockchain Academy will evolve from an educational platform into a self-funding ecosystem where graduates generate real revenue through Flash Arbitrage Loans on a live Kenostod Blockchain.

### **Phase 1: Educational Foundation (2025-2026) - $150K**
- Launch Private/Public ICO ($3M raise)
- Build student base (target: 100,000+ graduates)
- Perfect educational platform and curriculum
- Create verified Graduate Club Recognition System

### **Phase 2: Regulatory & Licensing (2026-2027) - $300K-$500K**
- Obtain Money Transmitter License (MTL) for target markets
- FinCEN Money Services Business (MSB) registration
- Build KYC/AML compliance infrastructure
- Establish legal entity structure for real trading operations

### **Phase 3: Live Blockchain Development (2027-2028) - $500K-$1M**
- Build native Kenostod Blockchain (Ethereum/Polygon fork, EVM-compatible)
- Develop real Flash Arbitrage Loan (FAL™) smart contracts
- Implement multi-exchange real-time trading integration
- Build career marketplace for blockchain jobs
- Establish security infrastructure (cold storage, insurance)

### **Phase 4: Launch Real Trading Ecosystem (2028+) - Revenue Generating**
- Go live with real Flash Arbitrage Loans
- Graduates execute actual trades using reputation-based lending
- Platform takes 20-30% of arbitrage profits
- Graduates earn 70-80% of profits
- KENO token utility: staking for FAL access, gas fees, collateral
- Build job marketplace for validators, developers, traders

**Total Investment Needed:** $1M - $1.65M  
**Revenue Potential (Year 3):** $250M+ annually from arbitrage fees alone

### **The Vision in Action:**
Students learn blockchain arbitrage using live market data → Graduate with real skills → Access live Kenostod Blockchain → Execute Flash Arbitrage Loans → Earn real profit share → Academy profits from platform fees → More scholarships → More graduates → Self-funding cycle

This transforms Kenostod from an educational platform into **a self-funding ecosystem that generates employment and passive income for graduates while funding scholarships for new students.**

For now, the platform focuses on **world-class blockchain education** using real market data to teach concepts, with revenue from subscriptions, ICO, and corporate training. Real trading will launch after Phase 2-3 regulatory and technical work is complete.

# User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Professional, appealing, fun; market-ready for ROI growth and scalability.
Contact email: kenostod21@gmail.com (updated from moheazy81@gmail.com, then from kenostod@gmail.com)

# System Architecture

## Core Blockchain & Consensus
The system features a modular blockchain with SHA-256 Proof-of-Work, UTXO-style transactions, secp256k1 digital signatures, a 5-minute transaction reversal window, and a social recovery system. It supports dual consensus modes: Proof-of-Work and Proof-of-Residual-Value (PoRV), where PoRV generates value through Residual Value Tokens (RVTs) via AI/ML computations, creating a deflationary mechanism for KENO. Data persistence is file-based.

## Transaction & Financial Systems
A merchant payment gateway supports registration, API keys, QR code payments, invoicing, KENO/USD conversion, and a 4-tier incentive program. An exchange platform facilitates KENO/USD, KENO/BTC, and KENO/ETH pairs with a full order book and market/limit orders, secured by cryptographic order signature verification. The KENO token has an adjustable default mining reward and transaction fees. The platform integrates PayPal for ICO purchases, allowing non-crypto users to buy KENO tokens.

## API Layer & UI/UX
The platform offers a modern, responsive web interface with a tabbed UI for various functionalities, including a dark theme, animations, custom fonts, and a live crypto ticker. An Express.js REST API server exposes over 80 endpoints. The UI supports multi-language internationalization (6 languages) and persistent user preferences. Key UX features include a custom modal-based free trial guided tour, streamlined email collection for subscriptions, and a "Graduate Club Recognition System" for users completing all 21 courses, offering exclusive privileges and a unique blockchain-verified Graduate ID.

## AI Customer Support
An AI-powered chatbot provides 24/7 technical support for students using OpenAI GPT-4o-mini via Replit AI Integrations. The floating chat widget assists with wallet creation, transactions, mining, ICO purchases, blockchain concepts, and platform features, supporting multi-turn conversations and quick question buttons.

## KENO Arbitrage Revolution™ (Patent-Pending)
This system introduces an arbitrage-native educational cryptocurrency with features like Flash Arbitrage Loans (FAL™) for instant, zero-fee loans, an Arbitrage Incentive Protocol (AIP™) for bonus rewards, and reputation-based loan limits. It includes performance tracking (leaderboard, NFT badges), scheduled arbitrage competitions, and an educational dashboard. 

**Current Implementation (November 2025)**: Multi-exchange API integration fetches REAL prices from Binance, Coinbase, Kraken, KuCoin, and Huobi exchanges. The system calculates genuine arbitrage opportunities based on actual cross-exchange price differences. All arbitrage activities are **educational only** - no actual trading or money movement occurs. Students learn real arbitrage strategies using live market data.

**Planned Enhancement (Option 3)**: When regulatory licenses and compliance infrastructure are in place, the platform will enable actual trade execution with real profit potential (see Future Vision above).

## Flash Arbitrage Loan Pools (FALP) System
A revolutionary DeFi-inspired liquidity pooling system where users pool their KENO tokens together for collective arbitrage opportunities. Features include:
- **Pool Creation**: Users can create pools with different risk levels (conservative/balanced/aggressive) and lock periods (flexible/7-day/30-day/90-day)
- **Liquidity Deposits**: Contributors deposit KENO to pools and receive proportional share percentages
- **Pool Borrowing**: Arbitrage traders borrow from pools to execute flash loans with 5-minute repayment windows
- **Automatic Profit Distribution**: Successful arbitrage profits are automatically distributed to all pool contributors based on their share percentage
- **Lock Period Bonuses**: Longer lock periods earn higher profit multipliers (1x-2x)
- **Risk Tiers**: Conservative (25% max borrow, 60% profit share), Balanced (50%/70%), Aggressive (75%/80%)
- **Pool Leaderboard**: Top performing pools ranked by total profit distributed
- **Contributor Tracking**: Individual contribution stats, earnings history, and active pool positions
Frontend accessible at /fal-pools.html with full API at /api/fal-pool/*

## Security Model
Security features include client-side transaction signing, digital signatures, multi-layer transaction validation, cryptographic block linking, transparent token supply tracking, PoRV security with cryptographically signed payments, wallet signature authentication, replay attack protection, rate limiting, CSRF protection, input validation, and server-side course verification.

## Corporate/Team Plans (B2B Revenue System)
This enterprise-grade system uses a PostgreSQL database for managing organizations, members, and learning progress. A comprehensive REST API facilitates client onboarding, member invitation, progress tracking, and subscription management, with Stripe integration for billing.

## Wealth Builder Program
This program provides blockchain education and passive income opportunities through a student rewards system (KENO per course), tiered perpetual royalty NFTs (RVT), a scholarship fund, a career center, a referral program, a wealth tracker dashboard, and financial literacy courses, supported by a PostgreSQL database.

## Chat History System
A comprehensive chat history feature allows users to save and review conversations, offering message storage, user association, real-time updates, and search/filter capabilities, supported by a PostgreSQL database.

## Legal & Licensing System
This system provides a legal framework for intellectual property protection and commercial licensing, including Terms of Service, a Commercial Licensing portal, copyright footers, and PostgreSQL tables for managing commercial API licenses and usage tracking.

## Graduate Merchandise Fulfillment System
A complete merchandise request and fulfillment system for verified Kenostod Graduates. It includes graduate verification, a merchandise request form with wallet-based authentication and item selection, an admin management panel for order tracking and status updates, and support for Printful API integration.

## ICO Investor Dashboard System
A comprehensive investor transparency system designed to attract serious investors for the KENO ICO. Features include a real-time countdown timer to Private Sale launch (Nov 28, 2025), live fundraising metrics (total raised, investor count, tokens sold), KYC verification submission and status tracking with Persona/Sumsub integration readiness, smart contract transparency with BscScan integration, funding progress visualization with milestone tracker, token distribution pie chart, recent investor activity feed, and 24h growth indicators. Backend API endpoints provide real-time data refresh for investor statistics, investment recording, and KYC management. PostgreSQL database tables track ICO investors, KYC verifications, and investment statistics with appropriate indexes for performance. The dashboard is accessible at /investor-dashboard.html with prominent navigation from the main site.

## Revenue Systems
Revenue is generated from merchant payment gateway fees (2.5%), exchange trading fees (0.5%), white-label licensing, and graduate merchandise sales. A unified analytics dashboard provides global revenue reporting.

# External Dependencies

-   **elliptic**: For secp256k1 elliptic curve cryptography.
-   **crypto-js**: For SHA-256 hashing.
-   **express**: REST API server framework.
-   **cors**: Enables cross-origin resource sharing.
-   **Node.js**: JavaScript runtime environment.
-   **npm**: Package manager.
-   **Stripe**: For corporate plan subscription management and billing.
-   **PayPal**: For USD deposit/withdrawal integration.
-   **CoinGecko API**: For real-time crypto market data.
-   **PostgreSQL**: For corporate/team plan, Wealth Builder Program, Chat History System, and Graduate Club data persistence.
-   **OpenAI GPT-4o-mini**: For AI Customer Support.
-   **Replit AI Integrations**: For AI Customer Support.
-   **Printful**: For automated merchandise order fulfillment.
-   **Replit Mail**: For email notifications.
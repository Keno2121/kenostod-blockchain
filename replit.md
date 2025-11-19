# Overview

Kenostod Blockchain Academy is an educational platform offering a blockchain simulator and a demonstration cryptocurrency, KENO. It aims to educate users on advanced blockchain concepts such as Proof-of-Residual-Value (PoRV), transaction reversal, and social recovery. The platform provides hands-on experience with cryptocurrency fundamentals, including dual consensus modes (PoW/PoRV), full wallet functionality, advanced transaction processing, a simulated merchant payment gateway, and an exchange trading simulation. KENO is a real ERC-20/BEP-20 token on the Binance Smart Chain with an ongoing ICO. The project's vision is to provide blockchain education and passive income opportunities to combat economic hardship.

## Future Vision: Real Trading Platform (Option 3)

**NOTE FOR FUTURE INVESTMENT**: When financially feasible, the platform will evolve into a licensed real trading platform with:
- **Regulatory Compliance**: Full financial licenses (MSB, MTL, SEC registration)
- **Actual Trade Execution**: Real cryptocurrency trading and arbitrage execution
- **KYC/AML Integration**: Complete identity verification and anti-money laundering systems
- **Insurance & Security**: Custody insurance, cold storage, institutional-grade security
- **Real Profit Potential**: Users can actually execute arbitrage trades and earn real money
- **Estimated Investment Needed**: $200,000 - $500,000 for licenses, compliance, legal, insurance
- **Timeline**: To be determined based on revenue growth from educational platform

For now, the platform focuses on **world-class blockchain education** using real market data to teach concepts, with revenue from subscriptions, ICO, and corporate training.

# User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Professional, appealing, fun; market-ready for ROI growth and scalability.

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
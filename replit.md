# Overview

Kenostod Blockchain Academy is an educational platform featuring a comprehensive blockchain simulator with a demonstration cryptocurrency, KENO. It introduces advanced concepts like Proof-of-Residual-Value (PoRV) consensus, transaction reversal, and social recovery. Built with Node.js, the platform offers hands-on experience in cryptocurrency fundamentals, including dual consensus modes (PoW/PoRV), full wallet functionality, advanced transaction processing, a simulated merchant payment gateway, and an exchange trading simulation. The professional web interface provides over 75 API endpoints. KENO is strictly for educational, virtual financial simulations. Recent multi-language support expands its global reach. New corporate/team plans with PostgreSQL-backed management and Stripe integration target B2B growth and offer scalable solutions for institutional training.

# User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Professional, appealing, fun; market-ready for ROI growth and scalability.

# System Architecture

## Core Blockchain
The system utilizes a modular blockchain with blocks secured by SHA-256 Proof-of-Work and supports an advanced UTXO-style transaction system with secp256k1 digital signatures. It features a 5-minute transaction reversal window and a social recovery system. Dual consensus modes (Proof-of-Work and Proof-of-Residual-Value) are implemented. Data persistence is file-based to prevent data loss.

## Proof-of-Residual-Value (PoRV) Consensus
PoRV is a proprietary mining system that generates economic value via Residual Value Tokens (RVTs), which are royalty-generating NFTs awarded for completing AI/ML computations. Enterprise clients fund these computations, with royalties distributed to RVT holders, KENO token burn, and the treasury, creating a deflationary mechanism. Commercial implementations require a mandatory 10% gross revenue share, enforced via API for compliance.

## Payment Gateway & Exchange
A merchant payment system includes registration, API key generation, QR code payments, invoicing, KENO/USD conversion, and a 4-tier incentive program. An exchange platform supports KENO/USD, KENO/BTC, and KENO/ETH pairs with a full order book, market/limit orders, and cryptographic order signature verification. Security relies on confirmed transactions, cryptographic signing, and multi-layer validation.

## API Layer & UI/UX
A modern, responsive web interface features a tabbed UI for various functionalities like Wallet, Send KENO, Scheduled Payments, Mining, and Exchange. It includes a dark theme, animations, custom fonts, and a live crypto ticker. An Express.js REST API server exposes over 75 endpoints, managed by automated schedulers. The UI supports multi-language internationalization with persistent user preferences.

## Security Model
Security features include client-side transaction signing, digital signatures for all transactions, multi-layer transaction validation, cryptographic linking of blocks, and transparent token supply tracking. PoRV security ensures cryptographically signed payments.

## Token Economics
The KENO token has a default mining reward of 100 tokens per block plus transaction fees, adjustable via community governance.

## Revolutionary Features
Key features include a 5-minute transaction reversal window, native smart scheduled payments, a guardian-based social recovery system, optional cryptographically secured transaction messages, a decentralized reputation system, and community governance.

## Corporate/Team Plans (B2B Revenue System)
This enterprise-grade team management system targets corporate training, universities, and coding bootcamps. It features PostgreSQL-backed database architecture for managing organizations, members, and learning progress. A comprehensive REST API (15 endpoints) facilitates client onboarding, member invitation, progress tracking, and subscription management. Stripe integration handles subscription billing, payment updates, and webhook automation for status changes. Bulk discount pricing is available for larger seat purchases. Learning analytics provide team dashboards, individual reports, and historical tracking.

## Additional Revenue Systems
### Merchant Payment Gateway Fees (2.5%)
The platform earns a 2.5% fee on all merchant transactions, managed by a `RevenueTracker` class with PostgreSQL persistence.
### Exchange Trading Fees (0.5%)
A 0.5% fee is applied to all buy/sell trades on the exchange, integrated into `ExchangeAPI.js` and tracked per user and globally.
### White-Label Licensing ($500-$5,000/month)
Institutions can license the platform technology for their own branded educational programs, offered in tiered pricing with custom branding, API access, and dedicated support. Managed through PostgreSQL and Stripe.
### Unified Revenue Analytics Dashboard
A comprehensive UI and API endpoints provide global revenue reporting, including MRR, ARR, and breakdowns by source, with real-time tracking and projections.

# External Dependencies

-   **elliptic**: For secp256k1 elliptic curve cryptography.
-   **crypto-js**: For SHA-256 hashing.
-   **express**: REST API server framework.
-   **cors**: Enables cross-origin resource sharing.
-   **Node.js**: JavaScript runtime environment.
-   **npm**: Package manager.
-   **Stripe**: For USD deposit/withdrawal integration and corporate plan subscription management.
-   **PayPal**: For USD deposit/withdrawal integration.
-   **CoinGecko API**: For real-time crypto market data.
-   **PostgreSQL**: For corporate/team plan data persistence.
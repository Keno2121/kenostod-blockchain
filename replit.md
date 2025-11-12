# Overview

Kenostod Blockchain Academy is an educational platform centered around a comprehensive blockchain simulator and a demonstration cryptocurrency, KENO. It educates users on advanced blockchain concepts including Proof-of-Residual-Value (PoRV) consensus, transaction reversal, and social recovery. Built with Node.js, the platform offers hands-on experience with cryptocurrency fundamentals, dual consensus modes (PoW/PoRV), full wallet functionality, advanced transaction processing, a simulated merchant payment gateway, and an exchange trading simulation. KENO is now a real ERC-20/BEP-20 token on the Binance Smart Chain, with an ongoing ICO. The platform also includes a B2B system for corporate/team training, a multi-language UI, and a "Wealth Builder Program" aimed at poverty reduction through blockchain education and passive income opportunities.

# User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Professional, appealing, fun; market-ready for ROI growth and scalability.

# System Architecture

## Core Blockchain & Consensus
The system features a modular blockchain secured by SHA-256 Proof-of-Work, supporting UTXO-style transactions with secp256k1 digital signatures. It includes a 5-minute transaction reversal window and a social recovery system. Dual consensus modes, Proof-of-Work and a proprietary Proof-of-Residual-Value (PoRV), are implemented. PoRV generates value via Residual Value Tokens (RVTs) through AI/ML computations funded by enterprise clients, creating a deflationary mechanism for KENO. Data persistence is file-based for security.

## Transaction & Financial Systems
A merchant payment gateway offers registration, API keys, QR code payments, invoicing, KENO/USD conversion, and a 4-tier incentive program. An exchange platform supports KENO/USD, KENO/BTC, and KENO/ETH pairs with a full order book, market/limit orders, and cryptographic order signature verification. Security relies on confirmed transactions, cryptographic signing, and multi-layer validation. The KENO token has a default mining reward of 100 tokens per block plus transaction fees, adjustable via community governance.

## API Layer & UI/UX
A modern, responsive web interface features a tabbed UI for Wallet, Send KENO, Scheduled Payments, Mining, and Exchange. It includes a dark theme, animations, custom fonts, and a live crypto ticker. An Express.js REST API server exposes over 75 endpoints. The UI supports multi-language internationalization (6 languages) with persistent user preferences, including full translation of all 16 educational courses.

## Security Model
Security features include client-side transaction signing, digital signatures, multi-layer transaction validation, cryptographic block linking, and transparent token supply tracking. PoRV security ensures cryptographically signed payments.

## Corporate/Team Plans (B2B Revenue System)
This enterprise-grade system targets corporate training, universities, and coding bootcamps. It uses a PostgreSQL-backed database for managing organizations, members, and learning progress. A comprehensive REST API facilitates client onboarding, member invitation, progress tracking, and subscription management. Stripe integration handles subscription billing and webhooks.

## Wealth Builder Program
This initiative aims to reduce poverty through blockchain education. It includes:
- **Student Rewards System:** KENO token rewards and RVT NFTs for course completion, granting perpetual royalties.
- **Scholarship Fund:** Need-based scholarships for underprivileged students.
- **Career Center & Job Board:** Blockchain job listings and application tracking.
- **Referral Program:** KENO rewards for successful referrals.
- **Wealth Tracker Dashboard:** Real-time net worth visualization.
- **Financial Literacy Courses:** Five new courses focused on generational wealth creation.
The program is revenue-neutral, funded by existing revenue streams, and tracked via seven new PostgreSQL tables.

## Revenue Systems
The platform generates revenue from:
- **Merchant Payment Gateway Fees:** 2.5% on transactions.
- **Exchange Trading Fees:** 0.5% on trades.
- **White-Label Licensing:** Tiered monthly fees for institutional branding.
A unified analytics dashboard provides global revenue reporting.

## ICO Marketing Campaign
A multi-channel marketing campaign supports the KENO Token ICO, including:
- **Email Marketing:** Professional templates for investor outreach, partnerships, and recruitment.
- **Web Landing Pages:** Conversion-optimized ICO campaign, purchase interface (with MetaMask integration), and feature comparison pages.
- **Video Content:** Scripts for main ICO announcement, teasers, how-to-buy tutorials, and deep dives.
- **Press Release Templates:** AP-style templates for launch, funding milestones, partnerships, and product launches.
- **Distribution Strategy:** Multi-channel approach via email, social media, paid ads, and direct journalist outreach.

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
-   **PostgreSQL**: For corporate/team plan and Wealth Builder Program data persistence.
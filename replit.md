# Overview

Kenostod Blockchain Academy is an educational platform featuring a blockchain simulator and a demonstration cryptocurrency, KENO. It aims to educate users on advanced blockchain concepts like Proof-of-Residual-Value (PoRV), transaction reversal, and social recovery. The platform offers hands-on experience with cryptocurrency fundamentals, including dual consensus modes (PoW/PoRV), full wallet functionality, advanced transaction processing, a simulated merchant payment gateway, and an exchange trading simulation. KENO is a real ERC-20/BEP-20 token on the Binance Smart Chain with an ongoing ICO. The project's vision is to break cycles of economic hardship by providing blockchain education and passive income opportunities, acting as a "shield that protects one and their generations from the afflictions of poverty."

# User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Professional, appealing, fun; market-ready for ROI growth and scalability.

# System Architecture

## Core Blockchain & Consensus
The system utilizes a modular blockchain with SHA-256 Proof-of-Work, UTXO-style transactions, secp256k1 digital signatures, a 5-minute transaction reversal window, and a social recovery system. It supports dual consensus modes: Proof-of-Work and Proof-of-Residual-Value (PoRV), where PoRV generates value through Residual Value Tokens (RVTs) via AI/ML computations, creating a deflationary mechanism for KENO. Data persistence is file-based for enhanced security.

## Transaction & Financial Systems
A merchant payment gateway facilitates registration, API keys, QR code payments, invoicing, KENO/USD conversion, and a 4-tier incentive program. An exchange platform supports KENO/USD, KENO/BTC, and KENO/ETH pairs with a full order book and market/limit orders, secured by cryptographic order signature verification. The KENO token has an adjustable default mining reward of 100 tokens per block plus transaction fees. The platform integrates PayPal for ICO purchases, allowing non-crypto users to buy KENO tokens with automatic token delivery to validated wallet addresses. This includes server-side tier enforcement, instant mining, and comprehensive transaction tracking.

## API Layer & UI/UX
The platform features a modern, responsive web interface with a tabbed UI for Wallet, Send KENO, Scheduled Payments, Mining, and Exchange, including a dark theme, animations, custom fonts, and a live crypto ticker. An Express.js REST API server exposes over 75 endpoints. The UI supports multi-language internationalization (6 languages) and persistent user preferences. Key UX improvements include a custom modal-based free trial guided tour and a streamlined email collection for subscriptions, which redirects to Stripe in a new tab to avoid iframe security issues. The platform also includes a "Graduate Club Recognition System" for users who complete all 21 courses, offering exclusive privileges and a unique blockchain-verified Graduate ID.

### Recent Fixes (November 17, 2025)
- **Graduate Club Shield Visualization**: Transformed shield from static cropped image to prominent standalone 3D rotating animation. Shield now rotates continuously as if being admired from all sides (360° Y-axis rotation with subtle X-axis tilt). Features CSS 3D transforms with perspective, enhanced glow effects, pulsing reflection background, and mobile-responsive scaling. Animation creates professional, eye-catching centerpiece for Graduate Club recognition page.
- **Connect Wallet Error Handling**: Improved MetaMask connection error messages with specific troubleshooting steps for locked wallets (error code -32603), pending requests (error code -32002), and missing accounts. Error messages use HTML formatting with line breaks for readability and auto-scroll to visibility.
- **MetaMask Button**: Fixed broken `connectWallet()` function on main page by redirecting to dedicated ICO page (`/ico.html`).
- **Live Sale Statistics**: Replaced perpetual "Loading..." placeholders with static ICO information (Private Sale, $0.01/KENO, deadline, bonus).
- **Subscription Flow**: Fixed Stripe redirect hanging by opening checkout in new tab instead of iframe redirect. Added loading overlay and pop-up blocker fallback.

## Security Model
Security features include client-side transaction signing, digital signatures, multi-layer transaction validation, cryptographic block linking, transparent token supply tracking, and PoRV security with cryptographically signed payments. The Wealth Builder program incorporates robust security measures such as wallet signature authentication, replay attack protection, rate limiting, and server-side course verification.

## Corporate/Team Plans (B2B Revenue System)
This enterprise-grade system, targeting corporate training and universities, uses a PostgreSQL database for managing organizations, members, and learning progress. A comprehensive REST API facilitates client onboarding, member invitation, progress tracking, and subscription management, with Stripe integration for billing and webhooks.

## Wealth Builder Program
This program aims to reduce poverty through blockchain education and passive income. It includes a student rewards system (KENO per course), tiered perpetual royalty NFTs (RVT), a scholarship fund, a career center, a referral program, a wealth tracker dashboard, and financial literacy courses, all backed by a 7-table PostgreSQL database.

## Chat History System
A comprehensive chat history feature allows users to save and review conversations, offering message storage, user association, a professional UI, real-time updates, and search/filter capabilities, supported by a 2-table PostgreSQL database and 6 REST API endpoints.

## Legal & Licensing System
This system provides a legal framework for intellectual property protection and commercial licensing, including Terms of Service, a Commercial Licensing portal, copyright footers, and PostgreSQL tables for managing commercial API licenses and usage tracking.

## Revenue Systems
Revenue is generated from merchant payment gateway fees (2.5%), exchange trading fees (0.5%), and white-label licensing (tiered monthly fees). A unified analytics dashboard provides global revenue reporting.

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
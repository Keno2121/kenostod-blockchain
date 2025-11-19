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
The platform features a modern, responsive web interface with a tabbed UI for Wallet, Send KENO, Scheduled Payments, Mining, and Exchange, including a dark theme, animations, custom fonts, and a live crypto ticker. An Express.js REST API server exposes over 80 endpoints. The UI supports multi-language internationalization (6 languages) and persistent user preferences. Key UX improvements include a custom modal-based free trial guided tour and a streamlined email collection for subscriptions, which redirects to Stripe in a new tab to avoid iframe security issues. The platform also includes a "Graduate Club Recognition System" for users who complete all 21 courses, offering exclusive privileges and a unique blockchain-verified Graduate ID.

## AI Customer Support
An AI-powered chatbot provides 24/7 technical support for students using OpenAI GPT-4o-mini via Replit AI Integrations. The floating chat widget appears on all major pages and assists with wallet creation, transactions, mining, ICO purchases, blockchain concepts, and platform features. Features include multi-turn conversations, quick question buttons, typing indicators, and a professional mobile-responsive UI. Backend powered by 2 REST API endpoints.

## KENO Arbitrage Revolution™ (Patent-Pending)
World's first arbitrage-native cryptocurrency with revolutionary features:
- **Flash Arbitrage Loans (FAL™)**: Zero-fee instant loans (100-10,000 KENO) with 5-minute repayment window, no collateral required
- **Arbitrage Incentive Protocol (AIP™)**: 0.5% bonus rewards for profitable arbitrage trades
- **Reputation-Based Loan Limits**: Dynamic credit scoring with Bronze/Silver/Gold/Platinum tiers (1.5x to 5x multipliers)
- **Performance Tracking**: Global leaderboard, NFT achievement badges, trader profiles with statistics
- **Scheduled Events**: Twice-daily arbitrage competitions with prize pools
- **Cross-Exchange Settlement Bridge**: Cryptographic proof system for transfers (in development)
- **IP Protection**: Comprehensive patent-pending protection, trademarked names, copyright on algorithms
- **Educational Dashboard**: Real-time opportunities, one-click loan management, analytics
**NOTE**: Current implementation uses simulated arbitrage opportunities for educational/demo purposes. Bridge transfers and real exchange integration planned for production release.

### Recent Updates (November 2025)

#### November 19, 2025 (Latest Update)
- **Platform-Wide Enhancements** - Comprehensive improvements across all systems:
  - **Marketing & Growth**: Created dedicated Arbitrage Revolution landing page, added promotional banner to homepage, testimonials page with 9 success stories, referral tracking system
  - **Security**: Implemented comprehensive rate limiting (general 1000/15min, strict 100/15min, auth 20/15min), CSRF protection, input validation
  - **User Experience**: Interactive onboarding tutorial (3-minute guided tour), better error handling, loading states, mobile-responsive design across all new pages
  - **Analytics**: Admin analytics dashboard with ICO sales, arbitrage activity, user engagement, revenue metrics tracking
  - **Deployment**: Configured for autoscale production deployment with optimized settings
  - **Navigation**: Added Success Stories, Referrals, Analytics, and Tutorial links to main navigation
- **KENO Arbitrage Revolution™ System** (Patent-Pending): Launched world's first arbitrage-native cryptocurrency features
  - Flash Arbitrage Loans (FAL™): Zero-fee instant loans (100-10,000 KENO), 5-minute repayment window
  - Arbitrage Incentive Protocol (AIP™): 0.5% bonus rewards for profitable arbitrage
  - Reputation-Based Loan Limits: Bronze→Silver→Gold→Platinum tiers (1.5x to 5x loan multipliers)
  - Performance Tracking: Global leaderboard, NFT achievement badges, trader statistics
  - Scheduled Arbitrage Events: Twice-daily competitions (every 12 hours)
  - Professional Dashboard: Real-time opportunities, loan management, analytics at `/arbitrage.html`
  - IP Protection: Comprehensive patent, trademark & copyright documentation at `/arbitrage-ip-protection.html`
  - Educational Demo: Uses simulated opportunities; production will integrate real exchange APIs
  - 8 new REST API endpoints: flash loans, opportunities, leaderboard, profiles, events, stats, bridge
  - Prominent navigation: Pulsing green button on desktop/mobile menus
- **AI Customer Support System**: Integrated AI-powered chatbot for 24/7 student support using Replit AI Integrations (OpenAI GPT-4o-mini)
  - Floating chat widget appears on all major pages (index, ICO, ICO Dashboard, Black Friday promo)
  - Knowledgeable about all Kenostod features: wallets, transactions, mining, ICO, PoRV, social recovery, Graduate Club
  - Quick question buttons for common inquiries (wallet creation, buying KENO, ICO details, transaction reversal)
  - Maintains conversation history during session for contextual responses
  - Professional UI with typing indicators, smooth animations, mobile-responsive design
  - API endpoints: `/api/support/chat` (multi-turn conversations), `/api/support/quick-question` (single questions)
- **Black Friday Promotional Page**: Created `/black-friday-sale.html` with countdown timer to Nov 28 launch
  - Highlights Private Sale pricing ($0.01/KENO + 20% bonus) vs Public Sale ($0.05)
  - 500% ROI potential calculator, 6 benefit cards, quick questions section
  - Prominent red pulsing navigation buttons on desktop and mobile menus
  - Automatic countdown update to "SALE IS LIVE" when Nov 28 arrives
- **ICO Investment Dashboard Navigation**: Added "💎 My Investments" link to mobile menu for easy access to investment tracking

#### November 18, 2025
- **ICO Timeline Updated**: Private Sale start date moved from November 18 to November 28, 2025 (Black Friday). All dates adjusted:
  - Private Sale: Nov 28 - Dec 28, 2025 (30 days, 20% bonus)
  - Public Sale: Dec 29, 2025 - Feb 27, 2026 (60 days)
  - Updated across all pages: index.html, ico.html, ico-campaign.html
  - Countdown timers reconfigured for new launch date
- **Printful Integration Activated**: Graduate Merchandise system now connected to Printful API for automated order fulfillment
  - One-click "Send to Printful" in admin panel
  - Automatic tracking number updates via webhooks
  - Email notifications via Replit Mail when orders ship/deliver
- **Email Notifications System**: Graduates receive automated emails for merchandise shipments and deliveries using Replit Mail integration

#### November 17, 2025
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

## Graduate Merchandise Fulfillment System
A complete merchandise request and fulfillment system for verified Kenostod Graduates who completed all 21 courses. Features include:
- **Graduate Verification**: Authoritative verification checks `kenostod_graduates` table to ensure only verified graduates can request merchandise
- **Merchandise Request Form** (`/graduate-merchandise.html`): Frontend form with wallet-based authentication, graduate eligibility verification, item selection (pins, ID cards, hoodies, rings, certificates, phone cases), shipping information collection, and order cost calculation (free items + discounted paid items for graduates)
- **Admin Management Panel** (`/admin-merchandise.html`): Secure admin interface with authentication (ADMIN_KEY or ADMIN_WALLETS), real-time order dashboard, status tracking (pending → processing → shipped → delivered), CSV export for fulfillment partners, and Printful integration support
- **Security Features**: Admin endpoint authentication via SecurityMiddleware, comprehensive input validation and sanitization (XSS prevention), SQL injection protection (parameterized queries), graduate status verification, and status whitelist validation
- **Database Schema**: `kenostod_graduates` table stores verified graduates, `graduate_merchandise_orders` table tracks all orders with full shipping details, order status, tracking numbers, and Printful integration fields
- **API Endpoints**: 4 RESTful endpoints for eligibility checking, order submission, admin order retrieval, and status updates
- **Integration**: Supports Printful API for automated print-on-demand fulfillment (manual or automated order placement)

## Revenue Systems
Revenue is generated from merchant payment gateway fees (2.5%), exchange trading fees (0.5%), white-label licensing (tiered monthly fees), and graduate merchandise sales. A unified analytics dashboard provides global revenue reporting.

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
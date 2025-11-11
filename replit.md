# Overview

Kenostod Blockchain Academy is an educational platform featuring a comprehensive blockchain simulator with a demonstration cryptocurrency, KENO. It introduces advanced concepts like Proof-of-Residual-Value (PoRV) consensus, transaction reversal, and social recovery. Built with Node.js, the platform offers hands-on experience in cryptocurrency fundamentals, including dual consensus modes (PoW/PoRV), full wallet functionality, advanced transaction processing, a simulated merchant payment gateway, and an exchange trading simulation. The professional web interface provides over 75 API endpoints. KENO is strictly for educational, virtual financial simulations. Recent multi-language support expands its global reach. New corporate/team plans with PostgreSQL-backed management and Stripe integration target B2B growth and offer scalable solutions for institutional training.

**KENO Token Launch (LIVE ON BSC MAINNET - Deployed Nov 10, 2025):** KENO is now a real ERC-20/BEP-20 cryptocurrency on Binance Smart Chain! Smart contracts successfully deployed:
- **KENO Token:** 0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E
- **Presale Contract:** 0xE26D6fcf7f3d560a8acEB43fa904Bef31b1fB6D0
- **Private Sale:** Starts Nov 11, 2025 | **Public Sale:** Starts Dec 12, 2025
- **Target Raise:** $1.3M-$13M over 6-month ICO timeline
- **Deployment Cost:** ~$4.50 in BNB on BSC mainnet
- **Status:** Live and ready for investments | View on BSCScan

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
A modern, responsive web interface features a tabbed UI for various functionalities like Wallet, Send KENO, Scheduled Payments, Mining, and Exchange. It includes a dark theme, animations, custom fonts, and a live crypto ticker. An Express.js REST API server exposes over 75 endpoints, managed by automated schedulers. The UI supports comprehensive multi-language internationalization (6 languages: English, Spanish, Chinese, Hindi, Portuguese, French) with persistent user preferences. **Complete course translations implemented (Nov 11, 2025):** All 16 educational courses are fully translatable including titles, descriptions, real-world applications, and skill tags across all 6 languages (432 translation keys total). Dynamic skill tag rendering uses secure DOM creation to prevent XSS while maintaining styling consistency across language switches.

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

## ICO Marketing Campaign (Nov 11, 2025)
A comprehensive marketing campaign launched to support the KENO Token ICO and drive investor acquisition. The campaign includes professional email templates, dedicated landing pages, video content strategies, and press release frameworks targeting crypto investors, educational institutions, and media outlets.

### Email Marketing Templates
**File:** MARKETING_EMAIL_TEMPLATES.md - Six professional email templates with audience segmentation: investor outreach, partnership pitches, student recruitment, press/media outreach, and VIP whitelist invitations. Includes subject line optimization, CTA placement best practices, and personalization guidelines.

### Web Landing Pages
- **ICO Campaign Landing Page** (`public/ico-campaign.html`): Conversion-optimized landing page featuring hero section with live sale status, stats bar, revolutionary features showcase (transaction reversal, PoRV mining, RVT NFTs), pricing comparison table, ICO timeline/roadmap, FAQ section, and multiple strategic CTAs. Fully responsive design with custom styling.
- **ICO Purchase Interface** (`public/ico.html`): Functional presale platform with MetaMask wallet integration, live ICO statistics (total raised, tokens sold, current price, phase), BNB-to-KENO conversion calculator, transaction status tracking, and sale information panel. Connects to deployed BSC smart contracts.
- **Feature Comparison Chart** (`public/comparison.html`): Professional competitive analysis comparing KENO against 4 major competitors across 30+ features. Includes print/PDF export and social sharing capabilities.

### Video Content Strategy
**File:** YOUTUBE_VIDEO_SCRIPTS.md - Complete YouTube video production guide for non-technical creators including equipment recommendations, filming setup instructions, and four fully scripted videos:
1. **Main ICO Announcement** (4 min): Scene-by-scene script covering problem statement, KENO solution, investment opportunity, social proof, and CTAs
2. **60-Second Teaser**: Social media optimized viral promo for Instagram, TikTok, Twitter
3. **How to Buy Tutorial** (6 min): Step-by-step MetaMask setup, BSC network configuration, BNB purchase, and ICO participation guide
4. **Deep Dive** (9 min): Technical explanation of PoRV mining, transaction reversal, tokenomics, and real-world utility for educated crypto investors

Includes editing checklists, thumbnail design tips, video description templates, recording schedules, and performance tracking metrics.

### Press Release Templates
**File:** PRESS_RELEASE_TEMPLATES.md - Six AP-style press release templates for different ICO stages and milestones:
1. **ICO Launch Announcement**: Private sale opening with transaction reversal and PoRV mining introduction
2. **Funding Milestone Achievement**: Celebrate capital raise targets ($500K, $1M, $5M+)
3. **Strategic Partnership Announcement**: University/corporate partnerships and integrations
4. **Product/Feature Launch**: RVT NFT marketplace, mobile app, new platform features
5. **Pre-ICO/Whitelist Opening**: Build anticipation for private sale with exclusive bonus
6. **Exchange Listing Announcement**: CEX listings (Binance, Coinbase, etc.)

Includes journalist outreach strategy, distribution channel recommendations (crypto news wires, direct media contact), press calendar, success metrics, and pre-publication checklist.

### Campaign Distribution Strategy
Multi-channel approach combining email marketing (MailChimp/SendGrid), social media (Twitter/X, LinkedIn, Instagram, TikTok), paid advertising (crypto-targeted campaigns), press release distribution (Bitcoin PR Buzz, CryptoPresRelease, PR Newswire), direct journalist outreach (CoinTelegraph, CoinDesk, Decrypt), and community engagement (Reddit, Telegram, Discord).

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
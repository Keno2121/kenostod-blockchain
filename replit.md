# Overview

Kenostod Blockchain Academy is an educational platform featuring a blockchain simulator and a demonstration cryptocurrency, KENO. It educates users on advanced blockchain concepts including Proof-of-Residual-Value (PoRV) consensus, transaction reversal, and social recovery. Built with Node.js, the platform offers hands-on experience with cryptocurrency fundamentals, dual consensus modes (PoW/PoRV), full wallet functionality, advanced transaction processing, a simulated merchant payment gateway, and an exchange trading simulation. KENO is a real ERC-20/BEP-20 token on the Binance Smart Chain with an ongoing ICO. The platform also includes a B2B system for corporate training, a multi-language UI, and a "Wealth Builder Program" aimed at poverty reduction through blockchain education and passive income opportunities. The project's vision is to act as a "shield that protects one and their generations from the afflictions of poverty," breaking cycles of economic hardship.

# User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Professional, appealing, fun; market-ready for ROI growth and scalability.

# System Architecture

## Core Blockchain & Consensus
The system features a modular blockchain secured by SHA-256 Proof-of-Work, supporting UTXO-style transactions with secp256k1 digital signatures. It includes a 5-minute transaction reversal window and a social recovery system. Dual consensus modes, Proof-of-Work and Proof-of-Residual-Value (PoRV), are implemented. PoRV generates value via Residual Value Tokens (RVTs) through AI/ML computations funded by enterprise clients, creating a deflationary mechanism for KENO. Data persistence is file-based for security.

## Transaction & Financial Systems
A merchant payment gateway offers registration, API keys, QR code payments, invoicing, KENO/USD conversion, and a 4-tier incentive program. An exchange platform supports KENO/USD, KENO/BTC, and KENO/ETH pairs with a full order book, market/limit orders, and cryptographic order signature verification. Security relies on confirmed transactions, cryptographic signing, and multi-layer validation. The KENO token has an adjustable default mining reward of 100 tokens per block plus transaction fees.

## API Layer & UI/UX
A modern, responsive web interface features a tabbed UI for Wallet, Send KENO, Scheduled Payments, Mining, and Exchange. It includes a dark theme, animations, custom fonts, and a live crypto ticker. An Express.js REST API server exposes over 75 endpoints. The UI supports multi-language internationalization (6 languages) with persistent user preferences, including full translation of all 16 educational courses. The platform utilizes a professional Emerald Green & Gold Luxury logo for brand identity, with favicon and Apple Touch Icon support.

## Security Model
Security features include client-side transaction signing, digital signatures, multi-layer transaction validation, cryptographic block linking, and transparent token supply tracking. PoRV security ensures cryptographically signed payments. The Wealth Builder program incorporates robust security measures such as wallet signature authentication, replay attack protection, rate limiting, server-side course verification, and database duplicate prevention.

## Corporate/Team Plans (B2B Revenue System)
This enterprise-grade system targets corporate training, universities, and coding bootcamps. It uses a PostgreSQL-backed database for managing organizations, members, and learning progress. A comprehensive REST API facilitates client onboarding, member invitation, progress tracking, and subscription management. Stripe integration handles subscription billing and webhooks.

## Wealth Builder Program
This initiative aims to reduce global poverty through blockchain education and passive income opportunities. Features include a student rewards system (KENO per course), tiered perpetual royalty NFTs (RVT) awarded at milestones, a scholarship fund, a career center, a referral program, a wealth tracker dashboard, and financial literacy courses. It uses a 7-table PostgreSQL database.

## Chat History System
A comprehensive chat history feature allows users to save and review their conversations. It includes conversation management, message storage, user association, a professional UI, real-time updates, and search/filter capabilities. It is backed by a 2-table PostgreSQL database and 6 REST API endpoints.

## Legal & Licensing System
This system provides a comprehensive legal framework for intellectual property protection and commercial licensing. It includes a Terms of Service page, a Commercial Licensing portal with pricing tiers, copyright footers on all pages, and PostgreSQL tables for managing commercial API licenses and usage tracking. Protected features include PoRV, RVT System, Wealth Builder Program, Social Recovery, Transaction Reversal, Merchant Payment Gateway, and all APIs.

## Revenue Systems
The platform generates revenue from merchant payment gateway fees (2.5%), exchange trading fees (0.5%), and white-label licensing (tiered monthly fees). A unified analytics dashboard provides global revenue reporting.

## ICO Marketing Campaign
A multi-channel marketing campaign supports the KENO Token ICO, including email marketing, web landing pages, video content, and press release templates.

## Course Curriculum Backoffice
An admin interface (`/backoffice.html`) provides a comprehensive view of all 21 courses, including detailed modules, learning objectives, knowledge checks, skills assessments, real-world applications, and hands-on projects.

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
-   **PostgreSQL**: For corporate/team plan, Wealth Builder Program, and Chat History System data persistence.
## Graduate Club Recognition System (✅ COMPLETED - November 17, 2025)
An exclusive elite community and recognition system for students who complete all 21 courses.

**Access:** `https://kenostodblockchain.com/graduate-club.html`

**The Graduate Symbol:**
- Visual Design: Emerald green circle with shield icon, gold "21" prominently displayed, "KENOSTOD" text
- Where Displayed: LinkedIn, email signatures, business cards, physical pins/jewelry, phone screens
- Meaning: Completion, protection, breaking poverty cycles

**The Secret Greeting:**
- Greeting: "Shield Up" (one graduate says)
- Response: "Generation Protected" (other graduate responds)
- Secret Handshake: Tap index finger twice on other person's wrist during handshake
- Purpose: Instant recognition between graduates who crossed paths

**Graduate ID System:**
- Format: `KG-YYYYMMDD-XXXX` (e.g., KG-20250315-7A4B)
- Components: KG (Kenostod Graduate) + completion date + last 4 chars of wallet address
- Unique, blockchain-verified, permanent identifier

**Graduate Privileges:**
1. **Platinum RVT NFT**: 2% perpetual royalties ($500-$5,000/month potential)
2. **5,250 KENO**: Total rewards from 21 courses (current value: $525+)
3. **Digital Certificate**: Official certificate with unique ID and blockchain verification
4. **Graduate Network**: Private Slack/Discord channel for worldwide connections
5. **Ambassador Program**: 10% commission on referrals + franchise priority
6. **Speaking Opportunities**: Featured in marketing, podcasts, conferences
7. **Physical Badge Kit**: FREE gold-plated pin + ID card (shipped worldwide)
8. **Job Board Priority**: Exclusive blockchain job postings from partner companies

**Physical Merchandise:**
- Graduate Pin: $29 (FREE for graduates)
- ID Card: $15 (FREE for graduates)
- Graduate Hoodie: $65 ($45 for graduates)
- Shield Ring: $89 ($69 for graduates)
- Framed Certificate: $149 ($99 for graduates)
- Phone Case: $35 ($25 for graduates)

**API Endpoints:**
- `POST /api/graduates/generate-id` - Generate unique Graduate ID upon completion
- `GET /api/graduates/verify/:identifier` - Verify graduate status by ID or wallet
- `GET /api/graduates/leaderboard` - Get top 100 graduates ordered by completion date

**Database:**
- Table: `kenostod_graduates` (PostgreSQL)
- Fields: graduate_id, wallet_address, completion_date, total_courses, keno_earned, rvt_nft_tier, certificate_hash
- Indexes: wallet_address, graduate_id, completion_date

**Files:**
- `/public/graduate-club.html` - Complete Graduate Club page
- `/migrations/007_kenostod_graduates_table.sql` - Database schema
- `GRADUATE_CLUB_GUIDE.md` - Implementation & marketing guide

**Navigation:**
- Added to main navigation (desktop & mobile): 🎓 Graduate Club
- Positioned after Wealth Builder for logical feature grouping

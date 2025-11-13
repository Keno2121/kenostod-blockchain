# Overview

Kenostod Blockchain Academy is an educational platform centered around a comprehensive blockchain simulator and a demonstration cryptocurrency, KENO. It educates users on advanced blockchain concepts including Proof-of-Residual-Value (PoRV) consensus, transaction reversal, and social recovery. Built with Node.js, the platform offers hands-on experience with cryptocurrency fundamentals, dual consensus modes (PoW/PoRV), full wallet functionality, advanced transaction processing, a simulated merchant payment gateway, and an exchange trading simulation. KENO is now a real ERC-20/BEP-20 token on the Binance Smart Chain, with an ongoing ICO. The platform also includes a B2B system for corporate/team training, a multi-language UI, and a "Wealth Builder Program" aimed at poverty reduction through blockchain education and passive income opportunities.

## Custom Domain
**Production URL:** https://kenostodblockchain.com (purchased from Replit)
- Domain automatically connects via Replit Deployments → Domains tab
- SSL/HTTPS certificate provisioned automatically by Replit
- API documentation base URL updated to reflect custom domain
- Stripe callback URLs use `REPLIT_DEV_DOMAIN` environment variable (auto-updates on domain connection)

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

## Wealth Builder Program (✅ COMPLETED - November 12, 2025)
This initiative aims to reduce global poverty through blockchain education and passive income opportunities. 

**IMPLEMENTATION STATUS:** Fully operational with 7-table PostgreSQL database, 12 API endpoints, and complete frontend dashboard at `/wealth-builder.html`.

### Features:
- **Student Rewards System:** 250 KENO per course completed (21 courses total = 5,250 KENO maximum). Anti-fraud protection with course ID validation and UNIQUE constraints prevents duplicate claims.
- **RVT NFT Distribution:** Tiered perpetual royalty NFTs awarded at milestones:
  - Bronze RVT (5 courses): 0.25% of PoRV royalties
  - Silver RVT (10 courses): 0.50% of PoRV royalties  
  - Gold RVT (16 blockchain courses): 1.00% of PoRV royalties
  - Platinum RVT (all 21 courses): 2.00% of PoRV royalties
- **Scholarship Fund:** Need-based application system for underprivileged students with admin approval workflow
- **Career Center:** Blockchain job board with application tracking (target: $50K-$150K/year positions)
- **Referral Program:** Earn KENO rewards for inviting others to the platform
- **Wealth Tracker Dashboard:** Real-time visualization of total net worth (KENO holdings + RVT royalty value + job earnings)
- **Financial Literacy Courses (17-21):** Personal Finance Foundations, Investment Strategies, Wealth Building & Asset Allocation, Generational Wealth Planning, Economic Empowerment & Poverty Reduction

### Database Schema (7 tables):
1. `student_rewards` - Course completion rewards with anti-fraud validation
2. `scholarship_applications` - Need-based scholarship requests
3. `scholarship_fund` - Fund balance tracking
4. `job_listings` - Blockchain career opportunities
5. `job_applications` - Student application tracking
6. `referrals` - Referral rewards system
7. `wealth_tracking` - Historical net worth snapshots

### Security (✅ PRODUCTION-READY - November 12, 2025):
- ✅ **Wallet Signature Authentication:** All endpoints require cryptographic proof of wallet ownership
- ✅ **Replay Attack Protection:** Timestamp included in signed payload, 5-minute expiry window
- ✅ **Rate Limiting (IPv6-Safe):** 10/hour course completions, 3/day scholarships, 20/day jobs, 50/day referrals
- ✅ **Server-Side Course Verification:** 300-second minimum time, 70% minimum quiz score
- ✅ **Database Duplicate Prevention:** UNIQUE constraints on course_progress, student_rewards, job_applications
- ✅ **Course ID Validation:** Only courses 1-21 accepted
- ✅ **Comprehensive Security Guards:** Authentication → Rate Limiting → Validation chain on all endpoints
- ✅ **Architect-Approved:** Production-ready security implementation (see WEALTH_BUILDER_SECURITY_NOTES.md)

### Multilingual Support:
Financial literacy courses translated to English and Spanish (covers 80%+ of users). Navigation links added to main website.

## Chat History System (✅ COMPLETED - November 13, 2025)
A comprehensive chat history feature allows users to save and review their conversations on the platform.

**IMPLEMENTATION STATUS:** Fully operational with 2-table PostgreSQL database, 6 REST API endpoints, and professional frontend interface at `/chat-history.html`.

### Features:
- **Conversation Management:** Create, view, update, and delete chat conversations
- **Message Storage:** Save user messages, assistant responses, and system messages with timestamps
- **User Association:** Link conversations to users via email or wallet address
- **Professional UI:** Two-panel layout with conversations list and message display
- **Real-time Updates:** Conversations automatically update when new messages are added
- **Search & Filter:** Find conversations by user email or wallet address

### Database Schema (2 tables):
1. `chat_conversations` - Stores conversation metadata (id, user info, title, timestamps)
2. `chat_messages` - Stores individual messages (id, conversation_id, role, content, timestamp)

### API Endpoints (6 endpoints):
- `POST /api/chat/conversations` - Create new conversation
- `POST /api/chat/conversations/:id/messages` - Add message to conversation
- `GET /api/chat/conversations` - Get all conversations for a user
- `GET /api/chat/conversations/:id` - Get specific conversation with messages
- `PUT /api/chat/conversations/:id` - Update conversation title
- `DELETE /api/chat/conversations/:id` - Delete conversation

### Navigation:
Chat History link added to main navigation menu (desktop and mobile) at `/chat-history.html`.

## Legal & Licensing System (✅ COMPLETED - November 13, 2025)
Comprehensive legal framework to protect intellectual property and enable commercial licensing.

**IMPLEMENTATION STATUS:** Fully operational legal pages, copyright notices, database schema for API licensing, and commercial licensing portal.

### Features:
- **Terms of Service Page:** Complete legal terms at `/terms-of-service.html` protecting all proprietary features
- **Commercial Licensing Page:** Professional licensing portal at `/licensing.html` with pricing tiers and contact forms
- **Copyright Footers:** Added to all pages (index, wealth-builder, chat-history, docs) with IP protection notices
- **API Licensing Database:** PostgreSQL tables for managing commercial API licenses and usage tracking

### Protected Features Listed:
- Proof-of-Residual-Value (PoRV) Consensus
- Residual Value Token (RVT) System
- Wealth Builder Program
- Social Recovery System
- Transaction Reversal
- Merchant Payment Gateway
- All APIs and documentation

### Database Schema (2 tables):
1. `api_licenses` - Commercial API license management (key, company, type, rate limits, expiration)
2. `api_usage_logs` - API request tracking and usage monitoring

### Licensing Tiers:
- **Startup License:** 1-2 features, up to 10K users, email support
- **Enterprise License:** 3-5 features, up to 100K users, priority support, white-label
- **Custom License:** All features, unlimited users, 24/7 support, source code access

### Copyright Notice:
All pages now include footer with:
- Copyright © 2025 Kenostod Blockchain Academy
- Links to Terms of Service, Licensing, and Privacy Policy
- Clear statement of protected intellectual property
- Call-to-action for commercial licensing

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
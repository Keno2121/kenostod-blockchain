# Overview

Kenostod Blockchain Academy is an educational platform offering a comprehensive blockchain simulator with a demonstration cryptocurrency, KENO. It features advanced concepts like Proof-of-Residual-Value (PoRV) consensus, transaction reversal, and social recovery, not found in mainstream cryptocurrencies. Built with Node.js, the platform aims to provide students, developers, and entrepreneurs with hands-on experience in cryptocurrency fundamentals. It includes dual consensus modes (PoW/PoRV), full wallet functionality, advanced transaction processing, a simulated merchant payment gateway, and an exchange trading simulation. The platform offers a professional web interface with over 75 API endpoints and operates on a subscription model, with KENO strictly for educational, virtual financial simulations. The recent addition of multi-language support (English, Spanish, Mandarin, Hindi, Portuguese, French) aims to expand its global reach to over 3 billion potential users, significantly increasing its market potential and competitive advantage. New corporate/team plans with PostgreSQL-backed management and Stripe integration target B2B growth, offering scalable solutions for institutional training.

# User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Professional, appealing, fun; market-ready for ROI growth and scalability.

# System Architecture

## Core Blockchain Architecture
The system uses a modular blockchain with blocks containing timestamps, transactions, previous block hash, and a nonce for SHA-256 PoW. It employs an advanced UTXO-style transaction system with secp256k1 digital signatures, supporting transaction reversal within a 5-minute window and a social recovery system. It offers dual consensus modes: Proof-of-Work and Proof-of-Residual-Value. Data persistence is file-based (`./data/`) for zero data loss.

## Proof-of-Residual-Value (PoRV) Consensus
PoRV is a proprietary mining system that generates economic value through Residual Value Tokens (RVTs), which are royalty-generating NFTs awarded for completing AI/ML computations. Enterprise clients fund these computations, and royalties are distributed: 50% to RVT holders, 40% KENO token burn, and 10% to the treasury, creating a deflationary mechanism. PoRV technology is protected by a mandatory profit-sharing licensing system requiring a 10% gross revenue share from commercial implementations, enforced via API for registration, payment verification, and compliance tracking.

## Payment Gateway & Exchange
The platform includes a merchant payment system with registration, API key generation, QR code payments, invoicing, KENO/USD conversion, and a 4-tier incentive program. An exchange platform supports KENO/USD, KENO/BTC, and KENO/ETH pairs with a full order book, market/limit orders, cryptographic order signature verification, and trade history. Security relies on confirmed transactions, cryptographic signing, public key verification, and multi-layer validation. USD deposit/withdrawal functions are integrated via Stripe and PayPal.

## API Layer & UI/UX
A modern, responsive web interface provides a tabbed UI for Wallet, Send KENO, Scheduled Payments, Social Recovery, Mining, PoRV Mining, Exchange, and Explorer. It features a dark theme, gradient effects, animations, custom fonts, and a live crypto ticker. An Express.js REST API server exposes over 75 endpoints for all platform functionalities. Automated schedulers manage background processes. The UI supports multi-language internationalization, allowing seamless switching without page reloads and persistence of user language preferences.

## Security Model
Security features include client-side transaction signing (private keys stay on user devices), digital signatures for all transactions, multi-layer transaction validation, cryptographic linking of blocks, and transparent token supply tracking. PoRV security ensures cryptographically signed payments and secure internal transaction creation.

## Token Economics
The KENO token has a default mining reward of 100 tokens per block (governance adjustable) plus transaction fees. Community governance allows token holders to vote on network parameters.

## Revolutionary Features
Key features include a 5-minute transaction reversal window, native smart scheduled payments, a guardian-based social recovery system, optional cryptographically secured transaction messages, a decentralized reputation system, and community governance.

## Corporate/Team Plans (B2B Revenue System - $100K+/year potential)

### Overview
Enterprise-grade team management system for companies and educational institutions training employees/students in blockchain technology. Targets corporate training programs, universities, coding bootcamps, and Web3 companies.

### Database Architecture (PostgreSQL)
**organizations table:**
- `id`: Primary key (auto-increment)
- `name`: Company/institution name
- `owner_email`: Billing contact email
- `owner_wallet_address`: Owner's blockchain wallet
- `company_type`: 'corporate' | 'university' | 'bootcamp'
- `total_seats`: Purchased seat count (default: 10)
- `used_seats`: Active team members count
- `stripe_customer_id`: Stripe customer identifier
- `stripe_subscription_id`: Stripe subscription identifier
- `subscription_status`: 'active' | 'past_due' | 'cancelled'
- `monthly_price`: Subscription cost (decimal)
- `billing_cycle_day`: Day of month for billing
- `created_at`, `updated_at`: Timestamps

**organization_members table:**
- `id`: Primary key
- `organization_id`: Foreign key to organizations
- `user_email`: Team member email
- `user_wallet_address`: Member's blockchain wallet
- `role`: 'owner' | 'admin' | 'member'
- `invite_status`: 'pending' | 'accepted'
- `invited_at`, `joined_at`, `last_active`: Timestamps

**learning_progress table:**
- `id`: Primary key
- `organization_id`: Foreign key to organizations
- `member_id`: Foreign key to organization_members
- `user_wallet_address`: Member's wallet
- `course_name`: Course identifier
- `completion_percentage`: 0-100
- `time_spent_minutes`: Cumulative learning time
- `quiz_score`: Assessment score
- `last_accessed`, `completed_at`: Timestamps

**seat_usage_history table:**
- Historical tracking for billing and capacity planning
- Records seat utilization snapshots over time

### REST API Endpoints (15 total)
1. `POST /api/organization/create` - Onboard new corporate client
2. `GET /api/organization/:id` - Organization details
3. `GET /api/organization/owner/:email` - List owner's organizations
4. `POST /api/organization/:id/invite` - Invite team member (seat limit enforced)
5. `POST /api/organization/invite/:memberId/accept` - Accept invitation
6. `GET /api/organization/:id/members` - List team roster
7. `DELETE /api/organization/:organizationId/member/:memberId` - Remove member
8. `GET /api/organization/:id/progress` - Team analytics dashboard
9. `GET /api/organization/member/:memberId/progress` - Individual progress
10. `POST /api/organization/progress/update` - Track learning activity
11. `POST /api/organization/pricing/calculate` - Bulk discount calculator
12. `POST /api/organization/:id/stripe` - Link Stripe subscription
13. `POST /api/organization/:id/subscription/status` - Update billing status
14. `POST /api/organization/:id/checkout` - Create Stripe checkout session
15. `GET /api/organizations/all` - Admin: List all organizations

### Stripe Integration & Webhook Automation
**Webhook Events Handled:**
- `checkout.session.completed` → Links Stripe customer/subscription IDs to organization
- `customer.subscription.created` → Activates organization subscription
- `customer.subscription.updated` → Updates subscription status
- `customer.subscription.deleted` → Marks organization as cancelled
- `invoice.payment_succeeded` → Reactivates organization (uses DB lookup by subscription ID)
- `invoice.payment_failed` → Sets organization to 'past_due' status

**Implementation:** Webhooks query database to find organization by `stripe_subscription_id`, then update status via OrganizationManager. Organization metadata embedded in Stripe checkout for tracking.

### Bulk Discount Pricing
- **Base**: $20/seat/month ($200 for 10 seats)
- **20-49 seats**: 10% off → $18/seat ($360-$882/month)
- **50-99 seats**: 20% off → $16/seat ($800-$1,584/month)
- **100+ seats**: 30% off → $14/seat ($1,400+ /month)

Universities and large enterprises receive significant volume discounts, making the platform cost-effective at scale.

### Learning Analytics
- **Team Dashboard**: Courses started/completed per member, average completion %, total learning hours
- **Individual Reports**: Per-course progress, quiz scores, time spent, completion dates
- **Historical Tracking**: Learning trends over time for ROI reporting
- **Compliance Reporting**: Course completion verification for corporate training mandates

### Security & Performance
- Parameterized SQL queries (prevents SQL injection)
- PostgreSQL foreign key constraints (referential integrity)
- Indexes on organization_id and member_id (query optimization)
- SSL database connections (Neon/Replit PostgreSQL)
- Graceful degradation (503 responses if DB unavailable)
- Async/await pattern (non-blocking I/O)

### Future Enhancements
- Role-based access control middleware (endpoint-level permissions)
- Admin Dashboard UI (visual team analytics)
- SCORM/xAPI integration (enterprise LMS compatibility)
- SSO/SAML authentication (corporate identity providers)
- Custom branding (white-label for institutions)

## Additional Revenue Systems (Multi-Stream Business Model)

### Overview
Three additional revenue generators complement the corporate/team plans, creating a diversified business model with recurring and transaction-based income streams. Combined revenue potential: $100K+/year from institutional clients, plus continuous passive income from merchant and trading fees.

### Revenue Generator #3: Merchant Payment Gateway Fees (2.5%)

**Business Model:** Platform earns 2.5% fee on all merchant transactions processed through the payment gateway.

**Implementation:**
- Centralized `RevenueTracker` class manages all fee tracking with PostgreSQL persistence
- Automatic fee calculation and deduction on every merchant payment
- Real-time revenue tracking per merchant and globally
- Merchant tier pricing (Basic/Professional/Enterprise) with custom fee structures

**Database Architecture:**
```sql
revenue_transactions table:
- id, revenue_source ('merchant_gateway' | 'exchange_trading' | 'white_label_licensing')
- merchant_id, transaction_id, gross_amount, platform_fee, net_amount
- user_address, timestamp, metadata (JSON)
```

**API Endpoints (6 total):**
1. `POST /api/revenue/merchant/transaction` - Record merchant fee
2. `GET /api/revenue/merchant/:merchantId/report` - Merchant revenue report
3. `GET /api/revenue/merchant/all` - Global merchant fee analytics
4. Plus integration with existing merchant payment endpoints

**Revenue Metrics:**
- Total transactions processed
- Average fee per transaction
- Total gross revenue vs. net to merchants
- Top performing merchants

### Revenue Generator #4: Exchange Trading Fees (0.5%)

**Business Model:** Platform earns 0.5% fee on all buy/sell trades executed on the exchange.

**Implementation:**
- Integrated directly into `ExchangeAPI.js` - automatic fee collection on every trade
- Fee rate increased from 0.1% to 0.5% for optimal revenue generation
- Fees tracked per user and globally in `RevenueTracker`
- Trading fee analytics by trading pair (KENO/USD, KENO/BTC, KENO/ETH)

**Fee Calculation:**
```javascript
Trade Value = Quantity × Price
Trading Fee = Trade Value × 0.005 (0.5%)
Platform Revenue += Trading Fee
```

**API Endpoints (4 total):**
1. `POST /api/revenue/exchange/trade` - Record trading fee (auto-called on each trade)
2. `GET /api/revenue/exchange/:address/fees` - User trading fee history
3. `GET /api/revenue/exchange/all` - Global trading fee analytics
4. Plus integration with existing exchange endpoints

**Revenue Metrics:**
- Total trades executed
- Total trading volume (USD)
- Average fee per trade
- Trading fees by pair (KENO/USD, KENO/BTC, KENO/ETH)
- Top traders by volume

### Revenue Generator #7: White-Label Licensing ($500-$5,000/month)

**Business Model:** Institutions can license the entire blockchain platform technology stack for their own branded educational programs.

**Pricing Tiers:**
- **BASIC ($500/month):** Custom branding, 5 domains, email support
- **PROFESSIONAL ($2,000/month):** Unlimited domains, priority support, API access, custom features
- **ENTERPRISE ($5,000/month):** Full customization, source code access, white-label mobile apps, dedicated support

**Database Architecture (PostgreSQL):**
```sql
white_label_licenses table:
- id (serial PK), organization_name, license_id (UUID), tier, status
- monthly_price (decimal), total_revenue, features (JSON array)
- stripe_customer_id, stripe_subscription_id, license_key
- is_active (boolean), created_at, updated_at, expires_at

license_payments table:
- id (serial PK), license_id (FK), amount, payment_method
- stripe_payment_id, status, payment_date, billing_period_start/end
- created_at
```

**API Endpoints (9 total):**
1. `POST /api/revenue/license/create` - Create new license (with Stripe integration)
2. `GET /api/revenue/license/:licenseId` - License details
3. `POST /api/revenue/license/:licenseId/validate` - Validate license key
4. `POST /api/revenue/license/:licenseId/payment` - Record payment
5. `GET /api/revenue/license/:licenseId/payments` - Payment history
6. `GET /api/revenue/license/pricing` - Show pricing tiers
7. `POST /api/revenue/license/:licenseId/upgrade` - Upgrade tier
8. `POST /api/revenue/license/:licenseId/cancel` - Cancel license
9. `GET /api/revenue/licenses/all` - Admin: All licenses

**Features by Tier:**
- License key generation and validation
- Domain whitelisting and verification
- Custom branding asset management
- API rate limiting per tier
- Stripe recurring billing integration
- Automatic revenue tracking

**Security:**
- Cryptographically secure license key generation (UUID v4)
- License validation middleware for white-label endpoints
- Domain verification to prevent unauthorized usage
- Stripe webhook integration for automatic payment tracking

### Unified Revenue Analytics Dashboard

**Global Revenue Reporting:**
- Comprehensive analytics UI (`Revenue` tab) showing all income streams
- Real-time MRR (Monthly Recurring Revenue) and ARR (Annual Recurring Revenue) calculations
- Revenue breakdown by source with percentages
- Projected annual revenue based on current growth

**API Endpoints (3 global reporting):**
1. `GET /api/revenue/report/global` - Complete platform revenue overview
2. `GET /api/revenue/report/breakdown` - Revenue by source percentages
3. `GET /api/revenue/report/monthly` - Monthly revenue trends

**Metrics Tracked:**
- Total Revenue (all sources combined)
- Merchant Gateway Revenue (2.5% fees)
- Exchange Trading Revenue (0.5% fees)
- White-Label Licensing Revenue (MRR from subscriptions)
- Monthly Recurring Revenue (MRR)
- Projected Annual Revenue

**Revenue Dashboard UI Features:**
- Real-time revenue totals with visual breakdowns
- Revenue stream comparison charts
- Merchant-specific revenue reports
- User trading fee history
- White-label license management
- MRR/ARR projections for business planning

### Business Impact
**Revenue Diversification Strategy:**
1. **Subscription Revenue:** Corporate Plans ($100K+/year) + White-Label Licensing ($6K-$60K+/year per client)
2. **Transaction Fees:** Merchant Gateway (2.5%) + Exchange Trading (0.5%)
3. **Scalability:** All revenue streams scale automatically with platform growth
4. **Predictable Income:** MRR from subscriptions + variable income from transaction fees

**Target Market:**
- Universities and coding bootcamps (white-label for blockchain courses)
- Enterprise training programs (corporate plans + white-label)
- Fintech companies (white-label for internal blockchain training)
- Web3 startups (custom branded blockchain simulators)

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
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
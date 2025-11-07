# Overview

Kenostod Blockchain Academy is an educational platform featuring a comprehensive blockchain simulator. It implements KENO, a demonstration cryptocurrency, with advanced features such as Proof-of-Residual-Value (PoRV) consensus, transaction reversal, and social recovery, which are not present in Bitcoin or Ethereum. This Node.js-based simulator is designed for students, developers, and entrepreneurs to gain hands-on experience with cryptocurrency fundamentals.

The platform offers dual consensus modes (PoW/PoRV), full wallet functionality, advanced transaction processing, a simulated merchant payment gateway, and an exchange trading simulation. It includes a professional web interface with over 75 API endpoints for interactive learning and operates on a subscription model for full feature access. KENO is strictly for educational purposes; it is not a real tradeable cryptocurrency, and all financial simulations (exchange, USD balances) are virtual.

# Recent Changes (November 2025)

**Comprehensive Courses Section Added:**
- Added detailed course curriculum section with descriptions of all 15 interactive blockchain features
- Each course includes:
  - "What You'll Learn" - Technical implementation details
  - "Real-World Application" - Practical use cases and market relevance
  - Skill tags highlighting key competencies
- Featured courses (⭐ NEW/REVOLUTIONARY) highlight unique innovations:
  - Transaction Reversal System
  - Smart Scheduled Payments
  - Social Recovery System
  - Decentralized Reputation System
  - Community Governance
  - Proof-of-Residual-Value Mining (REVOLUTIONARY)
- Professional styling with gradient backgrounds, hover effects, and responsive design
- Call-to-action section linking to subscription plans
- Accessible via navigation menu and anchor link (#courses)

**Pricing Modal Enhanced:**
- Fixed non-working "Get Started" and "View Subscription Plans" buttons
- Updated pricing modal with specific feature breakdowns:
  - **Free Tier**: 3 basic features (wallet, explorer, basic mining)
  - **Student Plan ($15/mo)**: 12 interactive features including Transaction Reversal, Scheduled Payments, and Social Recovery
  - **Professional Plan ($35/mo)**: All 15 features + Graduate Mining Program eligibility, priority support, mentoring, and certification
- Clear visual distinction showing exactly what's included vs. locked in each tier
- Bundled most educational content into paid tiers for better value proposition
- Added footer clarifying both plans include unlimited course access, simulators, and API docs
- Added complete modal CSS styling (was previously missing, causing buttons to not work)

**Features Section Added:**
- Created comprehensive Features section (id="features") accessible via navigation
- 16 feature cards showcasing all platform capabilities:
  - 15 Interactive Courses, PoRV Mining, Transaction Reversal, Smart Scheduling
  - Social Recovery, Reputation System, Community Governance
  - Exchange Platform, Payment Gateway, Fiat Integration
  - Blockchain Explorer, Live Analytics, Mobile Ready, Enterprise Security
  - Complete Documentation, Graduate Mining Program
- Professional styling with gradient backgrounds and hover effects
- Call-to-action section with "View Subscription Plans" button
- Resolves issue where Features navigation link had no destination

# User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Professional, appealing, fun; market-ready for ROI growth and scalability.

# System Architecture

## Core Blockchain Architecture
The system employs a modular blockchain architecture with a block structure containing timestamps, transactions, previous block hash, and a nonce for SHA-256 PoW. It features an advanced UTXO-style transaction system using secp256k1 digital signatures, supporting various transaction parameters, a 5-minute reversal window, and a social recovery system for wallet management. The platform offers dual consensus modes (Proof-of-Work and Proof-of-Residual-Value) and uses a file-based persistence system (`./data/`) to ensure zero data loss across server restarts.

## Proof-of-Residual-Value (PoRV) Consensus
PoRV is a mining system designed to generate real economic value through Residual Value Tokens (RVTs). RVTs are royalty-generating NFTs awarded to miners for completing AI/ML computations. Enterprise clients submit computational tasks with fees and royalty rates, which are escrowed on-chain. Royalties from commercial usage are automatically distributed: 50% to RVT holders, 40% token burn, and 10% to the treasury. This includes a buy-and-burn deflationary mechanism for the KENO token.

### PoRV Technology Licensing System
PoRV is proprietary technology protected by a mandatory profit-sharing licensing system. Any external platform implementing PoRV for commercial purposes must pay 10% of gross revenue to the technology creator. The licensing system includes:

- **License Registration API**: External platforms register via `/api/porv/license/register` with company details and wallet address
- **Multi-Layer Payment Verification**: Automatic enforcement of creator royalties through:
  - Payment amount verification (must be ≥10% of revenue)
  - Recipient address verification (hardcoded creator address)
  - Cryptographic signature validation (prevents forgery)
  - On-chain submission (immutable audit trail)
- **License Status Management**: Three-state lifecycle (pending → active → suspended) with API-level enforcement
- **Compliance Tracking**: Real-time monitoring of revenue, royalties paid, and compliance percentage per license
- **Usage Reporting**: Licensed platforms report revenue via `/api/porv/license/report-usage` with signed payment transactions
- **Enforcement Mechanisms**: License suspension for non-compliance, legal action for unlicensed usage

This system ensures fair profit-sharing (creator receives 10%, platform keeps 90%) while protecting revolutionary PoRV technology and incentivizing widespread adoption. Technical documentation available in `PORV_LICENSING_TECHNICAL_DOCS.md`. Licensing UI accessible at `/porv-licensing.html`.

## Payment Gateway & Exchange
The platform includes a merchant payment system with features like registration, API key generation, QR code-based payments, invoice management, automatic KENO/USD conversion, and a 4-tier incentive program. An exchange trading platform supports KENO/USD, KENO/BTC, and KENO/ETH pairs with a full order book, market and limit orders, cryptographic order signature verification, and trade history. Security is maintained through confirmed transactions, cryptographic signing, public key verification, and multi-layer validation. USD deposit/withdrawal functionality is integrated via Stripe and PayPal.

## API Layer & UI/UX
A modern, responsive web interface provides a tabbed UI for various functionalities like Wallet, Send KENO, Scheduled Payments, Social Recovery, Mining, PoRV Mining, Exchange, and Explorer. It features a dark theme, gradient effects, animations, custom fonts, and a live crypto ticker. An Express.js REST API server exposes over 75 endpoints for all blockchain, payment gateway, exchange, and crypto market data functionalities. Automated schedulers handle background processes such as transaction processing and social recovery cleanup.

## Security Model
Security features include client-side transaction signing (private keys remain on user's device), digital signatures for all transactions, multi-layer transaction validation, cryptographic linking of blocks for chain integrity, and transparent token supply tracking. PoRV security includes cryptographically signed payments, secure internal transaction creation, and multi-layer balance checks.

## Token Economics
The KENO token has a default mining reward of 100 tokens per block (governance adjustable) plus transaction fees. Community governance allows token holders to vote on network parameters like mining rewards, difficulty, and minimum fees.

## Revolutionary Features
The platform boasts unique features: a 5-minute transaction reversal window, native smart scheduled payments, a guardian-based social recovery system, optional cryptographically secured transaction messages, a decentralized reputation system, and community governance for network parameters.

# External Dependencies

-   **elliptic**: For secp256k1 elliptic curve cryptography.
-   **crypto-js**: For SHA-256 hashing.
-   **express**: REST API server framework.
-   **cors**: Enables cross-origin resource sharing.
-   **Node.js**: JavaScript runtime environment.
-   **npm**: Package manager.
-   **Stripe**: For USD deposit/withdrawal integration.
-   **PayPal**: For USD deposit/withdrawal integration.
-   **CoinGecko API**: For real-time crypto market data.
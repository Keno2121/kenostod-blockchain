# Overview

**Kenostod Blockchain Academy** is an educational platform for learning blockchain development using a complete, feature-rich blockchain simulation. The platform implements KENO, a demonstration cryptocurrency, with advanced features including Proof-of-Residual-Value (PoRV) consensus, transaction reversal, social recovery, and more—features not found in Bitcoin or Ethereum. This is a Node.js-based educational simulator designed for students, developers, and entrepreneurs to learn cryptocurrency fundamentals hands-on.

**IMPORTANT**: KENO is for educational purposes only. It is NOT a real tradeable cryptocurrency. The blockchain runs locally as a simulation with JSON file persistence. The exchange uses simulated market makers, and USD balances are virtual accounting for demonstration purposes only.

The educational platform includes: dual consensus modes (PoW/PoRV), wallet functionality, advanced transaction processing, merchant payment gateway simulation, exchange trading simulation, and a professional web interface with 75+ API endpoints for hands-on learning. Students can explore features absent in leading cryptocurrencies through practical experience. The platform includes a subscription model ($15-$35/month) for full access to all learning features.

# Recent Changes

## November 4, 2025 - Stripe Subscription System Implementation (PRODUCTION READY)
- **Implemented**: Complete Stripe subscription billing system for recurring revenue
- **Backend Changes**:
  - Added 8 subscription methods to StripeIntegration.js (createProduct, createPrice, createCheckoutSession, createCustomerPortalSession, retrieveSubscription, cancelSubscription, listProducts, listPrices)
  - Added 7 API endpoints to server.js for subscription management
  - Webhook endpoint positioned BEFORE express.json() middleware to preserve raw body for signature verification
  - Fixed test-mode webhook payload parsing (Buffer.toString() conversion)
- **Frontend Changes**:
  - Updated pricing modal buttons to call real Stripe checkout
  - Added subscribeToplan() function with email collection
  - Smart price ID validation (blocks placeholder IDs, allows real Stripe price IDs)
  - Success/cancel URL handling with user-friendly messages
  - STRIPE_PRICE_IDS configuration with clear setup instructions
- **Security**:
  - Webhook signature verification with STRIPE_WEBHOOK_SECRET
  - Test mode detection throughout
  - Error handling on all endpoints
  - Raw body preservation for Stripe signature validation
- **Revenue Model**: Student ($15/mo), Professional ($35/mo), Free ($0)
- **Production Status**: ✅ READY - User needs to create Stripe products and update price IDs
- **Files Modified**: src/StripeIntegration.js, server.js, public/index.html, replit.md

## November 4, 2025 - Educational Platform Transformation
- **MAJOR PIVOT**: Repositioned from "real cryptocurrency" to "educational learning platform"
- **User Context**: User discovered the system was a simulation (not real blockchain) after paying for development and expecting revenue generation. After exploring options for real deployment (Coinbase $100K-$500K, Binance $450K-$1M, ERC-20 token $5.5K-$22K), user chose Option 1: Educational Platform with $0 upfront cost and subscription revenue model.
- **Changes Implemented**:
  - Rebranded to "Kenostod Blockchain Academy" throughout UI
  - Added prominent educational disclaimer banner (orange/red gradient, animated)
  - Updated all feature cards from "feature" to "Learn: feature name"
  - Changed CTAs: "Start Learning Free", "View Tutorials", "Subscribe for Full Access"
  - Created pricing modal with 3 tiers: Free ($0), Student ($15/mo), Professional ($35/mo)
  - Updated page title, headers, and messaging to emphasize education
  - Added CSS for educational banner (60px), pricing modal, and pricing cards
  - Adjusted container margin-top to 110px (60px banner + 50px ticker)
- **Revenue Model**: Subscription-based access to full platform features
- **Target Audience**: Students, developers, entrepreneurs learning blockchain technology
- **Files Modified**: public/index.html, public/style.css, replit.md
- **Technical Note**: Platform remains fully functional as blockchain simulator—all features work, just repositioned as educational tools

## November 4, 2025 - Server Crash Fix (SocialRecovery.js)
- **Fixed**: Server crash in cleanupExpiredRequests() when recoveryRequests Map not properly initialized
- **Solution**: Added safety check to ensure recoveryRequests is iterable before iteration
- **Impact**: Server now gracefully handles edge cases during startup cleanup cycles
- **Files Modified**: src/SocialRecovery.js (line 252-256)

## November 4, 2025 - Withdrawal System Simplification (Stripe Direct Payout)
- **Implemented**: Simplified withdrawal system for personal use - funds go directly to Stripe-connected bank account
- **Changes**: 
  - Removed individual bank account management (no longer needed)
  - Stripe payouts now send to the account owner's connected bank automatically
  - Simplified frontend UI - only requires wallet address and amount
  - Balance is saved immediately before Stripe call to prevent double-payout on server crash
  - Error handling restores balance and saves if Stripe payout fails
- **Known Limitation**: System is optimized for personal use. Edge case: if server crashes mid-withdrawal, manual reconciliation may be needed. For production with multiple users, would need full crash-recovery and Stripe reconciliation system.
- **Files Modified**: src/StripeIntegration.js, src/BankingAPI.js, server.js, public/app.js, public/index.html

## November 4, 2025 - Critical Balance Persistence Bug Fix
- **Fixed**: USD balances being reset to $0.00 on page reload despite correct disk persistence
- **Root Cause**: BankingAPI.registerAccount() unconditionally overwrote fiatBalances with 0, erasing loaded balances when frontend re-registered accounts after page refresh
- **Solution**: Modified registerAccount() to preserve existing balances - only initializes to 0 for genuinely new wallets
- **Impact**: USD balances now persist correctly across page reloads and server restarts
- **Files Modified**: src/BankingAPI.js (lines 68-71)

# User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Professional, appealing, fun; market-ready for ROI growth and scalability.

# System Architecture

## Core Blockchain Architecture
The system utilizes a modular blockchain architecture:
-   **Block Structure**: Includes timestamp, transactions, previous block hash, and nonce for SHA-256 PoW.
-   **Advanced Transaction System**: UTXO-style transactions with secp256k1 digital signatures, supporting sender, recipient, amount, fees, optional messages, timestamp validation, and a 5-minute reversal window.
-   **Dual Consensus Modes**: Switchable between traditional Proof-of-Work (PoW) and Proof-of-Residual-Value (PoRV) mining.
-   **Wallet Management**: Elliptic curve key pair generation for wallets (public key as address, private key for signing) with a social recovery system.
-   **Data Persistence**: File-based persistence system (`./data/` directory) storing blockchain state and miner wallet. Blockchain and wallet data automatically saved after mining operations and restored on server restart, ensuring zero data loss across server restarts.

## Proof-of-Residual-Value (PoRV) Consensus
A mining system designed to generate real economic value:
-   **Residual Value Tokens (RVTs)**: Perpetual royalty-generating NFTs awarded to miners for completing valuable AI/ML computations. RVTs entitle holders to ongoing royalties from commercial usage of their work.
-   **Computational Jobs**: Enterprise clients submit AI/ML tasks with upfront fees and royalty rates. Jobs are escrowed on-chain and released to miners upon completion.
-   **Enterprise Client System**: Client onboarding, payment tracking, and usage statistics. Clients pay upfront fees (escrowed) and ongoing royalties.
-   **Automated Royalty Distribution**: Royalties from commercial usage are distributed: 50% to RVT holders, 40% token burn, 10% to treasury.
-   **Buy-and-Burn Deflation**: Royalty fees fund automatic token burns, transparently tracked (`totalMinted`, `totalBurned`, `circulatingSupply`).

## Payment Gateway & Exchange
-   **Merchant Payment System**: Merchant registration, API key generation, QR code-based payment requests (kenostod:// URIs), invoice management, automatic KENO/USD conversion, payment confirmation (requiring mined transactions), 30-day analytics, and merchant dashboards. Includes a 4-tier merchant incentive program (Bronze, Silver, Gold, Platinum) offering staking rewards, cashback, and reduced transaction fees.
-   **Exchange Trading Platform**: Supports KENO/USD, KENO/BTC, KENO/ETH pairs with a full order book, market and limit orders, cryptographic order signature verification, trade history, and market data (24h high/low/volume).
-   **Security Model**: Payments require confirmed transactions, cryptographic signing of all orders, public key verification, and multi-layer validation to prevent spoofing and unauthorized actions.
-   **Banking Integration**: USD deposit/withdrawal via Stripe and PayPal with automatic fee calculations.

## API Layer & UI/UX
-   **Modern Web Interface**: Tabbed UI for Wallet, Send KENO, Scheduled Payments, Social Recovery, Reputation, Governance, Mining, PoRV Mining, RVT Portfolio, Enterprise, Royalty Tracker, Merchant, Exchange, and Explorer. Client-side transaction signing uses `elliptic.js`. Features a professional dark theme, gradient effects, smooth animations, custom fonts (Inter, Space Grotesk), and responsive design.
-   **Live Crypto Ticker**: Real-time scrolling ticker displaying Kenostod network stats, recent transactions, and major crypto market data with auto-refresh and enhanced visuals.
-   **REST API Server**: Express.js server (port 5000, CORS enabled) offering over 75 endpoints for all blockchain functionalities, payment gateway, exchange, and crypto market data.
-   **Automated Schedulers**: Background services for scheduled transaction processing, social recovery cleanup, and governance proposal checks.

## Security Model
-   **Client-Side Transaction Signing**: Private keys remain on the user's device.
-   **Digital Signatures**: All transactions require cryptographic signatures.
-   **Transaction Validation**: Multi-layer validation including signature, balance, and reversal window.
-   **Chain Integrity**: Cryptographic linking of blocks ensures tamper resistance.
-   **Supply Tracking**: Transparent `totalMinted`, `totalBurned`, and `circulatingSupply` accounting.
-   **PoRV Security**: Cryptographically signed payments from enterprise clients, secure internal transaction creation for protocol-controlled addresses, prevention of authorization bypass, and multi-layer balance checks.

## Token Economics
The KENO token has a default mining reward of 100 tokens per block (governance adjustable) plus transaction fees. Balances are calculated from transaction sums. Community governance allows token holders to vote on mining rewards, difficulty, and minimum fees.

## Revolutionary Features
1.  **Transaction Reversal Window**: 5-minute grace period to cancel pending transactions.
2.  **Smart Scheduled Payments**: Native automated recurring and future-dated transactions.
3.  **Social Recovery System**: Guardian-based wallet recovery without private key exposure.
4.  **Transaction Messages**: Optional, cryptographically secured messages attached to transactions.
5.  **Reputation System**: Decentralized 1-5 star rating system for transactions with trust levels.
6.  **Community Governance**: Token-weighted voting on network parameters.

# External Dependencies

-   **elliptic**: For secp256k1 elliptic curve cryptography (wallet generation, transaction signing).
-   **crypto-js**: For SHA-256 hashing (block and transaction hash calculations).
-   **express**: REST API server framework.
-   **cors**: Enables cross-origin resource sharing.
-   **Node.js**: JavaScript runtime environment.
-   **npm**: Package manager.
-   **Stripe**: For USD deposit/withdrawal integration.
-   **PayPal**: For USD deposit/withdrawal integration.
-   **CoinGecko API**: For real-time crypto market data (BTC, ETH, SOL, etc.).
# Overview

Kenostod is a revolutionary Node.js blockchain implementation featuring a native cryptocurrency token, KENO, and the world's first **Proof-of-Residual-Value (PoRV)** consensus mechanism. It introduces six innovative, user-centric features addressing real-world pain points in blockchain technology, plus a groundbreaking economic model that ties mining rewards to commercially valuable AI/ML computations.

**PoRV Innovation**: Unlike traditional mining that wastes energy on meaningless hash calculations, Kenostod miners perform high-value AI/ML work for enterprise clients and receive Residual Value Tokens (RVTs) that generate perpetual royalty income from commercial usage. The system includes automated royalty distribution (50% miners, 40% token burn, 10% treasury) and a buy-and-burn deflation mechanism.

The project includes a complete blockchain system with dual consensus modes (PoW/PoRV), wallet functionality, advanced transaction processing, merchant payment gateway, exchange trading platform, and a professional, market-ready web interface with 75+ REST API endpoints. Kenostod is positioned as the first blockchain built for real people AND real economic value, with features that Bitcoin, Ethereum, and Solana don't have.

# Recent Changes (Latest Updates)

**Date: October 31, 2025 - Payment Gateway & Exchange Launch**
- **Merchant Payment Gateway**: Complete payment processing system allowing businesses to accept KENO payments for real-world purchases with QR codes, invoices, and automatic USD/KENO conversion
- **Exchange Trading Platform**: Full order book system with market and limit orders across three trading pairs (KENO/USD, KENO/BTC, KENO/ETH)
- **Security Architecture**: Production-grade security with confirmed transaction requirements (payments only complete after mining), cryptographic signature verification for all orders, and comprehensive validation preventing spoofing attacks
- **30+ New API Endpoints**: Merchant registration, payment requests, invoice management, order book, trade execution, market data, deposit/withdrawal
- **2 New UI Tabs**: Merchant Dashboard (💳) for businesses and Exchange (📈) for traders with complete functionality
- **QR Code Support**: Automatic kenostod:// protocol URI generation for point-of-sale transactions
- **Conversion Rates**: Real-time KENO/USD conversion with automatic application in payment requests (1 KENO = $0.50 USD initial rate)
- **Merchant Analytics**: 30-day revenue tracking, payment statistics, average payment calculations, and business dashboards
- **Market Data**: 24-hour high/low tracking, volume monitoring, price change percentages for all trading pairs
- **Order Book Management**: Bid/ask aggregation, depth visualization, automatic order matching, partial fill support

**Date: October 30, 2025 - PoRV Consensus Launch**
- **Proof-of-Residual-Value (PoRV) Consensus**: Implemented world's first mining system where miners perform valuable AI/ML computations for enterprise clients instead of wasteful hashing
- **Residual Value Tokens (RVTs)**: Miners receive RVTs that generate perpetual royalty income from commercial API usage of their computational work
- **Enterprise Client System**: Full client onboarding, job creation, and API usage tracking with cryptographic payment verification
- **Automated Royalty Distribution**: 50% to miners, 40% token burn, 10% treasury - fully automated and transparent
- **Buy-and-Burn Deflation**: Royalty-funded token burns with complete supply tracking (totalMinted, totalBurned, circulatingSupply)
- **Dual Consensus Modes**: Toggle between traditional PoW and revolutionary PoRV mining
- **15+ New API Endpoints**: Complete PoRV job lifecycle management, RVT tracking, royalty statistics, and enterprise dashboard
- **Production-Ready Security**: Cryptographic signature verification for all user wallet transactions, system transactions restricted to protocol-controlled addresses only
- **Enhanced Crypto Ticker**: Expanded monitoring to track 10 major cryptocurrencies (BTC, ETH, SOL, ADA, XRP, DOT, DOGE, MATIC, LINK, LTC) with real-time prices, 24h price changes, trading volumes, and market caps from CoinGecko API
- **Improved Ticker Visuals**: Modern CSS animations with glowing effects, pulsing price indicators, hover states, and smooth scrolling. Enhanced typography with better formatting for crypto prices
- **Better Data Presentation**: Smart price formatting (full decimals for coins <$1, 2 decimals for coins >$1), volume display with B/M/K suffixes, and color-coded price changes
- **Elliptic Library Bundling**: Created UMD browser bundle of elliptic library using Browserify (`public/elliptic.bundle.js`) since CDN versions no longer include browser-ready builds. Bundle is version-controlled and loaded locally for reliable client-side cryptography
- **Reliability Improvements**: 30-second API caching to respect CoinGecko rate limits, improved error handling in crypto ticker updates

**Date: October 25, 2025**
- **Live Crypto Ticker**: Real-time scrolling ticker showing Kenostod blockchain activity, recent transactions, and major crypto market data (BTC, ETH, SOL prices with 24h changes)
- **Professional UI/UX Redesign**: Complete visual overhaul with modern dark theme, gradient effects, smooth animations
- **Marketing-Ready Landing Page**: Compelling value propositions, competitive positioning, feature showcase cards
- **Enhanced Typography**: Custom fonts (Inter, Space Grotesk) for professional appearance
- **Improved User Experience**: Modern card-based layouts, hover effects, responsive design
- **Call-to-Actions**: Clear CTAs for user acquisition ("Get Started Now", "View Documentation", "Try Demo")
- **Feature Highlight Cards**: Six individual cards showcasing each revolutionary feature with benefits
- **Deployment Ready**: Autoscale deployment configured, production security measures in place

# User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Professional, appealing, fun; market-ready for ROI growth and scalability.

# System Architecture

## Core Blockchain Architecture
The system employs a modular blockchain architecture with enhanced components:
- **Block Structure**: Includes timestamp, transactions, previous block's hash, and nonce for SHA-256-based proof-of-work.
- **Advanced Transaction System**: UTXO-style transactions with secp256k1 digital signatures, including sender, recipient, amount, fees, optional messages, timestamp validation, and a 5-minute reversal window.
- **Dual Consensus Modes**: Toggle between traditional Proof-of-Work (PoW) and revolutionary Proof-of-Residual-Value (PoRV) mining.
- **Wallet Management**: Elliptic curve key pair generation for wallets, with public key as address and private key for signing. Features a social recovery system.

## Proof-of-Residual-Value (PoRV) Consensus
World's first mining system that generates real economic value instead of wasting energy:

### Core Components
1. **Residual Value Tokens (RVTs)**: Perpetual royalty-generating NFTs awarded to miners who complete valuable AI/ML computations. Each RVT represents ownership of specific computational work and entitles the holder to ongoing royalties from commercial usage.

2. **Computational Jobs**: Enterprise clients submit AI/ML tasks (training jobs, inference pipelines, data processing) with upfront fees and royalty rates. Jobs are escrowed on-chain and released to miners upon completion.

3. **Enterprise Client System**: Full client onboarding with wallet addresses, payment tracking, and usage statistics. Clients pay upfront fees (escrowed) and ongoing royalties for commercial API usage of miner outputs.

4. **Automated Royalty Distribution**: When enterprise clients use deployed models/outputs commercially, royalties are automatically distributed:
   - **50% to Miners**: Direct payout to RVT holders for their computational work
   - **40% Token Burn**: Deflationary mechanism reducing total supply
   - **10% Treasury**: Network development and sustainability fund

5. **Buy-and-Burn Deflation**: Royalty fees fund automatic token burns with complete transparency (totalMinted, totalBurned, circulatingSupply tracking).

### Economic Flow
1. **Job Creation**: Enterprise client creates computational job with upfront fee → funds escrowed on-chain via cryptographically signed transaction
2. **PoRV Mining**: Miner completes job → receives upfront fee + RVT (perpetual royalty rights)
3. **Commercial Usage**: Client's deployed model generates revenue → API usage tracked
4. **Royalty Payments**: Client pays royalties via signed transaction → automatic 50/40/10 distribution
5. **Token Burns**: 40% of royalties permanently burned → total supply decreases → scarcity increases

## Payment Gateway & Exchange
**Merchant Payment System**:
- Merchant account registration with API key generation
- Payment request creation with QR codes (kenostod:// protocol URIs)
- Invoice generation and management
- Automatic KENO/USD conversion (configurable rates)
- Payment confirmation requiring mined transactions (anti-spoofing)
- 30-day analytics and revenue tracking
- Merchant dashboards with payment statistics

**Exchange Trading Platform**:
- Three trading pairs: KENO/USD, KENO/BTC, KENO/ETH
- Full order book with bid/ask aggregation
- Market orders (instant execution) and limit orders
- Cryptographic order signature verification
- Trade history and user order tracking
- Market data with 24h high/low/volume
- Deposit address generation and withdrawal processing

**Security Model**:
- Payments require confirmed (mined) transactions, preventing cancellation attacks
- All orders cryptographically signed with timestamp verification
- Public key verification prevents unauthorized order placement
- Multi-layer validation: signature, address, amount, expiration, confirmation status

## API Layer
- **Modern Web Interface**: Tabbed UI (Wallet, Send KENO, Scheduled Payments, Social Recovery, Reputation, Governance, Mining, PoRV Mining, RVT Portfolio, Enterprise, Royalty Tracker, Merchant, Exchange, Explorer) with client-side transaction signing using elliptic.js.
- **Live Crypto Ticker**: Fixed-position scrolling ticker displaying real-time Kenostod network stats, recent transactions, and crypto market data with auto-refresh every 30 seconds.
- **REST API Server**: Express.js server (port 5000, CORS enabled) providing 75+ endpoints for blockchain data, transactions, scheduled payments, social recovery, reputation, governance, mining, PoRV, payment gateway, exchange, and crypto market data.
- **Automated Schedulers**: Background services for scheduled transaction processing (30s), social recovery cleanup (hourly), and governance proposal checking (hourly).

## Security Model
- **Client-Side Transaction Signing**: Cryptographic operations performed in the browser; private keys never leave the user's device.
- **Digital Signatures**: All transactions require cryptographic signatures.
- **Transaction Validation**: Multi-layer validation including signature verification, balance checking, and reversal window tracking.
- **Chain Integrity**: Cryptographic linking of blocks ensures tamper resistance.
- **Supply Tracking**: Transparent accounting of `totalMinted`, `totalBurned`, and `circulatingSupply`.
- **PoRV Security Architecture**:
  - **User Wallets → Protocol**: All payments from enterprise clients (job escrow, royalties) require cryptographically signed transactions verified by sender's public key
  - **Protocol → Anywhere**: System transactions from protocol-controlled addresses (escrow pools, royalty pools, treasury, burn address) use secure internal transaction creation with balance verification
  - **Authorization Bypass Prevention**: No API endpoint can spend funds from user wallets without valid signatures; only private key holders can authorize payments
  - **Balance Protection**: Multi-layer balance checks prevent overdrafts in both user transactions and system redistributions

## Token Economics
The native KENO token has a default mining reward of 100 tokens per block (governance adjustable), plus transaction fees. Balances are calculated from transaction sums. Community governance allows token holders to vote on mining rewards, difficulty, and minimum fees.

## Revolutionary Features (Unique to Kenostod)
1.  **Transaction Reversal Window**: 5-minute grace period to cancel pending transactions.
2.  **Smart Scheduled Payments**: Native automated recurring and future-dated transaction system.
3.  **Social Recovery System**: Guardian-based wallet recovery without private key exposure.
4.  **Transaction Messages**: Optional, cryptographically secured messages attached to transactions.
5.  **Reputation System**: Decentralized 1-5 star rating system for transactions with trust levels.
6.  **Community Governance**: Token-weighted voting on network parameters (mining reward, difficulty, minimum fee).

# External Dependencies

-   **elliptic**: For secp256k1 elliptic curve cryptography (wallet generation, transaction signing).
-   **crypto-js**: For SHA-256 hashing (block and transaction hash calculations).
-   **express**: REST API server framework.
-   **cors**: Enables cross-origin resource sharing for web clients.
-   **Node.js**: JavaScript runtime environment.
-   **npm**: Package manager.
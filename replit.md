# Overview

Kenostod is a revolutionary Node.js blockchain implementation featuring a native cryptocurrency token, KENO. It introduces six innovative, user-centric features addressing real-world pain points in blockchain technology. The project includes a complete blockchain system with proof-of-work mining, wallet functionality, advanced transaction processing, and a professional, market-ready web interface with 30+ REST API endpoints. 

Kenostod is positioned as the first blockchain built for real people, not just developers, with features that Bitcoin, Ethereum, and Solana don't have. The platform is designed for maximum scalability and ROI growth potential.

# Recent Changes (Latest Updates)

**Date: October 30, 2025**
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
- **Proof-of-Work Mining**: Adjustable difficulty mining with block rewards and transaction fees.
- **Wallet Management**: Elliptic curve key pair generation for wallets, with public key as address and private key for signing. Features a social recovery system.

## API Layer
- **Modern Web Interface**: Tabbed UI (Wallet, Send KENO, Scheduled Payments, Social Recovery, Reputation, Governance, Mining, Explorer) with client-side transaction signing using elliptic.js.
- **Live Crypto Ticker**: Fixed-position scrolling ticker displaying real-time Kenostod network stats, recent transactions, and crypto market data with auto-refresh every 30 seconds.
- **REST API Server**: Express.js server (port 5000, CORS enabled) providing 30+ endpoints for blockchain data, transactions, scheduled payments, social recovery, reputation, governance, mining, and crypto market data.
- **Automated Schedulers**: Background services for scheduled transaction processing (30s), social recovery cleanup (hourly), and governance proposal checking (hourly).

## Security Model
- **Client-Side Transaction Signing**: Cryptographic operations performed in the browser; private keys never leave the user's device.
- **Digital Signatures**: All transactions require cryptographic signatures.
- **Transaction Validation**: Multi-layer validation including signature verification, balance checking, and reversal window tracking.
- **Chain Integrity**: Cryptographic linking of blocks ensures tamper resistance.
- **Supply Tracking**: Transparent accounting of `totalMinted`, `totalBurned`, and `circulatingSupply`.

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
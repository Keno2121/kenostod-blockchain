# Overview

Kenostod is a pioneering Node.js blockchain implementing a native cryptocurrency, KENO, and the world's first **Proof-of-Residual-Value (PoRV)** consensus mechanism. It introduces six user-centric features addressing common blockchain pain points and an economic model linking mining rewards to commercially valuable AI/ML computations. PoRV allows miners to perform AI/ML work for enterprises, earning Residual Value Tokens (RVTs) that generate perpetual royalty income. The system includes automated royalty distribution (50% miners, 40% token burn, 10% treasury) and a buy-and-burn deflation mechanism.

The project encompasses a complete blockchain system with dual consensus modes (PoW/PoRV), wallet functionality, advanced transaction processing, a merchant payment gateway, an exchange trading platform, and a professional web interface with over 75 REST API endpoints. Kenostod aims to be a blockchain for real people and real economic value, offering features absent in leading cryptocurrencies. It includes a comprehensive banking system for USD deposits/withdrawals via Stripe and PayPal, a revolutionary merchant incentive program with tiered staking rewards (12-24% APY), cashback (2-5%), and significantly reduced transaction fees (0.25-1% vs. 2.9-3.49% USD).

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
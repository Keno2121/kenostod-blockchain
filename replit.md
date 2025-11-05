# Overview

Kenostod Blockchain Academy is an educational platform featuring a comprehensive blockchain simulator. It implements KENO, a demonstration cryptocurrency, with advanced features such as Proof-of-Residual-Value (PoRV) consensus, transaction reversal, and social recovery, which are not present in Bitcoin or Ethereum. This Node.js-based simulator is designed for students, developers, and entrepreneurs to gain hands-on experience with cryptocurrency fundamentals.

The platform offers dual consensus modes (PoW/PoRV), full wallet functionality, advanced transaction processing, a simulated merchant payment gateway, and an exchange trading simulation. It includes a professional web interface with over 75 API endpoints for interactive learning and operates on a subscription model for full feature access. KENO is strictly for educational purposes; it is not a real tradeable cryptocurrency, and all financial simulations (exchange, USD balances) are virtual.

# User Preferences

Preferred communication style: Simple, everyday language.
Design preferences: Professional, appealing, fun; market-ready for ROI growth and scalability.

# System Architecture

## Core Blockchain Architecture
The system employs a modular blockchain architecture with a block structure containing timestamps, transactions, previous block hash, and a nonce for SHA-256 PoW. It features an advanced UTXO-style transaction system using secp256k1 digital signatures, supporting various transaction parameters, a 5-minute reversal window, and a social recovery system for wallet management. The platform offers dual consensus modes (Proof-of-Work and Proof-of-Residual-Value) and uses a file-based persistence system (`./data/`) to ensure zero data loss across server restarts.

## Proof-of-Residual-Value (PoRV) Consensus
PoRV is a mining system designed to generate real economic value through Residual Value Tokens (RVTs). RVTs are royalty-generating NFTs awarded to miners for completing AI/ML computations. Enterprise clients submit computational tasks with fees and royalty rates, which are escrowed on-chain. Royalties from commercial usage are automatically distributed: 50% to RVT holders, 40% token burn, and 10% to the treasury. This includes a buy-and-burn deflationary mechanism for the KENO token.

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
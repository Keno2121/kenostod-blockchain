# Overview

Kenostod is a revolutionary Node.js blockchain implementation featuring a native cryptocurrency token, KENO. It introduces six innovative, user-centric features addressing real-world pain points in blockchain technology. The project includes a complete blockchain system with proof-of-work mining, wallet functionality, advanced transaction processing, and a modern web interface with 20+ REST API endpoints. Kenostod aims to make blockchain both powerful and user-friendly by focusing on practical innovations overlooked by existing platforms.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Blockchain Architecture
The system employs a modular blockchain architecture with enhanced components:
- **Block Structure**: Includes timestamp, transactions, previous block's hash, and nonce for SHA-256-based proof-of-work.
- **Advanced Transaction System**: UTXO-style transactions with secp256k1 digital signatures, including sender, recipient, amount, fees, optional messages, timestamp validation, and a 5-minute reversal window.
- **Proof-of-Work Mining**: Adjustable difficulty mining with block rewards and transaction fees.
- **Wallet Management**: Elliptic curve key pair generation for wallets, with public key as address and private key for signing. Features a social recovery system.

## API Layer
- **Modern Web Interface**: Tabbed UI (Wallet, Send KENO, Scheduled Payments, Social Recovery, Reputation, Governance, Mining, Explorer) with client-side transaction signing using elliptic.js.
- **REST API Server**: Express.js server (port 5000, CORS enabled) providing 30+ endpoints for blockchain data, transactions, scheduled payments, social recovery, reputation, governance, and mining.
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
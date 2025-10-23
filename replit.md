# Overview

Kenostod is a custom blockchain implementation built in Node.js featuring a native cryptocurrency token called KENO. The project implements a complete blockchain system with proof-of-work mining, wallet functionality, transaction processing, and both CLI and REST API interfaces. It serves as an educational blockchain platform that demonstrates core blockchain concepts including cryptographic hashing, digital signatures, mining rewards, and transaction validation.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Blockchain Architecture
The system follows a modular blockchain architecture with four main components:

**Block Structure**: Each block contains a timestamp, list of transactions, reference to the previous block's hash, and a nonce for proof-of-work mining. Blocks are linked together using SHA-256 cryptographic hashing to ensure chain integrity.

**Transaction System**: Implements UTXO-style transactions with digital signatures using elliptic curve cryptography (secp256k1). Transactions include sender address, recipient address, amount, optional fees, and timestamp validation.

**Proof-of-Work Mining**: Uses adjustable difficulty mining where miners compete to find a hash with a specific number of leading zeros. Miners receive block rewards plus transaction fees as incentives.

**Wallet Management**: Wallets are generated using elliptic curve key pairs, where the public key serves as the wallet address and the private key is used for transaction signing.

## API Layer
The system provides three interfaces:

**Web Interface**: Modern web UI with tabbed navigation for wallet management, sending KENO tokens, mining blocks, and exploring the blockchain. Features client-side transaction signing using elliptic.js for enhanced security.

**REST API Server**: Express.js server running on port 5000 with CORS enabled, offering endpoints for blockchain data, balance queries, transaction creation, and mining operations.

**Command Line Interface**: Node.js CLI tool for mining blocks, checking balances, sending tokens, creating wallets, and viewing blockchain statistics.

## Security Model
**Client-Side Transaction Signing**: The web interface performs all cryptographic operations (transaction hashing and signing) locally in the browser using elliptic.js from CDN. Private keys never leave the user's browser or get transmitted to the server, ensuring maximum security.

**Digital Signatures**: All transactions (except mining rewards) must be cryptographically signed by the sender's private key to prevent unauthorized transfers. The server accepts pre-signed transactions with timestamp preservation to ensure signature validation.

**Transaction Validation**: Multi-layer validation including signature verification, balance checking, address format validation, and prevention of self-transfers.

**Chain Integrity**: Each block references the previous block's hash, making the blockchain tamper-resistant through cryptographic linking.

## Token Economics
The native KENO token has a fixed mining reward of 100 tokens per block, with additional transaction fees going to miners. The system tracks balances by calculating the sum of all transactions for each address rather than maintaining account states.

# External Dependencies

## Cryptographic Libraries
- **elliptic**: Provides secp256k1 elliptic curve cryptography for wallet key generation and transaction signing
- **crypto-js**: Supplies SHA-256 hashing functionality for block and transaction hash calculations

## Web Framework
- **express**: Powers the REST API server for blockchain interaction endpoints
- **cors**: Enables cross-origin resource sharing for web-based clients

## Runtime Environment
- **Node.js**: JavaScript runtime environment for executing the blockchain application
- **npm**: Package manager for dependency management and script execution

# Recent Changes (October 2025)

## Web Interface Improvements
- **Fixed tab navigation**: Updated onclick handlers to pass button element reference (`this`) instead of event object for proper tab switching
- **Enhanced security**: Implemented client-side transaction signing using elliptic.js from CDN to ensure private keys never leave the browser
- **Timestamp synchronization**: Server now accepts and preserves client-supplied timestamps for accurate signature validation
- **Library loading**: Configured proper CDN loading for elliptic.js and crypto-js with initialization callbacks

## Deployment Configuration
- Configured for Autoscale deployment to make the blockchain publicly accessible
- Server binds to 0.0.0.0:5000 for external access through Replit's proxy
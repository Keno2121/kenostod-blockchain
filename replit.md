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

# Innovative Features (Unique to Kenostod)

## Transaction Reversal Window
**The "Undo Button" for Blockchain** - A revolutionary safety feature that allows users to cancel pending transactions within a 5-minute grace period before they're mined into a block.

**How it works:**
- When a transaction is submitted, it enters a "reversal window" for 5 minutes
- During this time, only the original sender can cancel the transaction
- Real-time countdown timer shows remaining time
- Once a transaction is mined into a block, it becomes permanent and cannot be cancelled
- Prevents accidental sends, typos, and user errors

**Security:** Transactions are cloned and marked as "confirmed" when mined, preventing double-spend attacks. Only pending transactions with status='pending' can be cancelled.

**API Endpoints:**
- `GET /api/pending/:address` - View cancellable pending transactions
- `POST /api/transaction/cancel` - Cancel a pending transaction within the reversal window

## Smart Scheduled Payments
**Programmable Money Flow** - The blockchain industry's first automated recurring payment and future-dated transaction system.

**Features:**
- **One-time scheduled payments**: Send KENO tokens at a specific future date/time
- **Recurring payments**: Set up automatic payments that repeat at regular intervals (daily, weekly, monthly, etc.)
- **Maximum occurrences**: Limit the number of times a recurring payment executes
- **Automatic execution**: Scheduler runs every 30 seconds to process and execute scheduled transactions
- **Balance protection**: Skips scheduled payments if insufficient balance is available

**Use Cases:**
- Salary payments (recurring monthly)
- Subscription services (recurring weekly/monthly)
- Delayed rewards or vesting schedules
- Allowance distributions
- Automated bill payments

**Security:** Only the sender can cancel their scheduled transactions. Balance is verified before each execution to prevent overdrafts.

**API Endpoints:**
- `POST /api/scheduled` - Create a new scheduled payment
- `GET /api/scheduled/:address` - View all scheduled payments for an address
- `POST /api/scheduled/cancel` - Cancel a scheduled payment

**Schedule Types:**
- `once`: Execute one time at the specified start time
- `recurring`: Execute repeatedly at the specified interval until maxOccurrences is reached

# Recent Changes (October 2025)

## Revolutionary Features Implemented
- **Transaction Reversal Window**: 5-minute grace period to cancel pending transactions
- **Smart Scheduled Payments**: Recurring and future-dated transactions with automatic execution every 30 seconds
- **Enhanced blockchain stats**: Now tracks scheduled transactions in addition to pending transactions

## Web Interface Improvements
- **Pending transaction viewer**: View and cancel your pending transactions with real-time countdown timers
- **Auto-refresh**: Pending transactions list auto-updates every 2 seconds
- **Fixed tab navigation**: Updated onclick handlers to pass button element reference for proper tab switching
- **Enhanced security**: Client-side transaction signing using elliptic.js from CDN
- **Timestamp synchronization**: Server preserves client-supplied timestamps for accurate signature validation

## Deployment Configuration
- Configured for Autoscale deployment to make the blockchain publicly accessible
- Server binds to 0.0.0.0:5000 for external access through Replit's proxy
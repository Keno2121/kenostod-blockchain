# UTL Deployment Guide - Live Networks

## Overview
Deploy UTL (Universal Transaction Layer) smart contracts to BSC and Polygon mainnet
to start generating real USDC residuals from the 0.1% fee capture.

## Contracts Being Deployed
1. **UTLStaking** - Manages USDC participation tracking
2. **UTLDistribution** - Merkle-tree based reward distribution (60% of fees)
3. **UTLTreasury** - Manages the 40% treasury split (15% ops, 10% scholarship, 10% TDIR, 5% insurance)
4. **UTLFeeCollector** - Captures 0.1% fee on every transaction, routes to Treasury + Distribution

## Pre-Deployment Checklist

### What You Need
- [ ] MetaMask wallet with deployer private key
- [ ] BNB for BSC deployment gas (~$5-10 worth)
- [ ] MATIC/POL for Polygon deployment gas (~$1-2 worth)
- [ ] (Optional) BscScan API key for contract verification
- [ ] (Optional) PolygonScan API key for contract verification

### Wallet Addresses Needed
You'll need 4 wallet addresses for the treasury recipients:
- **Operations wallet** - receives 37.5% of treasury (15% of total fees)
- **Scholarship wallet** - receives 25% of treasury (10% of total fees)
- **T.D.I.R. Foundation wallet** - receives 25% of treasury (10% of total fees)
- **Insurance reserve wallet** - receives 12.5% of treasury (5% of total fees)

If not set, all default to the deployer wallet address.

## Setup on Your Windows Computer

### Step 1: Clone/Copy the UTL folder
Copy the entire `utl/` folder to your Windows computer.

### Step 2: Install Dependencies
```bash
cd utl
npm install hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts dotenv
```

### Step 3: Create .env file
Create a file called `.env` in the `utl/` folder:
```
# REQUIRED - Your deployer wallet private key (WITH 0x prefix)
DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# OPTIONAL - Treasury recipient wallets (defaults to deployer if not set)
KENOSTOD_OPS_WALLET=0x...
SCHOLARSHIP_WALLET=0x...
TDIR_WALLET=0x...
INSURANCE_WALLET=0x...

# OPTIONAL - For contract verification on block explorers
BSCSCAN_API_KEY=your_bscscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

**IMPORTANT: Never share your private key. Never commit the .env file to git.**

## Deployment Commands

### Deploy to BSC Mainnet
```bash
npx hardhat run scripts/deploy-utl.js --network bsc
```

### Deploy to Polygon Mainnet
```bash
npx hardhat run scripts/deploy-utl.js --network polygon
```

### Deploy to Testnets First (Recommended)
```bash
# BSC Testnet
npx hardhat run scripts/deploy-utl.js --network bscTestnet

# Polygon Amoy Testnet
npx hardhat run scripts/deploy-utl.js --network polygonAmoy
```

## After Deployment

### Verify Contracts on Block Explorer
```bash
# BSC
npx hardhat run scripts/verify-contracts.js --network bsc

# Polygon
npx hardhat run scripts/verify-contracts.js --network polygon
```

### What Happens Next
1. The deployment script saves a JSON file in `deployments/` with all contract addresses
2. USDC is automatically added as a supported token
3. The FeeCollector is authorized on the Treasury
4. Update the frontend pages (utl-phantom.html, utl-snap.html) with the real contract addresses

## USDC Contract Addresses (Reference)

| Network | USDC Address | Type |
|---------|-------------|------|
| BSC Mainnet | 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d | Binance-Peg USDC |
| Polygon Mainnet | 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 | Native USDC (Circle) |

## Revenue Flow
```
User Transaction
    |
    v
UTLFeeCollector (captures 0.1% fee)
    |
    ├── 60% --> UTLDistribution --> Participants (USDC claims)
    |
    └── 40% --> UTLTreasury
                    ├── 37.5% --> Kenostod Operations (15% of total)
                    ├── 25.0% --> Scholarship Fund (10% of total)
                    ├── 25.0% --> T.D.I.R. Foundation (10% of total)
                    └── 12.5% --> Insurance Reserve (5% of total)
```

## Gas Cost Estimates

| Network | Estimated Deployment Cost |
|---------|--------------------------|
| BSC Mainnet | ~$5-10 in BNB |
| Polygon Mainnet | ~$1-2 in MATIC |
| BSC Testnet | Free (testnet BNB from faucet) |
| Polygon Amoy | Free (testnet MATIC from faucet) |

## Testnet Faucets
- BSC Testnet: https://testnet.bnbchain.org/faucet-smart
- Polygon Amoy: https://faucet.polygon.technology/

## Troubleshooting
- **"insufficient funds"** - Add more BNB/MATIC to your deployer wallet
- **"nonce too low"** - Reset your MetaMask account in Settings > Advanced
- **Verification fails** - Wait a few minutes after deployment, then retry
- **"replacement transaction underpriced"** - Increase gasPrice in hardhat.config.js

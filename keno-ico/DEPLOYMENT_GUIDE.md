# KENO Token & ICO Deployment Guide

This guide walks you through deploying the KENO token and presale contracts to the blockchain.

---

## Prerequisites

1. **MetaMask wallet** with funds for deployment
2. **Node.js** (v18 or later)
3. **Private key** for deployment wallet (KEEP SECRET!)
4. **RPC endpoint** for your chosen network

---

## Deployment Options

### Option A: Binance Smart Chain (BSC) - RECOMMENDED
- **Network:** BSC Mainnet
- **Gas Costs:** ~$3-5 per contract
- **Advantages:** Low fees, high speed, large user base
- **RPC:** https://bsc-dataseed.binance.org/

### Option B: Ethereum Mainnet
- **Network:** Ethereum Mainnet
- **Gas Costs:** ~$50-200 per contract (varies)
- **Advantages:** Most secure, highest liquidity
- **RPC:** https://mainnet.infura.io/v3/YOUR_KEY

---

## Step 1: Setup Environment

1. **Create `.env` file** in `keno-ico` directory:

```bash
PRIVATE_KEY=your_private_key_here
RPC_URL=https://bsc-dataseed.binance.org/
NETWORK=bsc  # or 'ethereum'
```

2. **Install dependencies:**

```bash
cd keno-ico
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install dotenv
```

---

## Step 2: Configure Hardhat

Create `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [process.env.PRIVATE_KEY]
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts: [process.env.PRIVATE_KEY]
    },
    ethereum: {
      url: process.env.RPC_URL,
      chainId: 1,
      accounts: [process.env.PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
```

---

## Step 3: Create Deployment Script

Create `scripts/deploy.js`:

```javascript
const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting KENO Token & Presale deployment...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  const teamWallet = process.env.TEAM_WALLET || deployer.address;
  const treasuryWallet = process.env.TREASURY_WALLET || deployer.address;
  const liquidityWallet = process.env.LIQUIDITY_WALLET || deployer.address;
  const icoWallet = deployer.address;

  console.log("\n📝 Wallet Addresses:");
  console.log("Team Wallet:", teamWallet);
  console.log("Treasury Wallet:", treasuryWallet);
  console.log("Liquidity Wallet:", liquidityWallet);
  console.log("ICO Wallet:", icoWallet);

  console.log("\n1️⃣  Deploying KENO Token...");
  const KENO = await hre.ethers.getContractFactory("KENO");
  const keno = await KENO.deploy(
    teamWallet,
    treasuryWallet,
    liquidityWallet,
    icoWallet
  );
  await keno.waitForDeployment();
  const kenoAddress = await keno.getAddress();
  console.log("✅ KENO Token deployed to:", kenoAddress);

  const privateSaleStart = Math.floor(Date.now() / 1000) + 86400;
  const privateSaleDuration = 30 * 24 * 60 * 60;
  const publicSaleStart = privateSaleStart + privateSaleDuration + 3600;
  const publicSaleDuration = 60 * 24 * 60 * 60;

  console.log("\n2️⃣  Deploying Presale Contract...");
  console.log("Private Sale Starts:", new Date(privateSaleStart * 1000).toLocaleString());
  console.log("Public Sale Starts:", new Date(publicSaleStart * 1000).toLocaleString());
  
  const Presale = await hre.ethers.getContractFactory("KENOPresale");
  const presale = await Presale.deploy(
    kenoAddress,
    privateSaleStart,
    privateSaleDuration,
    publicSaleStart,
    publicSaleDuration
  );
  await presale.waitForDeployment();
  const presaleAddress = await presale.getAddress();
  console.log("✅ Presale Contract deployed to:", presaleAddress);

  console.log("\n3️⃣  Transferring ICO tokens to Presale contract...");
  const icoSupply = hre.ethers.parseEther("300000000");
  const tx = await keno.transfer(presaleAddress, icoSupply);
  await tx.wait();
  console.log("✅ Transferred 300M KENO to Presale contract");

  console.log("\n✨ Deployment Complete!\n");
  console.log("📋 CONTRACT ADDRESSES:");
  console.log("KENO Token:", kenoAddress);
  console.log("Presale Contract:", presaleAddress);
  console.log("\n🔗 Add these to your .env file:");
  console.log(`KENO_TOKEN_ADDRESS=${kenoAddress}`);
  console.log(`PRESALE_CONTRACT_ADDRESS=${presaleAddress}`);

  console.log("\n📝 Next Steps:");
  console.log("1. Verify contracts on BSCScan/Etherscan");
  console.log("2. Add liquidity to DEX");
  console.log("3. Update whitelist for private sale");
  console.log("4. Launch presale website");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

---

## Step 4: Test on Testnet FIRST

**ALWAYS test on testnet before mainnet!**

```bash
# Deploy to BSC Testnet
npx hardhat run scripts/deploy.js --network bscTestnet

# Get free testnet BNB from faucet:
# https://testnet.binance.org/faucet-smart
```

---

## Step 5: Deploy to Mainnet

```bash
# Deploy to BSC Mainnet
npx hardhat run scripts/deploy.js --network bsc

# OR Deploy to Ethereum
npx hardhat run scripts/deploy.js --network ethereum
```

---

## Step 6: Verify Contracts

```bash
# Verify KENO Token
npx hardhat verify --network bsc KENO_TOKEN_ADDRESS "teamWallet" "treasuryWallet" "liquidityWallet" "icoWallet"

# Verify Presale Contract
npx hardhat verify --network bsc PRESALE_CONTRACT_ADDRESS "kenoAddress" "privateSaleStart" "privateSaleDuration" "publicSaleStart" "publicSaleDuration"
```

---

## Step 7: Post-Deployment Setup

### 1. Update Whitelist for Private Sale

```javascript
// scripts/update-whitelist.js
const addresses = [
  "0x1234...",
  "0x5678...",
  // Add whitelisted addresses
];

await presale.updateWhitelistBatch(addresses, true);
```

### 2. Transfer ICO Tokens to Presale

```javascript
const icoSupply = ethers.parseEther("300000000"); // 300M KENO
await keno.transfer(presaleAddress, icoSupply);
```

### 3. Disable Token Whitelist (After ICO)

```javascript
await keno.toggleWhitelist(false); // Allow free trading
```

---

## Step 8: Create Liquidity Pool

After ICO ends:

```javascript
// On PancakeSwap (BSC) or Uniswap (Ethereum)

// 1. Add liquidity
//    - KENO: 50,000,000 tokens
//    - BNB/ETH: $1,000-2,000 worth
//    
// 2. Initial price: ~$0.05 per KENO
// 3. Lock liquidity for 6-12 months (use PinkSale or Unicrypt)
```

---

## Estimated Costs

### BSC Mainnet
- KENO Token deployment: ~$2
- Presale deployment: ~$3
- Token transfers: ~$0.50 each
- **Total:** ~$6-10

### Ethereum Mainnet
- KENO Token deployment: ~$100
- Presale deployment: ~$150
- Token transfers: ~$20 each
- **Total:** ~$250-400

---

## Security Checklist

- [ ] Private key stored securely (NOT in code)
- [ ] Tested on testnet successfully
- [ ] Contract verified on block explorer
- [ ] Ownership transferred to multisig (recommended)
- [ ] Emergency pause function tested
- [ ] Whitelist system working correctly
- [ ] Token supply verified (1B total)
- [ ] Sale caps configured correctly
- [ ] Time locks functioning properly

---

## Troubleshooting

### "Insufficient funds" error
- Check deployer wallet has enough BNB/ETH for gas

### "Nonce too low" error
- Wait a few seconds and try again
- Reset MetaMask transaction history

### "Execution reverted" error
- Check constructor parameters are correct
- Verify RPC endpoint is working

---

## Support

If you encounter issues:
1. Check Hardhat documentation
2. Review BSCScan/Etherscan for transaction details
3. Join Hardhat Discord for support

---

*Last Updated: November 8, 2025*

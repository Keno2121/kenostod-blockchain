# Presale Website Configuration

After deploying your KENO smart contracts, you need to update the presale website configuration.

## Step 1: Deploy Smart Contracts

First, deploy the contracts to BSC Testnet:

```bash
cd keno-ico
npx hardhat run scripts/deploy.js --network bscTestnet
```

This will output two contract addresses:
- KENO Token: `0x123...`
- Presale Contract: `0x456...`

## Step 2: Update Website Configuration

Open `presale-website/app.js` and update these constants:

```javascript
// Replace these with your deployed contract addresses
const PRESALE_CONTRACT_ADDRESS = '0x456...'; // Your presale contract address
const KENO_TOKEN_ADDRESS = '0x123...';       // Your KENO token address

// For BSC Testnet (use during development)
const BSC_CHAIN_ID = '0x61'; // BSC Testnet
const BSC_RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const BSC_TESTNET = true;

// For BSC Mainnet (switch before production launch)
// const BSC_CHAIN_ID = '0x38'; // BSC Mainnet
// const BSC_RPC = 'https://bsc-dataseed.binance.org/';
// const BSC_TESTNET = false;
```

## Step 3: Test on Testnet

1. **Get testnet BNB** from faucet: https://testnet.binance.org/faucet-smart
2. **Open the website** in your browser (open `index.html`)
3. **Connect MetaMask** (make sure you're on BSC Testnet)
4. **Test purchase flow**:
   - Enter BNB amount
   - Check token calculation
   - Submit transaction
   - Verify tokens received

## Step 4: Switch to Mainnet (Before Public Launch)

When ready for production, update `app.js`:

```javascript
const BSC_CHAIN_ID = '0x38'; // BSC Mainnet
const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const BSC_TESTNET = false;
```

Also update the "Binance Smart Chain" text in the presale info section if needed.

## Step 5: Host the Website

Options for hosting:

### Option A: Simple Static Hosting
- Upload to GitHub Pages, Netlify, or Vercel
- Point custom domain to hosting provider
- Free for static sites

### Option B: Integrate with Academy
- Copy files to Academy's `public/` directory
- Create new route `/ico` or `/presale`
- Link from main Academy website

### Option C: IPFS (Decentralized)
- Upload to IPFS
- Get IPFS hash
- Access via any IPFS gateway
- Most decentralized option

## Troubleshooting

### "Presale contract not deployed yet"
- Make sure you updated the contract addresses from placeholders
- Check that addresses are valid (start with 0x and are 42 characters)

### "Please switch to Binance Smart Chain"
- Verify BSC_CHAIN_ID matches your target network
- Testnet: 0x61
- Mainnet: 0x38

### "Not whitelisted" during private sale
- Use the presale contract's `updateWhitelist()` function
- Add user addresses before private sale starts

### Transactions failing
- Check user has enough BNB for gas
- Verify purchase amount is within limits
- Check presale is not paused
- Verify sale period is active

## Security Checklist

Before going live:

- [ ] Contract addresses are correct
- [ ] Network configuration matches deployment (testnet vs mainnet)
- [ ] Presale start times are set correctly
- [ ] Whitelist is populated for private sale
- [ ] Website is hosted on HTTPS
- [ ] Domain SSL certificate is valid
- [ ] Smart contracts are verified on BSCScan
- [ ] Emergency pause function tested
- [ ] Tested full purchase flow on testnet

---

**Need Help?**

If you encounter issues, check:
1. Browser console for errors (F12 → Console)
2. MetaMask transaction history
3. BSCScan for transaction details
4. Hardhat documentation for deployment issues

Good luck with your presale! 🚀

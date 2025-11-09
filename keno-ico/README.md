# KENO Token ICO Project

This project contains the smart contracts and infrastructure for the KENO token Initial Coin Offering (ICO).

## 🎯 Project Overview

- **Token Name:** Kenostod Token (KENO)
- **Token Type:** ERC-20 / BEP-20
- **Total Supply:** 1,000,000,000 KENO
- **ICO Allocation:** 300,000,000 KENO (30%)
- **Target Raise:** $1.3M - $13M

## 📁 Project Structure

```
keno-ico/
├── contracts/
│   ├── KENO.sol              # ERC-20 token contract
│   └── KENOPresale.sol       # ICO presale contract
├── scripts/
│   ├── deploy.js             # Deployment script
│   └── update-whitelist.js   # Whitelist management
├── test/
│   └── keno-test.js          # Test suite
├── presale-website/
│   ├── index.html            # Presale website
│   ├── app.js                # Frontend logic
│   └── styles.css            # Styling
├── TOKENOMICS.md             # Detailed tokenomics
├── DEPLOYMENT_GUIDE.md       # Deployment instructions
└── README.md                 # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd keno-ico
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
PRIVATE_KEY=your_private_key_here
RPC_URL=https://bsc-dataseed.binance.org/
TEAM_WALLET=0x...
TREASURY_WALLET=0x...
LIQUIDITY_WALLET=0x...
```

### 3. Test on Testnet

```bash
npx hardhat run scripts/deploy.js --network bscTestnet
```

### 4. Deploy to Mainnet

```bash
npx hardhat run scripts/deploy.js --network bsc
```

## 📊 Token Features

### KENO Token (KENO.sol)
- ✅ ERC-20 standard compliance
- ✅ Burnable (deflationary mechanism)
- ✅ Pausable (emergency stop)
- ✅ Whitelist system (anti-dump protection)
- ✅ Team token lock (12-month vesting)
- ✅ Ownership transfer capability

### Presale Contract (KENOPresale.sol)
- ✅ Private sale (30 days, $0.01/KENO)
- ✅ Public sale (60 days, $0.05/KENO)
- ✅ Whitelist for private sale
- ✅ Purchase limits (min/max)
- ✅ Sale caps (hard caps)
- ✅ Emergency functions
- ✅ Reentrancy protection

## 💰 Sale Structure

### Private Sale
- **Price:** $0.01 per KENO
- **Allocation:** 50M KENO
- **Duration:** 30 days
- **Whitelist:** Required
- **Target Raise:** $500K

### Public Sale
- **Price:** $0.05 per KENO
- **Allocation:** 250M KENO
- **Duration:** 60 days
- **Whitelist:** Not required
- **Target Raise:** $12.5M

## 🔒 Security Features

1. **Audited Code** - Using OpenZeppelin battle-tested libraries
2. **Reentrancy Protection** - Prevents double-spending attacks
3. **Access Control** - Owner-only functions
4. **Emergency Pause** - Can halt transfers if needed
5. **Time Locks** - Team tokens locked for 12 months
6. **Whitelist System** - Anti-bot protection

## 📝 Documentation

- [TOKENOMICS.md](./TOKENOMICS.md) - Complete tokenomics breakdown
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Step-by-step deployment
- [Smart Contract Documentation](./contracts/) - Inline code documentation

## 🧪 Testing

```bash
# Run test suite
npx hardhat test

# Run with coverage
npx hardhat coverage

# Run specific test
npx hardhat test --grep "should transfer tokens"
```

## 🌐 Networks

### BSC Mainnet (Recommended)
- **Chain ID:** 56
- **RPC:** https://bsc-dataseed.binance.org/
- **Explorer:** https://bscscan.com
- **Gas Cost:** ~$5-10 total deployment

### Ethereum Mainnet
- **Chain ID:** 1
- **RPC:** https://mainnet.infura.io/v3/YOUR_KEY
- **Explorer:** https://etherscan.io
- **Gas Cost:** ~$250-400 total deployment

### Testnets
- **BSC Testnet:** https://testnet.bscscan.com
- **Goerli Testnet:** https://goerli.etherscan.io

## 📞 Support

For questions or issues:
- **Email:** Contact your project lead
- **Documentation:** See DEPLOYMENT_GUIDE.md
- **Emergency:** Pause contracts and contact security team

## ⚠️ Important Notes

1. **ALWAYS test on testnet first**
2. **Keep private keys secure** - Never commit them
3. **Verify contracts** on block explorer after deployment
4. **Set correct wallet addresses** before deploying
5. **Transfer ownership** to multisig after deployment

## 📅 Timeline

- **Month 1-2:** Smart contract development ✅
- **Month 3:** Security audit & marketing
- **Month 4:** Private sale launch
- **Month 5:** Public sale launch
- **Month 6:** DEX listing & trading

## 🎯 Success Metrics

- **Minimum Viable:** $1.3M raised
- **Target:** $5M raised
- **Stretch Goal:** $13M raised

---

## License

MIT License - See LICENSE file for details

---

*Built with ❤️ for the Kenostod Blockchain Academy*
*Last Updated: November 8, 2025*

# KENO Token - PancakeSwap Listing Guide

## Token Information
- **Token Name:** KENO
- **Contract Address:** 0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E
- **Network:** Binance Smart Chain (BSC)
- **Standard:** BEP-20
- **Distribution Wallet:** 0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf

---

## Pre-Listing Checklist

### 1. Token Contract Verification
- [x] Contract deployed on BSC
- [x] Contract verified on BscScan
- [ ] Contract ownership renounced OR multi-sig (optional but builds trust)

### 2. Initial Liquidity Requirements
You'll need to provide initial liquidity in a KENO/BNB or KENO/BUSD pair.

**Recommended Starting Liquidity:**
| Tier | BNB Amount | KENO Amount | Est. USD Value |
|------|------------|-------------|----------------|
| Minimum | 1-2 BNB | Based on price | ~$600-$1,200 |
| Standard | 5-10 BNB | Based on price | ~$3,000-$6,000 |
| Strong | 20+ BNB | Based on price | ~$12,000+ |

**Your DEX Price:** $0.50 per KENO

**Example Calculation for 10 BNB (~$6,000):**
- 10 BNB = ~$6,000
- At $0.50/KENO, you'd pair with 12,000 KENO
- Total pool value: ~$12,000

---

## Step-by-Step Listing Process

### Step 1: Prepare Your Wallet
1. Install MetaMask or Trust Wallet
2. Connect to BSC Mainnet
3. Have your distribution wallet ready with:
   - BNB for gas fees (~0.1 BNB)
   - BNB for liquidity (your chosen amount)
   - KENO tokens for liquidity

### Step 2: Go to PancakeSwap
1. Visit: https://pancakeswap.finance/
2. Click "Connect Wallet"
3. Select your wallet (MetaMask/Trust Wallet)
4. Ensure you're on BSC network

### Step 3: Add Liquidity
1. Go to **Trade > Liquidity**
2. Click **"Add Liquidity"**
3. Select token pair:
   - Token A: **BNB** (or BUSD)
   - Token B: **KENO** (paste contract address)
4. Enter amounts based on your target price
5. Click **"Supply"**
6. Confirm the transaction in your wallet

### Step 4: Lock Liquidity (HIGHLY RECOMMENDED)
Locking liquidity builds investor trust and prevents "rug pulls"

**Popular LP Lockers:**
- **PinkLock:** https://www.pinksale.finance/pinklock
- **Team.Finance:** https://team.finance/
- **Mudra Locker:** https://mudra.website/

**Recommended Lock Period:** 6-12 months minimum

### Step 5: Verify on PancakeSwap
Once liquidity is added, your token is tradeable! To get the official logo displayed:

1. Submit to PancakeSwap GitHub:
   - Fork: https://github.com/pancakeswap/token-list
   - Add your token info to the BSC tokens list
   - Submit pull request

---

## Price Calculation Formula

When adding liquidity, the price is set by the ratio:

```
Price = BNB Amount / KENO Amount
```

**To achieve $0.50 per KENO (assuming BNB = $600):**
```
$0.50 = 0.000833 BNB per KENO

If adding 10 BNB:
KENO needed = 10 / 0.000833 = 12,000 KENO
```

---

## Post-Listing Tasks

### Immediate (Day 1)
- [ ] Verify trading works on PancakeSwap
- [ ] Share trading link with community
- [ ] Monitor initial trading activity
- [ ] Lock LP tokens

### Week 1
- [ ] Submit to CoinGecko (see COINGECKO_LISTING_APPLICATION.md)
- [ ] Submit to CoinMarketCap (see COINMARKETCAP_LISTING_APPLICATION.md)
- [ ] Add trading widget to kenostod.com
- [ ] Announce on social media

### Ongoing
- [ ] Monitor liquidity depth
- [ ] Add more liquidity as needed
- [ ] Track trading volume
- [ ] Engage community

---

## Important Links

### PancakeSwap
- Main Site: https://pancakeswap.finance/
- Add Liquidity: https://pancakeswap.finance/add
- Token List GitHub: https://github.com/pancakeswap/token-list

### KENO Verification
- BscScan: https://bscscan.com/token/0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E
- Distribution Wallet: https://bscscan.com/address/0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf

### LP Lockers
- PinkLock: https://www.pinksale.finance/pinklock
- Team.Finance: https://team.finance/
- Mudra: https://mudra.website/

---

## Trading Link (After Listing)

Once listed, your trading URL will be:
```
https://pancakeswap.finance/swap?outputCurrency=0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E
```

---

## Security Reminders

1. **Never share your private key** with anyone
2. **Double-check contract addresses** before adding liquidity
3. **Lock your LP tokens** to build investor trust
4. **Start with reasonable liquidity** - you can always add more
5. **Test with small amounts first** if unsure

---

## Support

If you need help with the listing process:
- PancakeSwap Docs: https://docs.pancakeswap.finance/
- BSC Documentation: https://docs.bnbchain.org/

---

*Guide prepared for Kenostod Blockchain Academy*
*KENO - Knowledge Utility Token*

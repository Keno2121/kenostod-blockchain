# KENO ICO Whitelist Management Guide

This guide explains how to manage the whitelist for the KENO ICO private sale.

---

## 📋 What is the Whitelist?

The whitelist is a list of wallet addresses that are **allowed to participate in the private sale**. Only whitelisted addresses can buy KENO tokens during the private sale period (Nov 11 - Dec 11, 2025).

**Benefits of private sale:**
- 25% lower price ($0.000024 vs $0.000030)
- Exclusive early access
- Higher purchase limits (5 BNB vs 2 BNB)

---

## 🔧 Setup

Before managing the whitelist, ensure you have:

1. **Private key in Replit Secrets** (already done! ✅)
2. **BNB for gas fees** (~$0.50-$1 per batch of 50 addresses)
3. **Wallet addresses to whitelist** (from your investors)

---

## 📝 Method 1: Add Individual Addresses (Quick & Easy)

### Add single or multiple addresses directly:

```bash
cd keno-ico
npx hardhat run scripts/add-whitelist.js --network bsc 0x1234... 0x5678... 0x9abc...
```

**Example:**
```bash
npx hardhat run scripts/add-whitelist.js --network bsc \
  0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf \
  0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9
```

**Output:**
```
🔐 KENO Presale Whitelist Manager

Managing whitelist with account: 0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf
Account balance: 0.0089 BNB

📝 Adding 2 address(es) to whitelist...

➕ Adding 0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf...
✅ 0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf - Whitelisted! (tx: 0xabc123...)

➕ Adding 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9...
✅ 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9 - Whitelisted! (tx: 0xdef456...)

✨ Whitelist update complete!
```

**Cost:** ~$0.20-$0.30 per address

---

## 📦 Method 2: Batch Add from CSV (Efficient for Many Addresses)

### Step 1: Create a CSV file with addresses

Create a file named `whitelist.csv` in the `keno-ico` folder:

```csv
0x1234567890123456789012345678901234567890
0xabcdefabcdefabcdefabcdefabcdefabcdefabcd
0x9876543210987654321098765432109876543210
```

Or use the example template:
```bash
cp whitelist-example.csv whitelist.csv
# Then edit whitelist.csv with your addresses
```

### Step 2: Run the batch script

```bash
cd keno-ico
node scripts/whitelist-from-csv.js whitelist.csv
```

**Output:**
```
🔐 KENO Presale Batch Whitelist Manager

Managing whitelist with account: 0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf
Account balance: 0.0089 BNB

📝 Found 150 valid address(es)

📦 Processing batch 1 (50 addresses)...
⏳ Transaction submitted: 0xabc123...
✅ Batch whitelisted! Gas used: 2547182
  ✓ 0x1234...
  ✓ 0x5678...
  ... (48 more)

📦 Processing batch 2 (50 addresses)...
✅ Batch whitelisted! Gas used: 2547182

📦 Processing batch 3 (50 addresses)...
✅ Batch whitelisted! Gas used: 2547182

✨ Whitelist batch processing complete!
```

**Cost:** ~$0.50-$1.00 per batch of 50 addresses (much cheaper!)

---

## 🔍 Method 3: Check Whitelist Status

### Verify if addresses are whitelisted:

```bash
cd keno-ico
npx hardhat run scripts/check-whitelist.js --network bsc 0x1234... 0x5678...
```

**Output:**
```
🔍 KENO Presale Whitelist Checker

Checking 2 address(es)...

✅ 0x1234567890123456789012345678901234567890
   Status: Whitelisted
   Already Purchased: 0.0 BNB

❌ 0x9999999999999999999999999999999999999999
   Status: Not whitelisted
```

---

## 🗑️ Method 4: Remove from Whitelist

### Remove addresses (if needed):

```bash
cd keno-ico
npx hardhat run scripts/remove-whitelist.js --network bsc 0x1234... 0x5678...
```

**Use cases for removal:**
- User requested to be removed
- Suspicious activity detected
- Duplicate entry correction

---

## 🎯 Best Practices

### 1. **Verify Addresses Before Adding**
Always double-check addresses are correct. Blockchain transactions are irreversible!

### 2. **Use Batch Method for >10 Addresses**
Saves gas fees and time.

### 3. **Keep a Backup List**
Save your whitelist CSV file safely - you'll need it for records.

### 4. **Test with Your Own Address First**
Before whitelisting investors, test with your own wallet:
```bash
npx hardhat run scripts/add-whitelist.js --network bsc 0xYourWalletAddress
```

### 5. **Monitor Gas Prices**
Check BSCScan gas tracker. If BNB gas is high, wait a bit.

### 6. **Keep Transaction Records**
Save transaction hashes for audit trail.

---

## 📊 Whitelist Workflow

### For Early Investors (Pre-Launch):

1. **Collect Addresses**
   - Email: "Please send your BSC wallet address to invest in private sale"
   - Verify format (starts with 0x, 42 characters long)

2. **Create CSV List**
   - Add all addresses to whitelist.csv
   - Review for duplicates

3. **Batch Whitelist**
   - Run: `node scripts/whitelist-from-csv.js whitelist.csv`
   - Verify success

4. **Notify Investors**
   - Email: "You're whitelisted! Private sale starts [date]"
   - Include instructions for buying

### For New Investors (During Private Sale):

1. **Receive Address**
   - Investor emails their address

2. **Quick Add**
   - Run: `npx hardhat run scripts/add-whitelist.js --network bsc 0xTheirAddress`

3. **Confirm**
   - Reply: "You're whitelisted! You can now invest at [WEBSITE_URL]"

---

## ⚠️ Common Issues & Solutions

### Issue: "Invalid address format"
**Solution:** Make sure address:
- Starts with `0x`
- Is exactly 42 characters long
- Contains only hex characters (0-9, a-f, A-F)

### Issue: "Already whitelisted"
**Solution:** No action needed - address is good to go!

### Issue: "Transaction failed - insufficient funds"
**Solution:** You need more BNB in your wallet for gas fees.

### Issue: "Execution reverted: Ownable: caller is not the owner"
**Solution:** Make sure `PRIVATE_KEY` in Replit Secrets is your deployer wallet.

---

## 💡 Quick Reference Commands

```bash
# Add addresses
cd keno-ico && npx hardhat run scripts/add-whitelist.js --network bsc 0xADDRESS1 0xADDRESS2

# Add from CSV
cd keno-ico && node scripts/whitelist-from-csv.js whitelist.csv

# Check status
cd keno-ico && npx hardhat run scripts/check-whitelist.js --network bsc 0xADDRESS

# Remove addresses
cd keno-ico && npx hardhat run scripts/remove-whitelist.js --network bsc 0xADDRESS
```

---

## 📞 Support

If you encounter issues:
1. Check gas balance (need ~$1-2 in BNB)
2. Verify private key is correct in Replit Secrets
3. Ensure BSC network is responsive (check BSCScan)
4. Review error messages carefully

---

## 🎉 Success!

Once whitelisted, investors can:
1. Visit your ICO website
2. Connect MetaMask
3. See "Private Sale" phase active
4. Purchase KENO tokens at discounted price

Good luck with your whitelist management! 🚀

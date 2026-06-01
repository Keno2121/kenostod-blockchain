# 👑 Queens Chariot Token (QCT) — Fjord Foundry Launch Kit

> Everything you need to paste into Fjord. Complete in ~20 minutes.
> Deploy QCT first, then use the contract address from `deployments/qct-base.json`.

---

## Step 0 — Before You Open Fjord

### Checklist
- [ ] QCT deployed on Base (`npm run deploy:mainnet` in this folder)
- [ ] Contract address in hand (from `deployments/qct-base.json`)
- [ ] MetaMask connected to **Base network** (Chain ID: 8453)
- [ ] ~0.02 ETH in your wallet on Base (for Fjord seed + gas)
- [ ] QCT partnerships allocation approved for Fjord contract

### Your deployer wallet
```
Address: 0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2
Network: Base (Chain ID 8453)
Role:    QCT deployer + holds all 6 allocation wallets initially
```

### Bridge ETH to Base (pick one)
| Bridge | URL | Notes |
|--------|-----|-------|
| **Stargate** | stargate.finance | BNB → ETH on Base directly |
| **Squid Router** | app.squidrouter.com | Cross-chain, simple UI |
| **Across** | across.to | Fast, low fees |
| **Base Bridge** | bridge.base.org | Only works from Ethereum mainnet |

> Send ETH to `0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2` on **Base network**.
> You need ~0.02 ETH total (deploy ~$0.50 + Fjord seed ~$30–70 worth of ETH).

---

## Step 1 — Go to Fjord Foundry

**URL:** https://fjordfoundry.com

1. Click **Launch a Token Sale**
2. Connect MetaMask → switch to **Base network**
3. Select **Liquidity Bootstrapping Pool (LBP)**

---

## Step 2 — Token Information

Paste these into the Fjord form:

| Field | Value |
|-------|-------|
| **Token contract address** | *(from `deployments/qct-base.json` → contractAddress)* |
| **Token name** | Queens Chariot Token |
| **Token symbol** | QCT |
| **Token decimals** | 18 |
| **Network** | Base |

---

## Step 3 — LBP Parameters

| Parameter | Value | Why |
|-----------|-------|-----|
| **Tokens for sale** | 78,400,000 QCT | 8% of post-burn supply — the partnerships allocation |
| **Collateral token** | ETH | Base native collateral |
| **ETH seed amount** | 0.01 ETH (minimum) | You can add more — more ETH = higher starting price |
| **Start weight (QCT)** | 95% | Price starts high — slows bots |
| **Start weight (ETH)** | 5% | |
| **End weight (QCT)** | 50% | Price finds its natural floor |
| **End weight (ETH)** | 50% | |
| **Sale duration** | 7 days | Standard LBP window |
| **Sale type** | Public | No whitelist needed — protocol token for all |

### What this means for price
With 0.01 ETH seed + 78.4M QCT at 95/5 start weights:
- **Starting price:** ~$0.0009/QCT (FDV ~$880K at $3,500 ETH)
- **Floor price:** naturally discovered by buyers over 7 days
- **If 0.05 ETH seed:** starting price ~$0.0045/QCT (FDV ~$4.4M)

> The more ETH you seed, the higher the starting price and credibility signal.
> More ETH seed also means you get more ETH back if buyers don't fill the pool.

---

## Step 4 — Project Description

**Copy and paste this into Fjord's description field:**

```
Queens Chariot Token (QCT) is the third token of the Sovereign Trinity — 
a self-sustaining protocol token built on Base that generates passive income 
through 6 autonomous fee mechanisms.

Every QCT transfer automatically:
• Charges a 2% Tithe & Triumph fee
• Routes 40% instantly to all holders (Prosperity Cascade Layer 1)
• Accumulates 30% for stakers over 24 hours
• Builds liquidity depth (20%) and protocol treasury (10%)

The protocol requires no human intervention. The Queen's Chariot Bot 
monitors the Base chain 24/7, triggers cascade releases when layers are 
ready, and reports income to the founder via Telegram.

6 Fee Protocols embedded at deployment:
1. Tithe & Triumph — 2% behavioral fee on every transfer
2. SSWFR — Sovereign Stake-Weighted Fee Rebate for long-term holders
3. Temporal Taxonomy — Squire→Knight→Baron→Duke→Sovereign tier discounts (φ-shaped)
4. Prosperity Cascade — 4-layer automatic redistribution (0h/24h/48h/72h)
5. Guardian's Gambit — On-chain flash loan + exploit detection
6. Alchemical AMM — Volatility-responsive DEX fee (0.2%–2%)

7 Constitutional Laws baked into the contract:
Kaprekar · Benford · Golden Ratio · Nash · Euler · Ramanujan · Inversion

The token is protocol infrastructure — not a community/meme token. 
Value flows automatically to holders and stakers. The contract runs itself.
```

---

## Step 5 — Social Links

| Field | Value |
|-------|-------|
| **Website** | *(your Kenostod app URL)* |
| **Twitter/X** | *(your handle)* |
| **Telegram** | *(your group)* |
| **Discord** | *(optional)* |
| **GitHub** | *(optional — link to contract source)* |
| **Whitepaper** | *(link to queens-chariot-masterplan.md hosted anywhere)* |

---

## Step 6 — Tokenomics (enter in Fjord's allocation table)

| Allocation | % | QCT Amount | Wallet | Vesting |
|-----------|---|-----------|--------|---------|
| Community Prosperity Pool | 40% | 392,000,000 | Deployer → move to Gnosis Safe | None — immediate redistribution |
| Permanent Liquidity Lock | 20% | 196,000,000 | Lock via Unicrypt on Base | Permanent lock |
| Development Treasury | 15% | 147,000,000 | Deployer → move to Gnosis Safe | 12-month linear |
| Founding Court | 10% | 98,000,000 | Deployer → move to cold wallet | 4-year linear |
| **Fjord LBP (this sale)** | **8%** | **78,400,000** | **Fjord contract** | **None — for sale** |
| Emergency Reserve | 5% | 49,000,000 | Deployer → move to cold wallet | None |
| Queen's Burn (genesis) | 2% | 20,000,000 | Burned forever at deployment | N/A |
| **Total** | **100%** | **980,000,000** | | |

---

## Step 7 — Final Review Before Submitting

Fjord will show you a price curve preview. Check:
- [ ] The curve starts high on Day 1 and slopes down to Day 7 ✓
- [ ] Token address matches what's in `deployments/qct-base.json`
- [ ] You've approved 78,400,000 QCT for the Fjord contract
- [ ] MetaMask is on **Base** network
- [ ] You have enough ETH for: seed amount + Fjord fee (~1% of raise) + gas

Submit → sign two transactions (approve QCT + create LBP pool).

---

## Step 8 — After the LBP Ends (Day 7)

1. **Claim raised ETH** from Fjord dashboard
2. **Add Aerodrome liquidity** — QCT/ETH pool on Aerodrome (Base's main DEX)
   - URL: https://aerodrome.finance
   - Add remaining partnerships QCT + half the raised ETH
3. **Call `setDexPair(aerodromePoolAddress)`** on the QCT contract
   - This activates the Alchemical AMM fee protocol for that pair
4. **Lock liquidity** on Unicrypt (https://unicrypt.network/base)
   - Lock the 20% Liquidity Fortress allocation
5. **Queen bot auto-connects** — checks `deployments/qct-base.json` every 30s
   - The moment it finds the contract, it starts receiving fee events
   - You'll get a Telegram message confirming connection

---

## Commands Reference

```bash
# From queens-chariot/ folder:

# Test on Base Sepolia first (free — uses testnet ETH from faucet)
npm run deploy:testnet

# Get testnet ETH: https://www.alchemy.com/faucets/base-sepolia

# Deploy for real on Base Mainnet (~$0.50 in ETH gas)
npm run deploy:mainnet

# Verify contract on Basescan (makes it readable + trusted)
npm run verify:mainnet <CONTRACT_ADDRESS>
```

---

## After Deployment — Queen Bot Activates Automatically

Once `deployments/qct-base.json` exists with the contract address:
- Queen bot connects to Base chain on next poll (within 30 seconds)
- Telegram message: "✅ QCT Protocol Engine Connected"
- Every transfer starts generating fee events in real time
- Cascade releases trigger automatically when layers are ready

**The protocol runs itself. You just watch the Telegram.**

---

*"The Chariot needs no driver. It knows the way."*

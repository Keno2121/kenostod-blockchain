# 🔥 KENO Token — Fjord Foundry Launch Kit

> The original plan: launch KENO on Fjord. Standard ERC20, no transfer fee — zero friction with Fjord's validation.
> KENO is the BSC mainnet token at the heart of the Kenostod Sovereign Economy.

---

## Token Details

| Field | Value |
|---|---|
| **Token name** | Kenostod |
| **Symbol** | KENO |
| **Contract (BSC)** | `0x48bb049afe50b050b458624dc6233acd51024ab4` |
| **Network** | BNB Smart Chain (Chain ID: 56) |
| **Decimals** | 18 |
| **Total Supply** | 1,000,000,000 KENO |
| **Explorer** | [BSCScan](https://bscscan.com/token/0x48bb049afe50b050b458624dc6233acd51024ab4) |
| **Standard** | ERC20 (no transfer fee — Fjord compatible ✅) |

---

## Wallet Setup

```
Address: 0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2
Network: BNB Smart Chain (Chain ID 56)
Role:    Bot wallet — holds 1,000,000,000 KENO
```

> This wallet has 1B KENO sent to it. MetaMask → switch to BSC network to see it.

---

## Before You Open Fjord

### Checklist
- [ ] MetaMask connected to **BNB Smart Chain** (Chain ID: 56)
- [ ] KENO visible in wallet (1,000,000,000 KENO at `0xC20b9...`)
- [ ] ~0.1 BNB in wallet for gas + seed collateral
- [ ] BNB price checked (collateral amount in BNB depends on current price)

### Get BNB if needed
| Bridge | URL |
|---|---|
| **Stargate** | stargate.finance — bridge from any chain |
| **Binance** | Withdraw BNB directly to the wallet address |
| **Squid Router** | app.squidrouter.com |

---

## Step 1 — Go to Fjord Foundry

**URL:** https://fjordfoundry.com

1. Click **Launch a Token Sale**
2. Connect MetaMask → switch to **BNB Smart Chain** network
3. Select **Liquidity Bootstrapping Pool (LBP)**

---

## Step 2 — Token Information

| Field | Value |
|---|---|
| **Token contract address** | `0x48bb049afe50b050b458624dc6233acd51024ab4` |
| **Token name** | Kenostod |
| **Token symbol** | KENO |
| **Token decimals** | 18 |
| **Network** | BNB Smart Chain |

---

## Step 3 — Sales Structure

### Recommended LBP Configuration

| Parameter | Value | Rationale |
|---|---|---|
| **Project token amount** | 78,400,000 KENO | 7.84% of supply — standard LBP float |
| **Collateral token** | WBNB | Native BSC collateral |
| **Collateral amount** | 0.1 WBNB | ~$60 seed — price discovery handles the rest |
| **Start weight** | 95% KENO / 5% WBNB | High KENO weight = low opening price |
| **End weight** | 50% KENO / 50% WBNB | Equal weight at close |
| **Duration** | 7 days | Standard LBP window |
| **Swap fee** | 2% | Revenue during the sale |
| **Buy only** | Yes | Prevents manipulation during price discovery |

### WBNB Address (BSC)
```
0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
```

---

## Step 4 — Wrap BNB → WBNB

Unlike Fjord on Base, BSC uses WBNB (Wrapped BNB) as collateral.

**In MetaMask (BSC):**
1. Go to Uniswap / PancakeSwap → Swap
2. Sell: BNB → Buy: WBNB
3. Use the canonical address: `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`
4. Button should say **"Wrap"** — ratio is exactly 1:1

**Amount needed:** 0.1 WBNB (~$60 at $600 BNB price)

---

## Step 5 — Schedule + Submit

1. **Step 1 (Terms):** Check the box ✅
2. **Step 2 (Approve KENO):** Tap → confirm in MetaMask ✅
3. **Step 3 (Approve WBNB):** Tap → confirm in MetaMask ✅
4. **Step 4 (Schedule):** Tap → confirm in MetaMask ✅

> KENO is a standard ERC20 with no fee-on-transfer mechanism.
> Fjord's simulation will succeed. No "Invalid asset value" issues.

---

## Step 6 — After LBP Closes

When the 7-day LBP ends:

| Action | Details |
|---|---|
| **Withdraw WBNB raised** | Fjord → My Sales → Withdraw |
| **Add permanent liquidity** | Pair KENO + BNB on PancakeSwap V3 |
| **Add to DEX list** | Submit to CoinGecko + CoinMarketCap with contract address |
| **Activate bot** | Fund arb bot with WBNB raised, start KENO arbitrage |

---

## Revenue Projection Post-LBP

Using the Bot Capital Ladder from `replit.md`:

| Capital After LBP | Nash trade size | Income/month |
|---|---|---|
| $500 (seed) | $150/trade | ~$30–60/month |
| $2,000 | $300/trade | ~$120–240/month |
| $10,000 | $500/trade | ~$600–1,200/month |
| **$40,000** | **$1,000/trade** | **~$3,000/month** ← Financial Freedom |

**Euler compounds the reinvested 60% continuously** — capital grows to $1,482 by month 6 from a $500 start.

---

## Key Differences vs. QCT on Fjord

| | QCT on Fjord (previous attempt) | KENO on Fjord (this kit) |
|---|---|---|
| Chain | Base | BSC |
| Collateral | WETH | WBNB |
| Transfer fee | 2% (caused "Invalid asset value") | ✅ None — standard ERC20 |
| Approval flow | QCT + WETH | KENO + WBNB |
| Expected friction | ❌ Blocked by Fjord validation | ✅ Should work cleanly |

---

*KENO contract: `0x48bb049afe50b050b458624dc6233acd51024ab4` | BSC Mainnet*
*Deployer/holder: `0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2`*

# QCT × Hyperliquid — HIP-1 Launch Guide

> HIP-1 is Hyperliquid's native Dutch auction token launch — same mechanism as a Fjord LBP but built directly into the chain. No "Invalid asset value" errors. No approvals needed from a third party.

---

## What HIP-1 Does

- **Dutch auction** over several days: price starts high, drops until demand meets it
- **Instant spot market** created after auction closes
- **HIP-2 (Hyperliquidity)** kicks in automatically — creates a perpetual market for QCT
- **On-chain order book** — no AMM slippage, transparent price discovery
- **Same address = HL address** — your EVM wallet works directly

---

## Phase 1 — Bridge USDC to Hyperliquid

You need USDC on HL to seed the auction. Two ways:

### Option A — Direct deposit
1. Go to `app.hyperliquid.xyz` → **Deposit**
2. Connect MetaMask (keno bot wallet)
3. Bridge USDC from Arbitrum or Base directly

### Option B — Via Arbitrum
1. Bridge ETH → Arbitrum via [bridge.arbitrum.io](https://bridge.arbitrum.io)
2. Swap ETH → USDC on Uniswap (Arbitrum)
3. Deposit USDC to HL from Arbitrum

**Recommended seed:** $500–$2,000 USDC (more = stronger price floor during auction)

---

## Phase 2 — Deploy QCT Natively on HL (HIP-1)

Hyperliquid tokens are deployed via **governance auction**, not a smart contract.

### Step 1 — Join HL Discord
- Go to `discord.gg/hyperliquid`
- Find `#token-launches` or `#listing-requests`
- Post: "Requesting HIP-1 auction for QCT (Queens Chariot Token)"

### Step 2 — HIP-1 Form
*(As of 2025, done via governance proposal or their dedicated form)*

| Field | Value |
|---|---|
| **Token Name** | Queens Chariot Token |
| **Ticker** | QCT |
| **Total Supply** | 980,000,000 |
| **Auction Tokens** | 78,400,000 QCT (8% partnerships allocation) |
| **Starting Price** | Set 10× expected fair value (price discovery will find the floor) |
| **Duration** | 7 days |
| **Collateral** | USDC |

### Step 3 — Fund the Auction
Once approved, deposit 78,400,000 QCT equivalent and the USDC collateral amount specified.

---

## Phase 3 — HIP-2 Activation (Automatic)

After HIP-1 closes:
1. HL automatically creates a **QCT spot market**
2. **HIP-2 Hyperliquidity** activates — automated MM with protocol-owned liquidity
3. Within hours, a **QCT perpetual market** goes live
4. Anyone can trade QCT/USDC spot and QCT-PERP with leverage

---

## Phase 4 — Set Up Builder Code (Passive Revenue)

1. Go to `app.hyperliquid.xyz/referral`
2. Create a **builder code** — your custom code for QCT trading
3. Set fee: **0.1%** (maximum allowed)
4. Add code to env: `HL_BUILDER_CODE=your_code`
5. Share with community → earn 0.1% of every trade made through your link

**Projected revenue:**
| Daily Volume | Builder Fee |
|---|---|
| $100,000 | $100/day |
| $1,000,000 | $1,000/day |
| $10,000,000 | $10,000/day |

---

## Phase 5 — Create QCT Prosperity Vault

1. Go to `app.hyperliquid.xyz` → **Vaults** → **Create Vault**
2. Name: `Queens Chariot Prosperity Vault`
3. Description: `4-layer Prosperity Cascade — Sovereign Economy yield distribution`
4. Initial deposit: $100+ USDC
5. Copy vault address → add to `.env` as `HL_VAULT_ADDRESS`
6. The `QCTHiveHL.js` bot will start directing arb profits through the vault

**Your cut as vault leader: 10% of all vault profits**

---

## Phase 6 — Launch the Hive Bot

```bash
# Add env vars first
echo "QCT_DEPLOYER_KEY=your_key" >> .env
echo "HL_VAULT_ADDRESS=your_vault_address" >> .env
echo "HL_BUILDER_CODE=your_builder_code" >> .env

# Start the Hive
node queens-chariot/hyperliquid/QCTHiveHL.js
```

---

## Revenue Stack Summary

| Stream | Mechanism | When Active |
|---|---|---|
| **HIP-1 auction proceeds** | USDC raised during Dutch auction | After launch |
| **HIP-2 liquidity fees** | % of all QCT spot trades via protocol MM | After HIP-2 |
| **Builder code** | 0.1% of every QCT trade | After Phase 4 |
| **Vault leader cut** | 10% of vault arb profits | After Phase 5 |
| **Arb bot profits** | Spread + funding arb on ETH/BTC/SOL/HYPE/QCT | Now (pre-QCT) |
| **QCT Base events** | Cascade + tithe events from QCT on Base | Live now |

---

## vs. Fjord LBP

| | Fjord LBP | Hyperliquid HIP-1 |
|---|---|---|
| Fee-on-transfer support | ❌ Blocks it | ✅ No issue |
| Chain | Base only | HL native chain |
| Gas per trade | ~$0.01–$0.10 | Zero |
| Perp market | ❌ Manual | ✅ Automatic (HIP-2) |
| Vault system | ❌ None | ✅ Native |
| Builder fees | ❌ None | ✅ 0.1% |
| Price discovery | ✅ LBP weights | ✅ Dutch auction |

---

*Note: QCT on Base (`0x137a5Fc22a76Ec42490F2421a81935d124baE714`) remains the canonical contract — HL holds a portion for the HIP-1 auction, Base is the home chain.*

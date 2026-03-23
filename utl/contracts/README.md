# UTL Smart Contracts

## Overview

The Universal Transaction Layer (UTL) smart contract suite implements the core fee collection, treasury management, staking, and distribution system for the Kenostod ecosystem.

## Contracts

### 1. UTLFeeCollector.sol
**Purpose:** Captures 0.1% fees from all transactions routed through UTL.

**Key Features:**
- Native ETH/BNB fee collection
- ERC-20 token fee collection for supported tokens
- Configurable fee rate (default 0.1%, max 1%)
- Min/max fee bounds
- Automatic 60/40 split: 60% to staker distribution, 40% to treasury
- Per-user tracking (transaction count, total fees paid)

**Deployment:** Deploy on each supported chain (Ethereum, BSC, Polygon, Arbitrum, etc.)

### 2. UTLTreasury.sol
**Purpose:** Multi-sig treasury with 48-hour timelock for operational fund management.

**Key Features:**
- 4-way fund allocation using 1000-point precision: Kenostod Operations (375/1000 = 37.5%), Scholarships (250/1000 = 25%), T.D.I.R. Foundation (250/1000 = 25%), Insurance Reserve (125/1000 = 12.5%)
- Combined with 60/40 fee split: yields exactly 15%/10%/10%/5% of total fees
- 48-hour timelock on all withdrawals
- Authorized collector system
- Native and ERC-20 token support
- Configurable allocation percentages

### 3. UTLStaking.sol
**Purpose:** KENO token staking for UTL fee revenue sharing.

**Key Features:**
- 5 participation tiers: Observer (0.1x) → Guardian (2.0x)
- Duration bonuses: +5% (1mo) → +50% (1yr)
- Pro-rata reward distribution based on effective stake
- Minimum stake: 100 KENO
- Real-time reward calculation

**Tier Thresholds:**
| Tier | KENO Required | Multiplier |
|------|--------------|------------|
| Observer | 0 | 0.1x |
| Participant | 1,000 | 1.0x |
| Advocate | 10,000 | 1.2x |
| Champion | 100,000 | 1.5x |
| Guardian | 1,000,000 | 2.0x |

### 4. UTLDistribution.sol
**Purpose:** Gas-efficient reward distribution using Merkle tree proofs.

**Key Features:**
- Epoch-based distribution (weekly/monthly batches)
- Merkle proof verification for gas-efficient claims
- Batch claiming across multiple epochs
- Optional auto-compounding (restakes rewards automatically)
- Expired epoch fund recovery

## Deployment Order

1. Deploy `UTLStaking` with KENO token address
2. Deploy `UTLDistribution` with staking contract address
3. Deploy `UTLTreasury` with operational wallet addresses
4. Deploy `UTLFeeCollector` with treasury and distribution addresses
5. Authorize fee collector in treasury contract
6. Add supported tokens to fee collector

## Security Considerations

- All contracts use OpenZeppelin's ReentrancyGuard
- Treasury has 48-hour timelock on all withdrawals
- Fee rate capped at 1% maximum
- Multi-sig recommended for treasury owner
- Full audit recommended before mainnet deployment

## Network Deployment Targets

- **BSC (Primary):** KENO token native chain
- **Ethereum:** Highest fee volume
- **Polygon:** Low-cost transactions
- **Arbitrum:** L2 scaling
- **Base:** Growing ecosystem

## KENO Token

Contract: `0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E` (BEP-20 on BSC)

## License

MIT — Kenostod Blockchain Academy

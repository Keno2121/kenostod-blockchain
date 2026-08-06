---
name: KENO Live Deployment
description: Key facts, gotchas, and decisions from the KENO PancakeSwap listing and node sale launch.
---

# KENO Live Deployment

## Contracts (BSC Mainnet)
- **KENO token**: `0x48bb049afe50b050b458624dc6233acd51024ab4`
- **KENO/BNB pair**: `0xD1264cb02970cd494D9455FC8d7C889b14E23503`
- **KenostodNode**: `0x45599c6be7321519Ad3eadc63D14B2CD8d994f5A`
- **KENO owner**: `0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2` (bot wallet, after emergency transfer)

## Critical gotchas

### 1. KENO flattened source ≠ deployed contract
- `KENO-flattened.sol` names the whitelist toggle `toggleWhitelist(bool)` → selector `0x80e3f1ad`
- **Actual deployed function is `toggleWhitelistEnabled(bool)`** → selector `0xd2f01218`
- Always simulate first via `provider.call()` before trusting the flattened source

### 2. addLiquidityETH gas — new pair needs ~3.5M gas
- Simulation (staticCall) always passes because it uses unlimited gas
- Real tx with 600k limit fails silently with status=0; gasUsed ≈ 585k
- **Always estimate gas first (`provider.estimateGas`) and add 30% buffer for new pair creation**

### 3. Former owner was compromised Resi-Fi wallet
- `0x4AA73FadfFd71E6549867a37455EA957A52Cf849` was the KENO deployer/owner
- This is the old Resi-Fi wallet (compromised); ownership transferred to bot wallet on 2026-08-06
- Script: `scripts/emergency-transfer-ownership.js`

### 4. Owner wallet was a contract (EOF bytecode)
- `0x4AA73F...` has 23 bytes of `0xEF01...` bytecode (pre-London EOF format)
- Cannot receive plain BNB — force-funded via `keno-bonding/contracts/ForceFund.sol` (selfdestruct)
- Same-tx selfdestruct still transfers ETH per EIP-6780 on BSC

### 5. BSC gas price
- `getFeeData()` returns 0.05 gwei on BSC; this causes complex txs to occasionally get dropped
- Always use explicit `gasPrice: ethers.parseUnits('3', 'gwei')` for production sends

## Listing parameters
- 3,000 KENO + 0.25 BNB → initial price $0.05/KENO
- Bot wallet holds LP tokens
- Whitelist permanently disabled after listing

---
name: PancakeSwap Infinity Permit2 requirement
description: CLPositionManager uses Permit2 for token transfers — not direct ERC-20 transferFrom. Missing Permit2 allowance produces AllowanceExpired(uint256) error (selector 0xd81b2f2e) with arg 0.
---

## Rule
Any script that calls `CLPositionManager.modifyLiquidities()` on PancakeSwap Infinity MUST set two layers of approval:

1. **ERC-20 → Permit2** (`token.approve(PERMIT2, MaxUint256)`)
2. **Permit2 → CLPositionManager** (`permit2.approve(token, CL_POS_MANAGER, uint160_max, expiry)`)

Direct `token.approve(CL_POS_MANAGER, MaxUint256)` is NOT sufficient — the position manager never calls `transferFrom` directly.

**Why:** PancakeSwap Infinity's CLPositionManager inherits from `Permit2Forwarder` and routes all ERC-20 pulls through the Permit2 contract. Missing allowance surfaces as `AllowanceExpired(uint256)` (Permit2 error, selector `0xd81b2f2e`) with the uint256 arg being the expiration timestamp (0 when no allowance exists at all).

**How to apply:**
- In any liquidity-add or swap script targeting the Infinity CLPositionManager
- Permit2 address on BSC mainnet: `0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768`
- CLPositionManager address: `0x55f4c8abA71A1e923edC303eb4fEfF14608cC226`
- `permit2.approve(token, spender, amount, expiration)` — amount is `uint160`, expiration is `uint48` Unix timestamp

## Live pool context
KENO v2 / WBNB Infinity CL pool initialized and funded in tx `0xdeca31087bfa85c841b0a3f680b88fb8ebafdf5d362d372ce67aafacd553d0be`. Pool record at `utl/deployments/infinity-pool-bsc.json`.

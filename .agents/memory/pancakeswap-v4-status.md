---
name: PancakeSwap V4 BSC Status
description: PancakeSwap V4 is NOT deployed on BSC mainnet — all candidate addresses checked August 2026
---

## Finding (verified August 17, 2026)

PancakeSwap V4 is **not live on BSC mainnet**. All candidate addresses checked:

- `0x28E2eA090877Be573591cba87A5feB42aC4ed9AF` — stored in UTLHook as `poolManager`, has **zero code** on BSC
- `0x46A15B0b27311cedF172AB29E4f4766fbE7F4364` — storage slots decode to `"Pancake V3 Positions NFT-V1"` / `"PCS-V3-POS"` — this is the **V3 NonfungiblePositionManager**, not V4
- Other Vault/CLPoolManager candidates also showed zero code

## UTLHook State

The deployed UTLHook (`0xAF810a663995DCe98c5D7EdF5C970446A33bAA74`) is structurally correct:
- Hook flag 0x0040 bit is set (validated on-chain)
- `afterSwap` logic and fee forwarding are correct
- BUT: points to a non-existent PoolManager → can never receive callbacks → 0 swaps intercepted

## Action Required When V4 Launches

1. Find the real PancakeSwap V4 CLPoolManager address (will need new CREATE2 salt mine if address constraints change)
2. Redeploy UTLHook with `_poolManager = <real V4 address>`
3. Update KENO constant from v1 (`0x6579...`) to v2 (`0x48bb049afe50b050b458624dc6233acd51024ab4`)
4. Create KENO v2/WBNB pool on V4 with hook in PoolKey
5. Call `registerPool()` from owner wallet

**Why:** V4 wasn't live when the hook was deployed (May 2026). This is expected — the hook was built ahead of infrastructure.

## Do NOT Investigate Again Without Checking This First

Before any V4 work, verify the PancakeSwap V4 CLPoolManager has code on BSC:
```js
provider.getCode('<candidate_address>').then(c => console.log(c.length > 4 ? 'LIVE' : 'empty'))
```

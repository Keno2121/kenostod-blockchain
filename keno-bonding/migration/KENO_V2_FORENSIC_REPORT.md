# KENO v2 Migration Forensic Report

Generated September 15, 2026. This report is read-only and does not authorize a token transfer.

## Result

- Snapshot block: **119,792,272**
- Block hash: `0xf092368ccae73593bdd384f36d19afed24249b4dcdf1377499b894d8db59b471`
- Snapshot time: **September 3, 2026 at 20:40:04 UTC**
- Eligible claims: **12**
- Eligible migration total: **120,179.036781891396883226 KENO**
- Merkle root: `0x8aeca4c261eaa64f5382b065162cb68662ea83543f4efc2380d65ecbdb4c7bfb`
- Approved reserve: **100,000,000 KENO**
- Reserve remaining after these claims: **99,879,820.963218108603116774 KENO**

## Compromise sequence

1. At block 119,792,247, transaction `0xee6b33d07625d3d6e7281aa4c0a442bbdd87c5d6cd69f33198e1f8b6a9c77f49` transferred essentially all KENO/BNB LP tokens from the compromised wallet to `0x42cc0bacf8286da37196e4391727d4f3ad478319`.
2. Block 119,792,272 is the final block before the compromised wallet's KENO token balance changed.
3. At block 119,792,273, transaction `0x110e1c832b999c675341fb8d45f9a8e9ac8135a3d916095470ec377069b7daad` directly transferred `847,359,400.000000000000000051` KENO from the compromised wallet to the same recipient.
4. At block 119,793,196, the attacker removed approximately `2,863.017917130882664474` KENO from the PancakeSwap pair.

## Contract classifications

### Fjord pool

`0x10f3eab23f1625aa03d48d78e853daef6325676b` received 78.4 million KENO from the project wallet through the Fjord factory. It retained all 78.4 million KENO and held zero WBNB through the snapshot and current checks. No KENO was distributed from the pool. It is excluded as undisbursed project inventory.

### PinkSale

`0x92d69213842ee84b47221cbba299e01853fccf2d` held 64,237,500 KENO. Direct proxy-state calls proved:

- One contributor
- Contribution: 0.16 BNB
- Purchased amount: 120,000 KENO
- Distribution incomplete

The PinkSale contract balance is excluded as contract custody. A separate 120,000 KENO claim is included for the verified purchaser address. The remaining 64,117,500 KENO is unsold project inventory.

### Staking v2

`0x5e4d6c40b9629c8a4c9bbbbdafe503e0c5d175a4` held 10 million KENO. Direct calls proved one staker, the compromised wallet, holding the entire 10 million position, with zero rewards distributed. It is excluded as a compromised project-controlled position.

### PancakeSwap pair

`0xd1264cb02970cd494d9455fc8d7c889b14e23503` held 2,863.566013650448242887 KENO at the snapshot. Historical LP-holder data proved the LP position had already been transferred to the theft recipient. The pair balance is excluded from individual claims and will be addressed through new v3 liquidity.

### Dead address

The dead-address balance of 58.312343761236547873 KENO is excluded.

## External holders

Ten ordinary external holder balances total 178.121642588315209189 KENO. All ten are included at 1:1. One later sent approximately 100 KENO to the compromised wallet, but the approved pre-token-drain snapshot preserves that holder's original claim.

## Post-compromise review

Transfer-event replay from the drain through September 15 identified two small EOA acquisitions without theft-path evidence. The PinkSale purchaser acquired an additional 0.373064171433736638 KENO, and `0x2b40f892a5b8aefdf9868317330ca0f956f70d2b` acquired 0.542075131647937399 KENO. Both are included. Other recipients were theft-path or routing contracts.

## Reproduction

The authoritative classifications and raw amounts are in `v2-forensic-snapshot.json`. Primary evidence is retained under `migration/evidence/`, including the exact holder exports, LP-holder export, block-tagged contract results, and critical transactions.

Run:

```bash
node scripts/verify-v2-forensic-evidence.js
node scripts/build-v2-migration-merkle.js
```

The script verifies the eligible total and generates `v2-migration-merkle.json` with an OpenZeppelin-compatible double-hashed leaf encoding and sorted pairs.

## Remaining controls

- Deploy and audit a claim contract against the generated root on BSC testnet.
- Publish the snapshot, classifications, and dispute process before opening claims.
- Keep claims open for the approved 12-month period.
- Never send migration tokens to the compromised wallet or the theft recipient.
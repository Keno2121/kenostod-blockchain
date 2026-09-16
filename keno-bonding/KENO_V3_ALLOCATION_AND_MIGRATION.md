# KENO v3 Allocation and Migration Policy

Approved September 14, 2026.

This document replaces conflicting v1 and v2 allocation proposals. It does not deploy KENO v3, distribute tokens, or declare the holder snapshot complete. The machine-readable source is `config/keno-v3-allocation.json`.

## Fixed allocation

| Allocation | KENO | Percentage |
|---|---:|---:|
| Eligible v2 migration reserve | 100,000,000 | 10% |
| Education and scholarships | 200,000,000 | 20% |
| UTL, FAL, and FALP infrastructure | 200,000,000 | 20% |
| DEX and protocol-owned liquidity | 150,000,000 | 15% |
| Ecosystem and partnerships | 120,000,000 | 12% |
| Treasury and contingency reserve | 100,000,000 | 10% |
| Team and development | 70,000,000 | 7% |
| Marketing and contributor obligations | 40,000,000 | 4% |
| Node and security rewards | 20,000,000 | 2% |
| **Total** | **1,000,000,000** | **100%** |

The forensic snapshot and post-drain review established 12 eligible claims totaling 120,179.036781891396883226 KENO. The claims fit within the 100 million KENO migration reserve. Full evidence is in `migration/KENO_V2_FORENSIC_REPORT.md`.

## Confirmed contributor obligations

The marketing and contributor bucket currently recognizes:

- 50,000 KENO for one unpaid month under the approved paid-marketing agreement.
- 50,000 KENO under a separate approved contributor compensation agreement.
- Academy course rewards are separate and come from the education allocation.

These obligations are recorded as pending KENO v3. No v2 payment should be substituted without a separately documented agreement.

## Academy obligation

- Each verified course completion earns 250 KENO.
- The 21-course maximum is 5,250 KENO per graduate.
- Rewards accumulate as courses are verified.
- The accumulated reward becomes transferable at verified graduation and is fully unlocked at that point.
- Existing database rewards remain pending v3 until graduation and distribution are authorized.

## Release and vesting rules

- Eligible v2 migration claims are fully unlocked.
- The 70 million KENO team and development allocation has no launch unlock and vests linearly over 12 months.
- Initial protocol-owned LP positions must remain locked for at least 12 months.
- Confirmed contributor compensation is fully unlocked after beneficiary and payment verification.
- The treasury wallet may release infrastructure, ecosystem and partnership, treasury and contingency, and node and security allocations at its discretion. These buckets have no fixed release schedule and do not require a fixed approval record.

The discretionary treasury rule does not override the compromised-wallet prohibition, beneficiary verification, migration exclusions, or the required LP lock.

## v2 migration policy

- Conversion ratio: 1 eligible KENO v2 to 1 KENO v3.
- Primary snapshot: BSC block 119,792,272, the last KENO token-balance block before the direct drain. LP theft began 25 blocks earlier, so this is not described as the start of the compromise.
- Legitimate post-compromise purchases and transfers receive separate documented review.
- Migration balances are fully unlocked.
- Claims remain open for 12 months.
- A public reconciliation is required before unused migration tokens return to treasury.
- Claims should use a published Merkle root and independently reproducible holder ledger.

### Exclusions

- Zero and dead addresses.
- The compromised wallet.
- Identified theft-path wallets.
- Uncirculated project reserves.
- Obsolete project contracts.
- Project-controlled liquidity tokens that will instead be handled through the approved liquidity migration.

An address must not be excluded merely because it received tokens after the compromise. The exclusion must be supported by chain evidence or proof that the balance is a project-controlled reserve.

## Required evidence before claims or distributions

Completed forensic work:

1. Identified the compromise transaction sequence.
2. Proved the last safe token-balance block.
3. Reconstructed and independently checked v2 balances.
4. Classified project, liquidity, dead, compromised, and external balances.
5. Reviewed post-compromise activity.
6. Generated the eligible ledger and Merkle root.
7. Confirmed claims fit within the migration reserve.

Before distribution:

1. Publish the eligible ledger, root, and dispute process.
2. Implement the approved 12-month team vesting and minimum 12-month LP lock.
3. Verify beneficiary wallets without publishing private identifying information.

## Superseded proposals

The following are not v3 commitments unless separately reapproved:

- The legacy 30% v2 presale allocation.
- The v1 seed, presale, and IEO sale schedule.
- The v2 150 million AutoBurn reserve. AutoBurn should acquire KENO from markets and truly burn it rather than receive a large token allocation intended for destruction.
- Any unimplemented KENO-per-node promise not present in the deployed node agreement.
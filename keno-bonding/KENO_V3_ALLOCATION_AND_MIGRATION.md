# KENO v3 Allocation and Migration Policy

Approved September 13, 2026.

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

The migration reserve is a provisional maximum bucket, not proof that 100 million v2 tokens are eligible. The final eligible amount must come from the audited snapshot. If legitimate eligible balances exceed the reserve, the allocation must be amended before deployment.

## Confirmed contributor obligations

The marketing and contributor bucket currently recognizes:

- 50,000 KENO for one unpaid month under the approved paid-marketing agreement.
- 50,000 KENO under a separate approved contributor compensation agreement.
- Academy course rewards are separate and come from the education allocation.

These obligations are recorded as pending KENO v3. No v2 payment should be substituted without a separately documented agreement.

## Academy obligation

- Each verified course completion earns 250 KENO.
- The 21-course maximum is 5,250 KENO per graduate.
- Existing database rewards remain pending v3 until distribution is authorized.

## v2 migration policy

- Conversion ratio: 1 eligible KENO v2 to 1 KENO v3.
- Primary snapshot: the last proven safe BSC block before the September 3, 2026 compromise.
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

1. Identify the exact compromise transaction sequence.
2. Prove the last safe pre-compromise block.
3. Reconstruct v2 balances at that block.
4. Classify project, liquidity, dead, compromised, theft-path, and externally held balances.
5. Review legitimate post-compromise activity.
6. Publish the proposed eligible ledger and total.
7. Independently reproduce the Merkle root.
8. Confirm the eligible total fits within the migration reserve.
9. Approve vesting and custody rules for all non-migration buckets.
10. Verify beneficiary wallets without publishing private identifying information.

## Superseded proposals

The following are not v3 commitments unless separately reapproved:

- The legacy 30% v2 presale allocation.
- The v1 seed, presale, and IEO sale schedule.
- The v2 150 million AutoBurn reserve. AutoBurn should acquire KENO from markets and truly burn it rather than receive a large token allocation intended for destruction.
- Any unimplemented KENO-per-node promise not present in the deployed node agreement.
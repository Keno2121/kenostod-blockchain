# KENO v3 Final Token Rules

Approved September 13, 2026.

## Token identity and supply

- Name: Kenostod
- Symbol: KENO
- Decimals: 18
- Initial and maximum supply: 1,000,000,000 KENO
- The complete supply is minted once during construction.
- No external mint function or future inflation is permitted.
- The contract is non-upgradeable.

## Holder protections

- No token-level transfer tax or transaction fee.
- No blacklist.
- No seizure or clawback.
- No forced transfers.
- The owner cannot burn another holder's tokens without that holder granting a standard ERC-20 allowance.
- Ownership cannot be renounced accidentally.
- Ownership transfers require acceptance by the proposed new owner.

## Emergency control

- The owner may pause and unpause token movement during a documented emergency.
- A pause blocks transfers, allowance-based transfers, direct burns, and allowance-based burns.
- Pausing does not let the owner move, seize, or destroy another holder's tokens.

## Burning

- Holders may permanently burn their own tokens.
- Approved spenders may burn only within an allowance granted by the token holder.
- A real burn reduces both the holder balance and the reported total supply.
- Legacy AutoBurn services that send KENO to `0x000000000000000000000000000000000000dEaD` remain technically compatible, but they must be replaced or upgraded separately to use true v3 burns.

## Initial governance and custody

- The one-time deployment wallet must be different from the owner and supply recipient.
- The compromised legacy wallet must never be used as deployer, owner, supply recipient, treasury, or operator.
- For the initial BSC mainnet launch, the approved protected wallet temporarily serves as both contract owner and supply recipient.
- Mainnet deployment tooling rejects any different initial owner or supply recipient.
- Contract ownership must later move through the two-step ownership process to a security Safe multisig.
- Treasury tokens must later move through normal ERC-20 transfers to a treasury Safe multisig.
- The security and treasury multisigs should be separate 2-of-3 Safes when the signer group is ready.

## Deployment status

These rules finalize the token design only. KENO v3 remains undeployed. Testnet validation, allocation approval, migration rules, infrastructure replacement, and an explicit mainnet authorization are still required.
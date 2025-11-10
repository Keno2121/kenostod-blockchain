# KENO ICO - BSC Mainnet Deployment

**Deployment Date:** November 10, 2025
**Network:** Binance Smart Chain (BSC) Mainnet
**Chain ID:** 56

## Contract Addresses

### KENO Token (ERC-20)
**Address:** `0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E`
**BSCScan:** https://bscscan.com/address/0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E

### Presale Contract
**Address:** `0xE26D6fcf7f3d560a8acEB43fa904Bef31b1fB6D0`
**BSCScan:** https://bscscan.com/address/0xE26D6fcf7f3d560a8acEB43fa904Bef31b1fB6D0

## Token Distribution

- **Total Supply:** 1,000,000,000 KENO
- **Team Allocation:** 200M KENO (20%)
- **Treasury:** 150M KENO (15%)
- **Liquidity Pool:** 150M KENO (15%)
- **ICO (Presale Contract):** 300M KENO (30%)
- **Marketing/Partnerships:** 150M KENO (15%)
- **Staking Rewards:** 50M KENO (5%)

## ICO Timeline

- **Private Sale Start:** November 11, 2025 at 11:27:24 PM UTC
- **Private Sale Duration:** 30 days
- **Public Sale Start:** December 12, 2025 at 12:27:24 AM UTC
- **Public Sale Duration:** 60 days

## Pricing

- **Private Sale Price:** 0.0000416 BNB per KENO (~$0.000024 USD)
- **Public Sale Price:** 0.0000520 BNB per KENO (~$0.000030 USD)
- **Minimum Purchase:** 0.1 BNB
- **Maximum Purchase (Private):** 10 BNB
- **Maximum Purchase (Public):** 5 BNB

## Deployment Costs

- **KENO Token Deployment:** ~$1.50
- **Presale Contract Deployment:** ~$2.00
- **Token Transfer & Setup:** ~$1.00
- **Total Deployment Cost:** ~$4.50 in BNB

## Deployer Wallet

**Address:** 0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf

## Next Steps

1. ✅ Deploy contracts (COMPLETE)
2. ⏳ Verify contracts on BSCScan
3. ⏳ Configure presale website with contract addresses
4. ⏳ Add liquidity to PancakeSwap
5. ⏳ Add private sale whitelist addresses
6. ⏳ Launch marketing campaign
7. ⏳ Begin accepting investments

## Contract Verification Commands

To verify on BSCScan:

```bash
cd keno-ico
npx hardhat verify --network bsc 0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E "0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf" "0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf" "0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf" "0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf"

npx hardhat verify --network bsc 0xE26D6fcf7f3d560a8acEB43fa904Bef31b1fB6D0 "0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E" "[PRIVATE_SALE_START_TIMESTAMP]" "[PRIVATE_SALE_DURATION]" "[PUBLIC_SALE_START_TIMESTAMP]" "[PUBLIC_SALE_DURATION]"
```

## Security Notes

- All contracts compiled with Solidity 0.8.20
- Optimizer enabled (200 runs)
- Based on OpenZeppelin battle-tested libraries
- Private key stored securely in Replit Secrets
- Deployer wallet controls all initial token allocations

## Support

For questions or issues, contact the Kenostod team.

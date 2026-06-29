# UTL Hook — PancakeSwap v4 Integration

## What this is

A PancakeSwap v4 hook contract that injects UTL Protocol into every swap on authorized pools. Every trade triggers `afterSwap()`, which collects a 0.09% fee and routes it to the UTL FeeCollector. Stakers earn 60% of all fees collected.

## Contract structure

```
contracts/
├── interfaces/
│   ├── IPancakeV4.sol          PancakeSwap v4 types + ICLHooks interface
│   └── IUTLFeeCollector.sol    UTL on-chain interface
└── utl/
    ├── UTLHook.sol             Main hook contract
    ├── HookMiner.sol           CREATE2 salt utility
    └── scripts/
        └── deployUTLHook.js    Deployment script
```

## How it works

```
User swaps on PancakeSwap v4
        ↓
Pool Manager calls UTLHook.afterSwap()
        ↓
UTLHook calculates 0.09% of output amount
        ↓
Fee transferred to UTL FeeCollector
        ↓
FeeCollector splits:
    60% → USDC Stakers (proportional to stake)
    25% → T.D.I.R. Foundation
    15% → UTL Treasury
```

## Deployment requirements

PancakeSwap v4 encodes hook permissions into the contract address. The address lower 14 bits must equal `64` (AFTER_SWAP_FLAG only). This requires mining a CREATE2 salt — the deploy script handles this automatically.

## Deployment steps

1. Wait for PancakeSwap v4 to launch on BSC mainnet
2. Get the official Pool Manager address from PancakeSwap
3. Update `PANCAKE_V4_POOL_MANAGER` in `deployUTLHook.js`
4. Compile: `npx hardhat compile`
5. Deploy: `node contracts/scripts/deployUTLHook.js`
6. Create KENO/USDC and KENO/WBNB pools using the hook address

## Key addresses (BSC Mainnet)

| Contract | Address |
|---|---|
| UTL FeeCollector | `0xfE537c43d202C455Cedc141B882c808287BB662f` |
| UTL Treasury | `0x3B3538b955647d811D42400084e9409e6593bE97` |
| KENO Token | `0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E` |
| USDC (BSC) | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` |
| WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |

## UTL fee parameters

| Parameter | Value |
|---|---|
| Fee rate | 0.09% (9 bps) per swap |
| Fee token | Output token of the swap |
| Staker split | 60% |
| Foundation split | 25% |
| Treasury split | 15% |

---
name: BSC deployment gotchas
description: Lessons learned deploying to BSC mainnet from Replit — gas, RPC, ethers.js quirks
---

## BSC Deployment Gotchas

### Gas price
- BSC actual gas price is ~0.05 gwei, NOT 3-5 gwei like Ethereum
- Never hardcode a 3+ gwei minimum — it will exceed your BNB balance
- Typical ERC-20 deploy costs ~0.00006 BNB at 0.1 gwei
- Safe pattern: `gasPrice = eth_gasPrice * 1.5x`, minimum 0.1 gwei

### Deployer wallet
- `DEPLOYER_PRIVATE_KEY` env var → wallet `0x074c142C42Cf8e67439976CD3C18138eC9Bea35E` (has BNB)
- `NEW_WALLET_PRIVATE_KEY` → Resi-Fi `0x4AA73...` (no BNB — cannot deploy from here)
- Always check which key maps to which address before assuming

### RPC reliability
- `rpc.ankr.com/bsc` requires API key auth — do NOT use without auth
- Reliable free endpoints: `bsc-dataseed.bnbchain.org`, `bsc-dataseed1.defibit.io`, `1rpc.io/bnb`
- Rotate through fallbacks automatically

### ethers.js waitForDeployment() hangs
- `factory.deploy()` followed by `waitForDeployment()` hangs indefinitely when RPC is slow
- **Fix:** Use manual sign + broadcast + receipt polling
  1. Sign tx with `wallet.signTransaction(tx)`
  2. Broadcast with `eth_sendRawTransaction`
  3. Poll `eth_getTransactionReceipt` every 4 seconds

### Gas estimation
- Run `eth_estimateGas` before deploying to know actual gas needed
- KenostodToken (optimized) used 1,134,145 gas
- Set gasLimit = estimated * 1.25 for safety

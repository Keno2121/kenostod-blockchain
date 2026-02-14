# UTL MetaMask Snap

## Overview

The UTL MetaMask Snap integrates the Universal Transaction Layer directly into MetaMask, enabling users to earn passive income from cross-chain transaction fees without leaving their wallet.

## Features

### Transaction Insights
Every transaction shows a UTL panel displaying:
- Transaction value and UTL fee (0.1%)
- Current tier and multiplier
- Cumulative fees contributed
- Total rewards earned
- Auto-compound status

### RPC Methods

| Method | Description |
|--------|-------------|
| `utl_optIn` | Activate UTL fee redistribution |
| `utl_optOut` | Deactivate UTL participation |
| `utl_dashboard` | View full earnings dashboard |
| `utl_getStats` | Get stats as JSON (for dapps) |
| `utl_updateStake` | Sync KENO stake amount |
| `utl_claimRewards` | Initiate reward claim |
| `utl_toggleAutoCompound` | Toggle auto-restaking |
| `utl_weeklyReport` | Get weekly earnings report |

### Tier System
Based on KENO staked:
- **Observer** (0 KENO): 0.1x multiplier
- **Participant** (1,000 KENO): 1.0x multiplier
- **Advocate** (10,000 KENO): 1.2x multiplier
- **Champion** (100,000 KENO): 1.5x multiplier
- **Guardian** (1,000,000 KENO): 2.0x multiplier

## Development

### Prerequisites
- Node.js 18+
- MetaMask Flask (developer version)

### Setup
```bash
cd utl/metamask-snap
npm install
npm run build
```

### Testing
1. Install MetaMask Flask
2. Run `npm start` for watch mode
3. Open companion dapp at localhost:8000
4. Connect and test snap functions

### Publishing
```bash
npm publish --access public
```
Then request allowlisting from MetaMask team.

## Integration with Companion Dapp

```javascript
// Connect to snap
const snapId = 'npm:@kenostod/utl-snap';

await ethereum.request({
  method: 'wallet_requestSnaps',
  params: { [snapId]: {} }
});

// Opt in
await ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId,
    request: { method: 'utl_optIn' }
  }
});

// Get stats
const stats = await ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId,
    request: { method: 'utl_getStats' }
  }
});
```

## Permissions Required
- `snap_dialog` — Show UI panels to user
- `snap_notify` — Push notifications for earnings
- `snap_manageState` — Store user preferences locally
- `endowment:transaction-insight` — Analyze transactions before signing
- `endowment:ethereum-provider` — Interact with blockchain
- `endowment:network-access` — Fetch external data
- `endowment:rpc` — Receive RPC calls from dapps

## License

MIT — Kenostod Blockchain Academy

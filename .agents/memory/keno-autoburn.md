---
name: KENOAutoBurn contract
description: Deployed KENOAutoBurn BSC contract details and key lesson about Replit secret injection timing
---

## Contract Details
- **Network:** BSC Mainnet
- **Address:** `0x9Fb4f8d4798d9E484c27c6F7571DCaFc82215A79`
- **BSCScan:** https://bscscan.com/address/0x9Fb4f8d4798d9E484c27c6F7571DCaFc82215A79
- **Owner:** `0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2` (bot wallet — safe)
- **KENO Token:** `0x48bb049afe50b050b458624dc6233acd51024ab4`
- **Deployed by:** `0x074c142C42Cf8e67439976CD3C18138eC9Bea35E` (DEPLOYER_PRIVATE_KEY)
- **Block:** 109502701
- **Tx:** `0x7a2bf9a738df4bef99a3e2388d5cdaefe5702ed25b8549de6be866c2bccb7577`
- **Deployed:** July 12, 2026
- **Record file:** `keno-bonding/deployments/bsc-autoburn.json`

## Key Lessons

**Replit secret injection timing:**
Adding a new secret in Replit and then restarting a workflow does NOT guarantee the secret is in the process env. The workflow's env is snapshotted at start time. If a secret is added while the workflow is running, a restart may or may not pick it up in the bash shell context. To deploy reliably: run the deploy script directly from the bash shell (`node scripts/deploy-autoburn-direct.js`) after confirming the secret is visible via `echo "length: ${#MY_SECRET}"`.

**Why:** The child_process spawned by server.js via `spawn('node', [script], { env: process.env })` inherits whatever `process.env` the server had at startup. If the secret wasn't set when the server started, the child won't see it even if it was added later.

**How to apply:** For any future BSC deploy: check `echo "${#DEPLOYER_PRIVATE_KEY}"` from bash first. If it's 66 (0x + 64 hex chars), use it directly. Don't rely on the server admin endpoint for one-off deploys.

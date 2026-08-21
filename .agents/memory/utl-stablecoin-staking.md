---
name: UTL stablecoin-first staking
description: Product decision for launching UTL staking on BOT Chain while KENO liquidity is shallow
---

For the initial BOT Chain rollout, use a separate USDC staking pool while KENO liquidity matures. Keep the KENO pool as a separate option later rather than forcing users to migrate positions. Rewards must be funded by realized UTL protocol fees and must not be presented as guaranteed yield.

**Why:** KENO's shallow liquidity can create significant slippage and price uncertainty for stakers who need to sell rewards or exit positions, while USDC reduces that specific exposure.

**How to apply:** Treat USDC staking as a new, separately reviewed contract and define the reward asset, pool allocation, withdrawal terms, and BOT Chain revenue split before accepting deposits. Do not assume the existing KENO-only staking contract can be switched to USDC.
---
name: BOT Chain Scan verification
description: Reliable source-verification approach for BOT Chain's Blockscout explorer.
---

Use BOT Chain Scan's Blockscout v2 verification API with the exact compiler settings used at deployment. If a standard JSON input upload is blocked by the explorer's Cloudflare edge, submit a clean Hardhat-flattened Solidity source using the `flattened-code` method instead.

**Why:** Large multipart standard-input uploads can be rejected by the explorer's edge firewall even though the underlying verifier is available. A flattened JSON payload avoids that edge restriction and has successfully published verified source.

**How to apply:** Generate flattened source with `DOTENV_CONFIG_QUIET=true`; otherwise the local Hardhat setup may print a dotenv status line into the source and cause an asynchronous compiler failure. Supply the deployment compiler version, optimizer configuration, EVM version, contract name, and constructor arguments, then confirm the explorer's source-code API reports a non-empty `SourceCode`.
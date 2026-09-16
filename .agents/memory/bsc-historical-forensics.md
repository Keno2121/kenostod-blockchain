---
name: BSC historical forensics
description: Reliable method and provider behavior for reconstructing historical BSC token balances.
---

Do not interpret a null historical receipt from one public BSC RPC as proof that a recorded transaction is invalid. Cross-check with an archive-capable provider and replay event logs.

**Why:** Standard public endpoints returned null or archive errors for a valid contract creation receipt that multiple archive endpoints later confirmed.

NodeReal supports archive `eth_call` and `eth_getLogs` through its authenticated BSC RPC. Its Historical Token Holder API is asynchronous: submit a block-specific job, poll no more than five times per minute, then download the result promptly because links expire.

**How to apply:** Verify critical snapshots two ways: obtain a block-specific holder file and independently replay Transfer events from deployment. Confirm holder count and total supply match before classifying balances.
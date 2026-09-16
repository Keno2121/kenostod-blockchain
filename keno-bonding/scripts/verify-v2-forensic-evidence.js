const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const key = process.env.NODEREAL_API_KEY;
if (!key) throw new Error("NODEREAL_API_KEY is required");

const rpcUrl = `https://bsc-mainnet.nodereal.io/v1/${key}`;
const migrationDir = path.join(__dirname, "..", "migration");
const snapshot = require(path.join(migrationDir, "v2-forensic-snapshot.json"));
const holders = require(path.join(
  migrationDir,
  "evidence",
  "holders-119792272.json"
));
const evidence = require(path.join(
  migrationDir,
  "evidence",
  "critical-chain-evidence.json"
));
const transferTopic =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
let requestId = 1;

async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: requestId++, method, params }),
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message);
  return payload.result;
}

const uint = (hex) => BigInt(hex || "0x0").toString();
const firstWord = (hex) => BigInt(`0x${hex.slice(2, 66)}`).toString();
const addressArg = (address) => address.slice(2).padStart(64, "0");
const uintArg = (value) => BigInt(value).toString(16).padStart(64, "0");
const call = (to, data, block = evidence.blockTag) =>
  rpc("eth_call", [{ to, data }, block]);

async function getLogs(address, fromBlock, throughBlock) {
  const logs = [];
  for (let from = fromBlock; from <= throughBlock; from += 50_000) {
    const to = Math.min(throughBlock, from + 49_999);
    logs.push(
      ...(await rpc("eth_getLogs", [
        {
          address,
          topics: [transferTopic],
          fromBlock: `0x${from.toString(16)}`,
          toBlock: `0x${to.toString(16)}`,
        },
      ]))
    );
  }
  return logs;
}

function canonicalLogHash(logs) {
  const canonical = logs.map((log) => ({
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    topics: log.topics,
    data: log.data,
  }));
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
}

(async () => {
  const block = await rpc("eth_getBlockByNumber", [evidence.blockTag, false]);
  if (block.hash !== snapshot.snapshot.blockHash) {
    throw new Error("Snapshot block hash mismatch");
  }

  let holderTotal = 0n;
  for (const holder of holders.holders) {
    const result = await call(
      snapshot.tokenAddress,
      `0x70a08231${addressArg(holder.account)}`
    );
    if (result.toLowerCase() !== holder.balance.toLowerCase()) {
      throw new Error(`Holder mismatch: ${holder.account}`);
    }
    holderTotal += BigInt(holder.balance);
  }
  if (holderTotal.toString() !== snapshot.totalSupplyRaw) {
    throw new Error("Holder export does not reconcile to total supply");
  }

  for (const expected of evidence.criticalTransactions) {
    const [transaction, receipt] = await Promise.all([
      rpc("eth_getTransactionByHash", [expected.hash]),
      rpc("eth_getTransactionReceipt", [expected.hash]),
    ]);
    if (
      transaction.from.toLowerCase() !== expected.from ||
      transaction.to.toLowerCase() !== expected.to ||
      transaction.input.toLowerCase() !== expected.input ||
      Number(receipt.status) !== expected.status
    ) {
      throw new Error(`Critical transaction mismatch: ${expected.hash}`);
    }
  }

  const pink = evidence.pinksaleCalls;
  const contributor = addressArg(pink.contributor);
  const contributorResult = await call(
    pink.contract,
    `${pink.getContributors_0_100.selector}${uintArg(0)}${uintArg(100)}`
  );
  const contributorWords = contributorResult.slice(2).match(/.{64}/g);
  const contributorCount = Number(BigInt(`0x${contributorWords[1]}`));
  const contributors = contributorWords
    .slice(2, 2 + contributorCount)
    .map((word) => `0x${word.slice(-40)}`.toLowerCase());
  if (
    contributorCount !== pink.getContributors_0_100.decodedCount ||
    JSON.stringify(contributors) !==
      JSON.stringify(pink.getContributors_0_100.decodedAddresses)
  ) {
    throw new Error("PinkSale contributor enumeration mismatch");
  }
  const contribution = uint(
    await call(pink.contract, `${pink.contributionOf.selector}${contributor}`)
  );
  const purchased = uint(
    await call(pink.contract, `${pink.purchasedOf.selector}${contributor}`)
  );
  if (
    contribution !== pink.contributionOf.resultRaw ||
    purchased !== pink.purchasedOf.resultRaw
  ) {
    throw new Error("PinkSale purchaser evidence mismatch");
  }
  for (const index of pink.distributionCompleted.indexesChecked) {
    if (
      uint(
        await call(
          pink.contract,
          `${pink.distributionCompleted.selector}${uintArg(index)}`
        )
      ) !== "0"
    ) {
      throw new Error(`PinkSale distribution ${index} was completed`);
    }
  }

  const staking = evidence.stakingCalls;
  if (
    uint(await call(staking.contract, staking.getStakerCount.selector)) !== "1" ||
    `0x${(await call(staking.contract, `${staking.staker_0.selector}${uintArg(0)}`))
      .slice(-40)}`.toLowerCase() !== staking.staker_0.result ||
    uint(await call(staking.contract, staking.totalStaked.selector)) !==
      staking.totalStaked.resultRaw ||
    firstWord(
      await call(
        staking.contract,
        `${staking.compromisedWalletStake.selector}${addressArg(
          snapshot.compromise.compromisedWallet
        )}`
      )
    ) !== staking.compromisedWalletStake.amountRaw ||
    uint(
      await call(staking.contract, staking.totalRewardsDistributed.selector)
    ) !== "0"
  ) {
    throw new Error("Staking exclusion evidence mismatch");
  }

  const balanceOf = (token, address) =>
    call(token, `0x70a08231${addressArg(address)}`);
  const fjord = evidence.fjordCalls;
  if (
    uint(await balanceOf(snapshot.tokenAddress, fjord.contract)) !==
      fjord.kenoBalanceAtSnapshotRaw ||
    uint(
      await balanceOf(
        "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
        fjord.contract
      )
    ) !== "0"
  ) {
    throw new Error("Fjord exclusion evidence mismatch");
  }

  const lp = require(path.join(
    migrationDir,
    "evidence",
    "lp-holders-119792272.json"
  ));
  let lpTotal = 0n;
  for (const holder of lp.holders) {
    const actual = await balanceOf(lp.tokenAddress, holder.account);
    if (actual.toLowerCase() !== holder.balance.toLowerCase()) {
      throw new Error(`LP holder mismatch: ${holder.account}`);
    }
    lpTotal += BigInt(holder.balance);
  }
  if (
    uint(await call(lp.tokenAddress, "0x18160ddd")) !== lpTotal.toString()
  ) {
    throw new Error("LP holder export does not reconcile to LP supply");
  }

  const scan = evidence.postCompromiseTransferScan;
  const postLogs = await getLogs(
    snapshot.tokenAddress,
    scan.fromBlock,
    scan.throughBlock
  );
  if (
    postLogs.length !== scan.eventCount ||
    canonicalLogHash(postLogs) !== scan.canonicalSha256
  ) {
    throw new Error("Post-compromise Transfer log fingerprint mismatch");
  }
  for (const acquisition of scan.reviewedExternalAcquisitions) {
    if ((await rpc("eth_getCode", [acquisition.address, "latest"])) !== "0x") {
      throw new Error(`Reviewed acquisition is not an EOA: ${acquisition.address}`);
    }
    const found = postLogs.some(
      (log) =>
        `0x${log.topics[2].slice(-40)}`.toLowerCase() === acquisition.address &&
        uint(log.data) === acquisition.amountRaw
    );
    if (!found) throw new Error(`Reviewed acquisition missing: ${acquisition.address}`);
  }
  for (const address of scan.routingContracts) {
    if ((await rpc("eth_getCode", [address, "latest"])) === "0x") {
      throw new Error(`Expected routing contract is an EOA: ${address}`);
    }
  }

  console.log(
    JSON.stringify({
      verified: true,
      snapshotBlock: snapshot.snapshot.blockNumber,
      holders: holders.holders.length,
      postCompromiseEvents: postLogs.length,
      eligibleClaims: snapshot.eligibleClaims.length,
      eligibleMigrationRaw: snapshot.totals.eligibleMigrationRaw,
      merkleRoot: snapshot.merkle.root,
    })
  );
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
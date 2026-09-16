const fs = require("fs");
const path = require("path");
const { AbiCoder, concat, getAddress, keccak256 } = require("ethers");

const sourcePath = path.join(
  __dirname,
  "..",
  "migration",
  "v2-forensic-snapshot.json"
);
const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, "..", "migration", "v2-migration-merkle.json");

function hashLeaf(address, amountRaw) {
  const encoded = AbiCoder.defaultAbiCoder().encode(
    ["address", "uint256"],
    [getAddress(address), BigInt(amountRaw)]
  );
  return keccak256(keccak256(encoded));
}

function hashPair(left, right) {
  const [first, second] =
    BigInt(left) <= BigInt(right) ? [left, right] : [right, left];
  return keccak256(concat([first, second]));
}

function buildTree(claims) {
  const leaves = claims
    .map((claim) => ({
      ...claim,
      address: getAddress(claim.address),
      leaf: hashLeaf(claim.address, claim.amountRaw),
    }))
    .sort((a, b) => (BigInt(a.leaf) < BigInt(b.leaf) ? -1 : 1));

  const layers = [leaves.map((claim) => claim.leaf)];
  while (layers[layers.length - 1].length > 1) {
    const previous = layers[layers.length - 1];
    const next = [];
    for (let index = 0; index < previous.length; index += 2) {
      next.push(
        index + 1 < previous.length
          ? hashPair(previous[index], previous[index + 1])
          : previous[index]
      );
    }
    layers.push(next);
  }

  const claimsWithProofs = leaves.map((claim, leafIndex) => {
    const proof = [];
    let index = leafIndex;
    for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex++) {
      const layer = layers[layerIndex];
      const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
      if (siblingIndex < layer.length) proof.push(layer[siblingIndex]);
      index = Math.floor(index / 2);
    }
    return { ...claim, proof };
  });

  return {
    root: layers[layers.length - 1][0],
    claims: claimsWithProofs,
  };
}

function verifyProof(leaf, proof, root) {
  return proof.reduce(hashPair, leaf) === root;
}

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const totalRaw = source.eligibleClaims.reduce(
  (total, claim) => total + BigInt(claim.amountRaw),
  0n
);
if (totalRaw.toString() !== source.totals.eligibleMigrationRaw) {
  throw new Error("Eligible claim total does not match the forensic ledger");
}

const tree = buildTree(source.eligibleClaims);
if (source.merkle?.root && tree.root !== source.merkle.root) {
  throw new Error(
    `Merkle root changed: expected ${source.merkle.root}, got ${tree.root}`
  );
}
for (const claim of tree.claims) {
  if (!verifyProof(claim.leaf, claim.proof, tree.root)) {
    throw new Error(`Invalid generated proof for ${claim.address}`);
  }
}
const output = {
  schemaVersion: 1,
  tokenAddress: source.tokenAddress,
  snapshotBlock: source.snapshot.blockNumber,
  leafEncoding: "keccak256(keccak256(abi.encode(address,uint256)))",
  pairOrdering: "sorted",
  claimCount: tree.claims.length,
  totalRaw: totalRaw.toString(),
  merkleRoot: tree.root,
  claims: tree.claims,
};

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  JSON.stringify({
    outputPath,
    claimCount: output.claimCount,
    totalRaw: output.totalRaw,
    merkleRoot: output.merkleRoot,
  })
);
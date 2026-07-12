/**
 * KENOAutoBurn — Direct ethers.js deploy (no hardhat env needed)
 * Called from server.js child_process so KENO_WALLET_PRIVATE_KEY is inherited.
 */
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const ARTIFACT = path.join(__dirname, "../artifacts/contracts/KENOAutoBurn.sol/KENOAutoBurn.json");
const KENO_TOKEN = "0x48bb049afe50b050b458624dc6233acd51024ab4";
const OWNER      = "0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2";

const RPCS = [
  "https://bsc.drpc.org",
  "https://bsc-mainnet.public.blastapi.io",
  "https://bsc-rpc.publicnode.com",
];

async function getProvider() {
  for (const url of RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await Promise.race([p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error("timeout")),6000))]);
      console.log(`RPC OK: ${url}`);
      return p;
    } catch(e) {
      console.log(`RPC fail: ${url} — ${e.message}`);
    }
  }
  throw new Error("All RPCs failed");
}

async function main() {
  const key = process.env.BOT_WALLET_PRIVATE_KEY
           || process.env.WALLET_PRIVATE_KEY
           || process.env.NEW_WALLET_PRIVATE_KEY;
  if (!key) throw new Error("No bot wallet key found. Set BOT_WALLET_PRIVATE_KEY secret.");
  console.log("Key source:", process.env.BOT_WALLET_PRIVATE_KEY ? "BOT_WALLET_PRIVATE_KEY"
    : process.env.WALLET_PRIVATE_KEY ? "WALLET_PRIVATE_KEY" : "NEW_WALLET_PRIVATE_KEY");
  console.log("Key length:", key.length, "| starts with 0x:", key.startsWith("0x"));

  const provider = await getProvider();
  const wallet   = new ethers.Wallet(key, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} BNB`);

  if (balance === 0n) throw new Error("Zero balance — check RPC or wallet funding");

  const artifact = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
  const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log("Deploying KENOAutoBurn...");
  const gasPrice = (await provider.getFeeData()).gasPrice;
  const contract = await factory.deploy(KENO_TOKEN, OWNER, {
    gasLimit: 2_000_000,
    gasPrice: gasPrice || ethers.parseUnits("3", "gwei"),
  });

  console.log(`Tx hash: ${contract.deploymentTransaction().hash}`);
  console.log("Waiting for confirmation...");

  // Manual poll — waitForDeployment can hang on BSC
  const txHash = contract.deploymentTransaction().hash;
  let receipt = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) break;
    if (i % 4 === 0) console.log(`  ...waiting (${i*5}s)`);
  }

  if (!receipt) throw new Error("Deploy timed out — check tx hash on BSCScan");

  const address = receipt.contractAddress;
  console.log(`\n✅ KENOAutoBurn deployed: ${address}`);
  console.log(`   KENO Token: ${KENO_TOKEN}`);
  console.log(`   Owner:      ${OWNER}`);
  console.log(`   Block:      ${receipt.blockNumber}`);
  console.log(`   Gas used:   ${receipt.gasUsed}`);

  const record = {
    network: "bsc",
    address,
    deployer: wallet.address,
    kenoToken: KENO_TOKEN,
    owner: OWNER,
    txHash,
    blockNumber: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
  };

  const dir = path.join(__dirname, "../deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "bsc-autoburn.json"), JSON.stringify(record, null, 2));
  console.log(`\nSaved: keno-bonding/deployments/bsc-autoburn.json`);
  console.log(`DEPLOYED_ADDRESS=${address}`);
}

main().catch(err => { console.error("DEPLOY_ERROR:", err.message); process.exit(1); });

/**
 * KENO v2 — BSC Mainnet Deployment
 * Manual sign + broadcast + poll approach (avoids ethers waitForDeployment hangs)
 */

const { ethers } = require("ethers");
const solc = require("solc");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const OWNER_WALLET = "0x4AA73FadfFd71E6549867a37455EA957A52Cf849";
const BOT_WALLET   = "0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2";

const RPCS = [
  "https://rpc.ankr.com/bsc",
  "https://bsc-dataseed.bnbchain.org",
  "https://bsc-dataseed1.defibit.io",
  "https://1rpc.io/bnb",
];

// Lightweight JSON-RPC call with timeout
async function rpcCall(rpc, method, params = [], timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const json = await res.json();
    if (json.error) throw new Error(`RPC error: ${json.error.message}`);
    return json.result;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// Try RPCs until one works
async function tryRpc(method, params = []) {
  for (const rpc of RPCS) {
    try {
      return await rpcCall(rpc, method, params);
    } catch (e) {
      console.log(`    ${rpc.split("/")[2]} failed: ${e.message.slice(0, 60)}`);
    }
  }
  throw new Error(`All RPCs failed for ${method}`);
}

// Poll for tx receipt
async function pollReceipt(txHash, tries = 40, intervalMs = 4000) {
  for (let i = 0; i < tries; i++) {
    process.stdout.write(`\r  Mining... (${i + 1}/${tries}) `);
    const receipt = await tryRpc("eth_getTransactionReceipt", [txHash]);
    if (receipt) {
      process.stdout.write("\n");
      return receipt;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  process.stdout.write("\n");
  return null;
}

async function main() {
  const privKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (!privKey) throw new Error("DEPLOYER_PRIVATE_KEY not set");
  const wallet = new ethers.Wallet(privKey.startsWith("0x") ? privKey : "0x" + privKey);

  console.log("\n══════════════════════════════════════════════════");
  console.log("  KENO v2 — BSC Mainnet Deployment");
  console.log("══════════════════════════════════════════════════");
  console.log(`  Deployer:   ${wallet.address}`);
  console.log(`  Owner:      ${OWNER_WALLET} (Resi-Fi)`);
  console.log(`  Bot wallet: ${BOT_WALLET} (receives 1B KENO)`);

  // Get deployer balance
  const balHex = await tryRpc("eth_getBalance", [wallet.address, "latest"]);
  const balance = BigInt(balHex);
  console.log(`  Balance:    ${ethers.formatEther(balance)} BNB`);
  if (balance < ethers.parseEther("0.002")) throw new Error("Insufficient BNB");

  // Compile
  console.log("\n  Compiling KenostodToken.sol...");
  const source = fs.readFileSync(path.join(__dirname, "KenostodToken.sol"), "utf8");
  const input = {
    language: "Solidity",
    sources: { "KenostodToken.sol": { content: source } },
    settings: {
      outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
      optimizer: { enabled: true, runs: 200 },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors?.some(e => e.severity === "error")) {
    throw new Error("Compile errors: " + output.errors.map(e => e.message).join("; "));
  }
  const contract = output.contracts["KenostodToken.sol"]["KenostodToken"];
  const abi      = contract.abi;
  const bytecode = "0x" + contract.evm.bytecode.object;
  console.log(`  ✅ Compiled. Bytecode: ${(bytecode.length / 2).toLocaleString()} bytes`);

  // Build deploy data (constructor args encoded)
  const iface    = new ethers.Interface(abi);
  const initData = iface.encodeDeploy([OWNER_WALLET, BOT_WALLET, BOT_WALLET, BOT_WALLET]);
  const deployData = bytecode + initData.slice(2); // strip 0x from args

  // Get nonce + gas price
  const nonceHex    = await tryRpc("eth_getTransactionCount", [wallet.address, "latest"]);
  const nonce       = parseInt(nonceHex, 16);
  const gasPriceHex = await tryRpc("eth_gasPrice");
  const gasPrice    = BigInt(gasPriceHex) * 150n / 100n; // 50% premium for fast inclusion
  const minGas      = ethers.parseUnits("0.1", "gwei");  // BSC minimum (~0.05 gwei baseline)
  const finalGas    = gasPrice > minGas ? gasPrice : minGas;

  console.log(`\n  Nonce:      ${nonce}`);
  console.log(`  Gas price:  ${ethers.formatUnits(finalGas, "gwei")} gwei`);
  console.log(`  Gas limit:  1,500,000`);
  console.log(`  Max cost:   ${ethers.formatEther(finalGas * 1_500_000n)} BNB`);

  // Sign transaction
  const tx = {
    chainId: 56n,
    nonce,
    gasLimit: 1_500_000n,
    gasPrice: finalGas,
    to: null,        // contract creation
    value: 0n,
    data: deployData,
  };
  const signedTx = await wallet.signTransaction(tx);

  // Broadcast
  console.log("\n  Broadcasting transaction...");
  const txHash = await tryRpc("eth_sendRawTransaction", [signedTx]);
  console.log(`  ✅ Tx hash: ${txHash}`);
  console.log(`  BSCScan:   https://bscscan.com/tx/${txHash}`);

  // Poll for receipt
  console.log("\n  Waiting for confirmation...");
  const receipt = await pollReceipt(txHash);

  if (!receipt) {
    console.log(`\n  ⏳ Still pending — check: https://bscscan.com/tx/${txHash}`);
    console.log("  Save this hash and re-check in a few minutes.");
    // Save partial record
    fs.mkdirSync(path.join(__dirname, "deployments"), { recursive: true });
    fs.writeFileSync(
      path.join(__dirname, "deployments/keno-v2-pending.json"),
      JSON.stringify({ txHash, deployer: wallet.address, owner: OWNER_WALLET, botWallet: BOT_WALLET }, null, 2)
    );
    return;
  }

  const contractAddress = receipt.contractAddress;
  const gasUsed = parseInt(receipt.gasUsed, 16);
  const status  = receipt.status === "0x1" ? "Success" : "FAILED";

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  ✅ KENO v2 DEPLOYED — ${status}`);
  console.log(`  Contract: ${contractAddress}`);
  console.log(`  Gas used: ${gasUsed.toLocaleString()}`);
  console.log(`  Owner:    ${OWNER_WALLET}`);
  console.log(`  Tokens:   1,000,000,000 KENO → ${BOT_WALLET}`);
  console.log(`  Explorer: https://bscscan.com/token/${contractAddress}`);
  console.log(`══════════════════════════════════════════════════\n`);

  const record = {
    name: "Kenostod", symbol: "KENO", version: 2,
    network: "BSC Mainnet", chainId: 56,
    contractAddress, owner: OWNER_WALLET, botWallet: BOT_WALLET,
    totalSupply: "1000000000", decimals: 18,
    deployTxHash: txHash, gasUsed,
    deployedAt: new Date().toISOString(),
    abi,
  };
  fs.mkdirSync(path.join(__dirname, "deployments"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "deployments/keno-v2-bsc.json"), JSON.stringify(record, null, 2));
  console.log("  📄 Saved to keno-v2/deployments/keno-v2-bsc.json");
}

main().catch(err => {
  console.error("\n❌ Deployment failed:", err.message);
  process.exit(1);
});

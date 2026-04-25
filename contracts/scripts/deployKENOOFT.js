/**
 * deployKENOOFT.js
 *
 * Deploys KENO OFT contracts:
 *
 *   STEP 1 (BSC mainnet):
 *     Deploy KENOOFTAdapter — wraps the existing KENO BEP-20 on the home chain.
 *     This locks/unlocks KENO when bridging in/out.
 *
 *   STEP 2 (destination chain — Arbitrum, Base, Ethereum, etc.):
 *     Deploy KENOOOFT — mints/burns KENO on the destination chain.
 *     Deploy with: DEST_CHAIN=arbitrum node deployKENOOFT.js --dest
 *
 *   STEP 3 (after both are deployed):
 *     Connect the two contracts by calling setPeer() on each.
 *     Run with: node deployKENOOFT.js --connect
 *
 * Usage:
 *   Deploy adapter on BSC:        node contracts/scripts/deployKENOOFT.js
 *   Deploy OFT on Arbitrum:       DEST_RPC=<rpc_url> DEST_EID=30110 node contracts/scripts/deployKENOOFT.js --dest
 *   Connect after both deployed:  node contracts/scripts/deployKENOOFT.js --connect
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const solc = require('solc');

// ── Chain Configuration ────────────────────────────────────────────────────────

const CHAINS = {
  bsc: {
    name:    'BSC Mainnet',
    rpc:     'https://bsc-dataseed1.binance.org',
    eid:     30102,
    chainId: 56,
  },
  ethereum: {
    name:    'Ethereum Mainnet',
    rpc:     'https://eth.llamarpc.com',
    eid:     30101,
    chainId: 1,
  },
  arbitrum: {
    name:    'Arbitrum One',
    rpc:     'https://arb1.arbitrum.io/rpc',
    eid:     30110,
    chainId: 42161,
  },
  base: {
    name:    'Base',
    rpc:     'https://mainnet.base.org',
    eid:     30184,
    chainId: 8453,
  },
  polygon: {
    name:    'Polygon',
    rpc:     'https://polygon-rpc.com',
    eid:     30109,
    chainId: 137,
  },
  optimism: {
    name:    'Optimism',
    rpc:     'https://mainnet.optimism.io',
    eid:     30111,
    chainId: 10,
  },
};

// ── Compilation ────────────────────────────────────────────────────────────────

function compile(contractName, fileName) {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'utl', fileName), 'utf8'
  );
  const input = {
    language: 'Solidity',
    sources: { [fileName]: { content: src } },
    settings: {
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
      optimizer: { enabled: true, runs: 200 },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));

  const errors = (out.errors || []).filter(e => e.severity === 'error');
  if (errors.length) {
    console.error('Compilation errors:');
    errors.forEach(e => console.error(e.formattedMessage));
    process.exit(1);
  }

  const warnings = (out.errors || []).filter(e => e.severity === 'warning');
  if (warnings.length) {
    console.warn(`${warnings.length} warning(s) — proceeding`);
  }

  const contract = out.contracts[fileName][contractName];
  return { abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object };
}

// ── Deploy ─────────────────────────────────────────────────────────────────────

async function deployAdapter() {
  console.log('\n=== STEP 1: Deploy KENOOFTAdapter on BSC Mainnet ===\n');

  const privKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privKey) throw new Error('DEPLOYER_PRIVATE_KEY not set');

  const provider = new ethers.JsonRpcProvider(CHAINS.bsc.rpc);
  const wallet   = new ethers.Wallet(privKey, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} BNB`);

  if (balance < ethers.parseEther('0.001')) {
    throw new Error('Insufficient BNB — need at least 0.001 BNB for deployment');
  }

  console.log('\nCompiling KENOOFTAdapter.sol...');
  const { abi, bytecode } = compile('KENOOFTAdapter', 'KENOOFTAdapter.sol');
  console.log('Compilation successful.');

  const factory  = new ethers.ContractFactory(abi, bytecode, wallet);
  const gasPrice = (await provider.getFeeData()).gasPrice;

  console.log('\nDeploying KENOOFTAdapter...');
  const contract = await factory.deploy({ gasPrice });
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\n✅ KENOOFTAdapter deployed: ${address}`);
  console.log(`   https://bscscan.com/address/${address}`);

  // Save address
  const addrFile = path.join(__dirname, '..', 'deployed-addresses.json');
  const addrs    = JSON.parse(fs.readFileSync(addrFile, 'utf8'));
  addrs.deployed.KENOOFTAdapter = address;
  addrs.deployed.KENOOFTAdapter_EID = CHAINS.bsc.eid;
  fs.writeFileSync(addrFile, JSON.stringify(addrs, null, 2));

  console.log('\nNext steps:');
  console.log('1. Deploy KENO OFT on your destination chain(s):');
  console.log('   DEST_RPC=<rpc> DEST_EID=<eid> node contracts/scripts/deployKENOOFT.js --dest');
  console.log('2. Then connect them:');
  console.log('   node contracts/scripts/deployKENOOFT.js --connect');

  return address;
}

async function deployOFT() {
  const destRpc = process.env.DEST_RPC;
  const destEid = parseInt(process.env.DEST_EID || '0');

  if (!destRpc || !destEid) {
    throw new Error('Set DEST_RPC and DEST_EID env vars for destination chain deployment');
  }

  const chainName = Object.entries(CHAINS).find(([,c]) => c.eid === destEid)?.[0] || 'unknown';
  console.log(`\n=== STEP 2: Deploy KENOOOFT on ${chainName} (EID ${destEid}) ===\n`);

  const privKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privKey) throw new Error('DEPLOYER_PRIVATE_KEY not set');

  const provider = new ethers.JsonRpcProvider(destRpc);
  const wallet   = new ethers.Wallet(privKey, provider);
  const network  = await provider.getNetwork();

  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer:  ${wallet.address}`);
  console.log(`Network:   ${network.name} (chainId ${network.chainId})`);
  console.log(`Balance:   ${ethers.formatEther(balance)} native`);

  console.log('\nCompiling KENOOOFT.sol...');
  const { abi, bytecode } = compile('KENOOOFT', 'KENOOOFT.sol');
  console.log('Compilation successful.');

  const factory  = new ethers.ContractFactory(abi, bytecode, wallet);
  const gasPrice = (await provider.getFeeData()).gasPrice;

  console.log('\nDeploying KENOOOFT...');
  const contract = await factory.deploy({ gasPrice });
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\n✅ KENOOOFT deployed: ${address}`);

  const addrFile = path.join(__dirname, '..', 'deployed-addresses.json');
  const addrs    = JSON.parse(fs.readFileSync(addrFile, 'utf8'));
  if (!addrs.deployed.KENOOOFT_destinations) addrs.deployed.KENOOOFT_destinations = {};
  addrs.deployed.KENOOOFT_destinations[destEid] = { address, chain: chainName };
  fs.writeFileSync(addrFile, JSON.stringify(addrs, null, 2));

  console.log(`\nSaved to deployed-addresses.json`);
  console.log('\nNext: run --connect to link the adapter and this OFT contract');

  return address;
}

async function connectPeers() {
  console.log('\n=== STEP 3: Connect OFTAdapter ↔ KENOOOFT peers ===\n');

  const addrFile = path.join(__dirname, '..', 'deployed-addresses.json');
  const addrs    = JSON.parse(fs.readFileSync(addrFile, 'utf8'));

  const adapterAddress = addrs.deployed.KENOOFTAdapter;
  const destinations   = addrs.deployed.KENOOOFT_destinations || {};

  if (!adapterAddress) throw new Error('KENOOFTAdapter not deployed yet — run without flags first');
  if (Object.keys(destinations).length === 0) throw new Error('No destination OFTs deployed yet — run --dest first');

  const privKey = process.env.DEPLOYER_PRIVATE_KEY;
  const provider = new ethers.JsonRpcProvider(CHAINS.bsc.rpc);
  const wallet   = new ethers.Wallet(privKey, provider);

  const { abi: adapterAbi } = compile('KENOOFTAdapter', 'KENOOFTAdapter.sol');
  const adapter = new ethers.Contract(adapterAddress, adapterAbi, wallet);

  for (const [eidStr, dest] of Object.entries(destinations)) {
    const dstEid   = parseInt(eidStr);
    const destAddr = dest.address;

    console.log(`\nConnecting: BSC adapter → ${dest.chain} OFT (EID ${dstEid})`);
    console.log(`  Adapter:  ${adapterAddress}`);
    console.log(`  Dest OFT: ${destAddr}`);

    // Set peer on BSC adapter pointing to destination OFT
    const tx = await adapter.setPeerAddress(dstEid, destAddr);
    await tx.wait();
    console.log(`  ✅ BSC adapter setPeer(${dstEid}, ${destAddr}) — tx: ${tx.hash}`);

    console.log(`\n  ⚠️  MANUAL STEP REQUIRED:`);
    console.log(`  Call setPeerAddress(30102, ${adapterAddress}) on the KENOOOFT at ${destAddr}`);
    console.log(`  using the deployer wallet on the ${dest.chain} network.`);
    console.log(`  This can be done via BscScan/Arbiscan write contract tab.`);
  }

  console.log('\n=== Connection complete ===');
  console.log('After setting peers on destination chains, KENO bridging is live.');
  console.log('\nBridge test (small amount first!):');
  console.log('  1. Approve adapter to spend your KENO on BSC');
  console.log(`  2. Call sendKENO(dstEid, yourAddress, amount, defaultOptions())`);
  console.log('  3. Monitor at https://layerzeroscan.com');
}

// ── Entry Point ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.includes('--dest')) {
      await deployOFT();
    } else if (args.includes('--connect')) {
      await connectPeers();
    } else {
      await deployAdapter();
    }
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();

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
    rpc:     'https://1rpc.io/eth',
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

function addressToBytes32(addr) {
  return ethers.zeroPadValue(addr, 32);
}

async function connectPeers() {
  console.log('\n=== STEP 3: Connect OFTAdapter ↔ KENOOOFT peers (both directions) ===\n');

  const addrFile = path.join(__dirname, '..', 'deployed-addresses.json');
  const addrs    = JSON.parse(fs.readFileSync(addrFile, 'utf8'));

  const adapterAddress = addrs.deployed.KENOOFTAdapter;
  const destinations   = addrs.deployed.KENOOOFT_destinations || {};

  if (!adapterAddress) throw new Error('KENOOFTAdapter not deployed yet — run without flags first');
  if (Object.keys(destinations).length === 0) throw new Error('No destination OFTs deployed yet — run --dest first');

  const privKey = process.env.DEPLOYER_PRIVATE_KEY;

  const { abi: adapterAbi } = compile('KENOOFTAdapter', 'KENOOFTAdapter.sol');
  const { abi: oftAbi }     = compile('KENOOOFT', 'KENOOOFT.sol');

  for (const [eidStr, dest] of Object.entries(destinations)) {
    const dstEid   = parseInt(eidStr);
    const destAddr = dest.address;
    const chainCfg = Object.values(CHAINS).find(c => c.eid === dstEid);

    console.log(`\n── Connecting BSC ↔ ${dest.chain} (EID ${dstEid}) ──`);
    console.log(`  BSC Adapter: ${adapterAddress}`);
    console.log(`  Dest OFT:    ${destAddr}`);

    // Direction 1: BSC adapter → destination OFT
    // Call setPeer(dstEid, bytes32) directly — avoids the this.X() delegation bug
    const bscProvider = new ethers.JsonRpcProvider(CHAINS.bsc.rpc);
    const bscWallet   = new ethers.Wallet(privKey, bscProvider);
    const adapter     = new ethers.Contract(adapterAddress, adapterAbi, bscWallet);

    const destBytes32 = addressToBytes32(destAddr);
    console.log(`\n  [BSC] calling setPeer(${dstEid}, ${destBytes32})...`);
    const tx1 = await adapter.setPeer(dstEid, destBytes32);
    await tx1.wait();
    console.log(`  ✅ BSC adapter now trusts ${dest.chain} OFT — tx: ${tx1.hash}`);

    // Direction 2: destination OFT → BSC adapter
    if (!chainCfg) {
      console.log(`  ⚠️  No RPC configured for EID ${dstEid} — skipping dest-side setPeer`);
      continue;
    }
    const destProvider = new ethers.JsonRpcProvider(chainCfg.rpc);
    const destWallet   = new ethers.Wallet(privKey, destProvider);
    const oft          = new ethers.Contract(destAddr, oftAbi, destWallet);

    const adapterBytes32 = addressToBytes32(adapterAddress);
    console.log(`  [${dest.chain}] calling setPeer(30102, ${adapterBytes32})...`);
    const tx2 = await oft.setPeer(30102, adapterBytes32);
    await tx2.wait();
    console.log(`  ✅ ${dest.chain} OFT now trusts BSC adapter — tx: ${tx2.hash}`);
  }

  console.log('\n=== Both directions connected — KENO bridging is LIVE ===');
  console.log('\nTo bridge KENO from BSC → Base:');
  console.log('  1. Approve KENOOFTAdapter to spend your KENO on BSC');
  console.log(`  2. Call sendKENO(30184, yourAddress, amount, defaultOptions())`);
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

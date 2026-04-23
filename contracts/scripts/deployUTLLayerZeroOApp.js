// UTLLayerZeroOApp Deployment Script
// Deploy on EVERY chain where UTL cross-chain functionality is needed.
// Run with: node contracts/scripts/deployUTLLayerZeroOApp.js --chain bsc
//
// Prerequisites:
//   DEPLOYER_PRIVATE_KEY must be set in environment
//   Artifact at contracts/artifacts/UTLLayerZeroOApp.json

import { ethers } from 'ethers';

// ── Chain configurations ──────────────────────────────────────────────────────
const CHAINS = {
    bsc: {
        eid:        30102,
        rpc:        'https://bsc-dataseed.binance.org',
        name:       'BNB Smart Chain',
        lzEndpoint: '0x1a44076050125825900e736c501f859c50fE728c',
        explorer:   'https://bscscan.com/address/',
    },
    ethereum: {
        eid:        30101,
        rpc:        'https://eth.llamarpc.com',
        name:       'Ethereum',
        lzEndpoint: '0x1a44076050125825900e736c501f859c50fE728c',
        explorer:   'https://etherscan.io/address/',
    },
    polygon: {
        eid:        30109,
        rpc:        'https://polygon.llamarpc.com',
        name:       'Polygon',
        lzEndpoint: '0x1a44076050125825900e736c501f859c50fE728c',
        explorer:   'https://polygonscan.com/address/',
    },
    arbitrum: {
        eid:        30110,
        rpc:        'https://arb1.arbitrum.io/rpc',
        name:       'Arbitrum One',
        lzEndpoint: '0x1a44076050125825900e736c501f859c50fE728c',
        explorer:   'https://arbiscan.io/address/',
    },
    base: {
        eid:        30184,
        rpc:        'https://mainnet.base.org',
        name:       'Base',
        lzEndpoint: '0x1a44076050125825900e736c501f859c50fE728c',
        explorer:   'https://basescan.org/address/',
    },
};

// After deploying on all chains, paste addresses here and run with --link flag
// to call setPeer() connecting each OApp to the others.
const DEPLOYED_PEERS = {
    // 30102: '0x...', // BSC
    // 30101: '0x...', // Ethereum
    // 30109: '0x...', // Polygon
};

async function deploy(chainKey) {
    const chain = CHAINS[chainKey];
    if (!chain) {
        console.error(`Unknown chain: ${chainKey}. Options: ${Object.keys(CHAINS).join(', ')}`);
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(chain.rpc);
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log(`\n═══════════════════════════════════════════════════════════`);
    console.log(`Deploying UTLLayerZeroOApp on ${chain.name} (EID: ${chain.eid})`);
    console.log(`═══════════════════════════════════════════════════════════`);
    console.log(`Deployer:   ${deployer.address}`);
    const bal = await provider.getBalance(deployer.address);
    console.log(`Balance:    ${ethers.formatEther(bal)} native\n`);

    // Verify LZ endpoint
    const code = await provider.getCode(chain.lzEndpoint);
    if (code === '0x') {
        console.error(`LZ endpoint not found on ${chain.name}`);
        process.exit(1);
    }
    console.log(`✅ LayerZero Endpoint verified: ${chain.lzEndpoint}`);

    let artifact;
    try {
        artifact = require('../artifacts/UTLLayerZeroOApp.json');
    } catch {
        console.error('Artifact not found — compile: npx hardhat compile');
        process.exit(1);
    }

    console.log('\nDeploying...');
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    const oapp    = await factory.deploy(chain.lzEndpoint, { gasLimit: 3_000_000n });
    await oapp.waitForDeployment();
    const addr = await oapp.getAddress();
    console.log(`✅ UTLLayerZeroOApp deployed: ${addr}`);
    console.log(`   ${chain.explorer}${addr}\n`);

    return { chainKey, eid: chain.eid, address: addr };
}

async function linkPeers() {
    console.log('\n── Linking peer OApps ───────────────────────────────────────');
    for (const [chainKey, chain] of Object.entries(CHAINS)) {
        const ownAddress = DEPLOYED_PEERS[chain.eid];
        if (!ownAddress) continue;

        const provider = new ethers.JsonRpcProvider(chain.rpc);
        const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
        let artifact;
        try { artifact = require('../artifacts/UTLLayerZeroOApp.json'); }
        catch { continue; }

        const oapp = new ethers.Contract(ownAddress, artifact.abi, deployer);

        for (const [peerEid, peerAddress] of Object.entries(DEPLOYED_PEERS)) {
            if (Number(peerEid) === chain.eid) continue;
            const peerBytes32 = ethers.zeroPadValue(peerAddress, 32);
            const tx = await oapp.setPeer(Number(peerEid), peerBytes32, { gasLimit: 200_000n });
            await tx.wait();
            console.log(`✅ ${chainKey} ↔ EID ${peerEid} peer set`);
        }
    }
}

async function main() {
    const args   = process.argv.slice(2);
    const link   = args.includes('--link');
    const chain  = args.find(a => !a.startsWith('--')) || 'bsc';

    if (link) {
        await linkPeers();
    } else {
        const result = await deploy(chain);
        console.log('\n──────────────────────────────────────────────────────────────');
        console.log('NEXT STEPS:');
        console.log('──────────────────────────────────────────────────────────────');
        console.log(`1. Add to DEPLOYED_PEERS: ${result.eid}: '${result.address}'`);
        console.log(`2. Deploy on other chains: node deployUTLLayerZeroOApp.js ethereum`);
        console.log(`3. Once all chains deployed, run: node deployUTLLayerZeroOApp.js --link`);
        console.log(`   This wires up all OApps so they trust each other`);
        console.log('');
        console.log('FEE SUMMARY:');
        console.log('  Message relay:   5% of LayerZero native gas fee');
        console.log('  Token bridge:    0.07% of bridged token amount');
        console.log('  KENO bridge:     0.07% (tracked separately for analytics)');
        console.log('  All fees → UTL FeeCollector → 60% stakers / 25% TDIR / 15% treasury');
        console.log('──────────────────────────────────────────────────────────────\n');
    }
}

main().catch(console.error);

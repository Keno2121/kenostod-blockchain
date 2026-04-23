// UTL1inchRouter Deployment Script
// Network: BSC Mainnet (chainId 56)
// Run with: node contracts/scripts/deployUTL1inchRouter.js
//
// Prerequisites:
//   DEPLOYER_PRIVATE_KEY must be set in environment
//   Artifact at contracts/artifacts/UTL1inchRouter.json

import { ethers } from 'ethers';

const BSC_RPC = 'https://bsc-dataseed.binance.org';

const ONEINCH_ROUTER_V6 = '0x111111125421cA6dc452d289314280a0f8842A65';

// Minimal ABI to verify 1inch router is live
const ROUTER_ABI = ['function LIMIT_ORDER_PROTOCOL() view returns (address)'];

async function main() {
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log(`\nDeployer: ${deployer.address}`);
    const balance = await provider.getBalance(deployer.address);
    console.log(`Balance:  ${ethers.formatEther(balance)} BNB\n`);

    // Verify 1inch router is live
    console.log('Verifying 1inch Aggregation Router v6...');
    const code = await provider.getCode(ONEINCH_ROUTER_V6);
    if (code === '0x') {
        console.error('1inch Router v6 not found on BSC — check address');
        process.exit(1);
    }
    console.log(`✅ 1inch Router v6 confirmed at ${ONEINCH_ROUTER_V6}\n`);

    // Load artifact
    let artifact;
    try {
        artifact = require('../artifacts/UTL1inchRouter.json');
    } catch {
        console.error('Artifact not found — compile first: npx hardhat compile');
        process.exit(1);
    }

    // Deploy
    console.log('Deploying UTL1inchRouter...');
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    const router  = await factory.deploy({ gasLimit: 3_000_000n });
    await router.waitForDeployment();
    const routerAddress = await router.getAddress();
    console.log(`✅ UTL1inchRouter deployed at: ${routerAddress}\n`);

    // Print full integration summary
    console.log('──────────────────────────────────────────────────────────────');
    console.log('UTL 1inch Router — Deployment Complete');
    console.log('──────────────────────────────────────────────────────────────');
    console.log(`Router Contract:    ${routerAddress}`);
    console.log(`1inch Router v6:    ${ONEINCH_ROUTER_V6}`);
    console.log(`UTL FeeCollector:   0xfE537c43d202C455Cedc141B882c808287BB662f`);
    console.log('');
    console.log('SWAP OPERATIONS & FEES:');
    console.log('  swap(executor, desc, data, recipient, minNet)   0.07% on output');
    console.log('  swapBNB(...)                                     0.07% on output');
    console.log('  swapToBNB(...)                                   0.07% on output');
    console.log('  resolveOrder(...) [Fusion resolver]              0.05% on fill');
    console.log('');
    console.log('HOW TO USE WITH 1INCH API:');
    console.log('  1. Call 1inch API: GET /v6.0/56/swap?fromTokenAddress=...&toTokenAddress=...');
    console.log('     &amount=...&fromAddress=USER_WALLET&receiver=UTL_ROUTER_ADDRESS');
    console.log(`     Receiver: ${routerAddress}`);
    console.log('  2. User approves srcToken to this UTL router (not 1inch directly)');
    console.log('  3. User calls UTL1inchRouter.swap(executor, desc, data, userWallet, minNet)');
    console.log('  4. UTL collects 0.07%, user gets net output, loyalty points recorded');
    console.log('');
    console.log('FEE DISTRIBUTION:');
    console.log('  60% → UTL USDC Stakers');
    console.log('  25% → T.D.I.R. Foundation');
    console.log('  15% → UTL Treasury');
    console.log('');
    console.log('FRONTEND INTEGRATION (add to utl-dashboard.html):');
    console.log(`const UTL_ONEINCH_ROUTER = '${routerAddress}';`);
    console.log('');
    console.log('BscScan verification:');
    console.log(`npx hardhat verify --network bsc ${routerAddress}`);
    console.log('──────────────────────────────────────────────────────────────\n');
}

main().catch(console.error);

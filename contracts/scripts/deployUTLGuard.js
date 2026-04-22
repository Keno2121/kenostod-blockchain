// UTLGuard Deployment Script
// Network: BSC Mainnet (chainId 56)
// Run with: node contracts/scripts/deployUTLGuard.js
//
// Prerequisites:
//   DEPLOYER_PRIVATE_KEY must be set in environment
//   UTLGuard must be compiled — artifact at contracts/artifacts/UTLGuard.json
//
// What this does:
//   1. Deploys UTLGuard to BSC mainnet
//   2. Registers the T.D.I.R. Foundation Safe (if known)
//   3. Prints setup instructions for existing Safe owners

import { ethers } from 'ethers';

const BSC_RPC = 'https://bsc-dataseed.binance.org';

// Known Safe addresses to pre-register (add yours here)
const FOUNDATION_SAFE = ''; // TODO: add T.D.I.R. Foundation Safe address

async function main() {
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log(`\nDeployer: ${deployer.address}`);
    const balance = await provider.getBalance(deployer.address);
    console.log(`Balance: ${ethers.formatEther(balance)} BNB\n`);

    // Load compiled artifact
    let artifact;
    try {
        artifact = require('../artifacts/UTLGuard.json');
    } catch {
        console.error('Artifact not found — compile first: npx hardhat compile');
        process.exit(1);
    }

    // Deploy
    console.log('Deploying UTLGuard...');
    const factory  = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    const guard    = await factory.deploy({ gasLimit: 2_000_000n });
    await guard.waitForDeployment();
    const guardAddress = await guard.getAddress();
    console.log(`✅ UTLGuard deployed at: ${guardAddress}`);

    // Register Foundation Safe if address is known
    if (FOUNDATION_SAFE && ethers.isAddress(FOUNDATION_SAFE)) {
        console.log('\nRegistering Foundation Safe...');
        const tx = await guard.registerSafe(FOUNDATION_SAFE);
        await tx.wait();
        console.log(`✅ Foundation Safe registered: ${FOUNDATION_SAFE}`);
    }

    // Print setup instructions
    console.log('\n─────────────────────────────────────────────────────────');
    console.log('UTL Guard — Deployment Complete');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`Guard Contract:    ${guardAddress}`);
    console.log(`UTL FeeCollector:  0xfE537c43d202C455Cedc141B882c808287BB662f`);
    console.log(`Fee (BNB txs):     0.09% of transaction value`);
    console.log(`Fee (calls):       0.0001 BNB flat per tx`);
    console.log(`Staker cut:        60% of every fee`);
    console.log('');
    console.log('SETUP FOR EXISTING SAFE OWNERS:');
    console.log('─────────────────────────────────────────────────────────');
    console.log('1. Go to app.safe.global → your Safe → Settings → Guard');
    console.log(`2. Set guard to: ${guardAddress}`);
    console.log('3. Execute the settings transaction (requires threshold sigs)');
    console.log(`4. Call registerSafe(yourSafeAddress) on the guard contract`);
    console.log('5. Call fundReserve(yourSafeAddress) with some BNB (e.g. 0.01 BNB)');
    console.log('   This covers ~100 transactions at flat rate');
    console.log('6. Done — every Safe tx now earns UTL stakers rewards');
    console.log('─────────────────────────────────────────────────────────\n');

    // BscScan verification command
    console.log('Verify on BscScan:');
    console.log(`npx hardhat verify --network bsc ${guardAddress}`);
    console.log('');
}

main().catch(console.error);

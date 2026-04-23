// UTLdeBridgeRouter Deployment Script
// Network: BSC Mainnet (chainId 56)
// Run with: node contracts/scripts/deployUTLdeBridgeRouter.js
//
// Prerequisites:
//   DEPLOYER_PRIVATE_KEY must be set in environment
//   Artifact at contracts/artifacts/UTLdeBridgeRouter.json
//
// IMPORTANT — before deploying:
//   Register UTL as a deBridge affiliate at https://app.debridge.finance/affiliates
//   You'll receive a referral code (uint32) — pass it as REFERRAL_CODE below.
//   Without registration, affiliate fees will be unclaimed.

import { ethers } from 'ethers';

const BSC_RPC = 'https://bsc-dataseed.binance.org';

// ── Set your deBridge referral code here after registering ──────────────────
// Register at: https://app.debridge.finance/affiliates
// Leave 0 until you have a registered code
const REFERRAL_CODE = 0;

// deBridge contracts to verify
const DLN_SOURCE      = '0xeF4fB24aD0916217251F553c0596F8Edc630EB66';
const DLN_DESTINATION = '0xe7351Fd770A37282b91D153Ee690B63579D6dd7F';
const DEBRIDGE_GATE   = '0x43dE2d77BF8027e25dBD179B491e8d64f38398aA';

async function main() {
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log(`\nDeployer: ${deployer.address}`);
    const bal = await provider.getBalance(deployer.address);
    console.log(`Balance:  ${ethers.formatEther(bal)} BNB\n`);

    // Verify deBridge contracts are live
    console.log('Verifying deBridge contracts on BSC...');
    for (const [name, addr] of Object.entries({ DLN_SOURCE, DLN_DESTINATION, DEBRIDGE_GATE })) {
        const code = await provider.getCode(addr);
        const ok   = code !== '0x';
        console.log(`  ${ok ? '✅' : '❌'} ${name}: ${addr}`);
    }

    // Load artifact
    let artifact;
    try {
        artifact = require('../artifacts/UTLdeBridgeRouter.json');
    } catch {
        console.error('\nArtifact not found — compile: npx hardhat compile');
        process.exit(1);
    }

    // Deploy
    console.log('\nDeploying UTLdeBridgeRouter...');
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    const router  = await factory.deploy(REFERRAL_CODE, { gasLimit: 3_000_000n });
    await router.waitForDeployment();
    const routerAddress = await router.getAddress();
    console.log(`✅ UTLdeBridgeRouter deployed: ${routerAddress}`);
    console.log(`   https://bscscan.com/address/${routerAddress}\n`);

    // Authorize the arb bot as a filler
    console.log('Setting authorized filler (deployer as initial filler)...');
    const tx = await router.setAuthorizedFiller(deployer.address, true);
    await tx.wait();
    console.log(`✅ Filler authorized: ${deployer.address}`);

    // Print full summary
    console.log('\n──────────────────────────────────────────────────────────────');
    console.log('UTL deBridge Router — Deployment Complete');
    console.log('──────────────────────────────────────────────────────────────');
    console.log(`Router Contract:      ${routerAddress}`);
    console.log(`DLN Source:           ${DLN_SOURCE}`);
    console.log(`DLN Destination:      ${DLN_DESTINATION}`);
    console.log(`UTL FeeCollector:     0xfE537c43d202C455Cedc141B882c808287BB662f`);
    console.log(`Referral Code:        ${REFERRAL_CODE || '(not set — register first)'}`);
    console.log('');
    console.log('REVENUE STREAMS:');
    console.log('  Stream 1 — Affiliate Fees (zero cost to users):');
    console.log('    UTL earns 50% of deBridge protocol fee on every order');
    console.log('    deBridge charges ~0.1% per bridge → UTL earns ~0.05%');
    console.log('    $1,000,000 monthly bridge volume = ~$500 → stakers');
    console.log('');
    console.log('  Stream 2 — Maker Fill Fees (requires pool liquidity):');
    console.log('    UTL fills DLN orders, earns spread minus 0.05% UTL fee');
    console.log('    Filler bot monitors profitable orders via deBridge events');
    console.log('    Add liquidity: router.addLiquidity(tokenAddress, amount)');
    console.log('');
    console.log('NEXT STEPS:');
    console.log('  1. Register as deBridge affiliate: https://app.debridge.finance/affiliates');
    console.log('  2. Update REFERRAL_CODE and redeploy (or call setReferralCode())');
    console.log('  3. Add USDC/USDT maker pool liquidity for order filling');
    console.log('  4. Connect the UTL arb bot to monitor DlnSource OrderCreated events');
    console.log('  5. Integrate createOrder() into utl-dashboard.html cross-chain UI');
    console.log('');
    console.log('FEE DISTRIBUTION:');
    console.log('  All fees → UTL FeeCollector → 60% stakers / 25% TDIR / 15% treasury');
    console.log('──────────────────────────────────────────────────────────────');
    console.log('');
    console.log('BscScan verification:');
    console.log(`npx hardhat verify --network bsc ${routerAddress} ${REFERRAL_CODE}`);
}

main().catch(console.error);

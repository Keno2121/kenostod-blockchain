// UTLVenusWrapper Deployment Script
// Network: BSC Mainnet (chainId 56)
// Run with: node contracts/scripts/deployUTLVenusWrapper.js
//
// Prerequisites:
//   DEPLOYER_PRIVATE_KEY must be set in environment
//   Artifact at contracts/artifacts/UTLVenusWrapper.json
//
// What this does:
//   1. Deploys UTLVenusWrapper to BSC mainnet
//   2. Verifies key Venus market addresses are reachable
//   3. Prints integration summary and BscScan verification command

import { ethers } from 'ethers';

const BSC_RPC = 'https://bsc-dataseed.binance.org';

// Venus vToken addresses — verified BSC mainnet
const VTOKENS = {
    vUSDC: '0xecA88125a5ADbe82614ffC12D0DB554E2e2867C8',
    vBUSD: '0x95c78222B3D6e262426483D42CfA53685A67Ab9D',
    vUSDT: '0xfD5840Cd36d94D7229439859C0112a4185BC0255',
    vETH:  '0xf508fCD89b8bd15579dc79A6827cB4686A3592c8',
    vBTC:  '0x882C173bC7Ff3b7786CA16dfeD3DFFfb9Ee7847',
    vBNB:  '0xA07c5b74C9B40447a954e1466938b865b6BBea36',
};

const VTOKEN_ABI = ['function symbol() view returns (string)', 'function underlying() view returns (address)'];

async function main() {
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

    console.log(`\nDeployer: ${deployer.address}`);
    const balance = await provider.getBalance(deployer.address);
    console.log(`Balance:  ${ethers.formatEther(balance)} BNB\n`);

    // Verify Venus markets are live
    console.log('Verifying Venus markets...');
    for (const [name, addr] of Object.entries(VTOKENS)) {
        try {
            const vt = new ethers.Contract(addr, VTOKEN_ABI, provider);
            const symbol = await vt.symbol();
            console.log(`  ✅ ${name} (${symbol}) at ${addr}`);
        } catch {
            console.log(`  ⚠️  ${name} unreachable at ${addr}`);
        }
    }

    // Load compiled artifact
    let artifact;
    try {
        artifact = require('../artifacts/UTLVenusWrapper.json');
    } catch {
        console.error('\nArtifact not found — compile first: npx hardhat compile');
        process.exit(1);
    }

    // Deploy
    console.log('\nDeploying UTLVenusWrapper...');
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    const wrapper = await factory.deploy({ gasLimit: 3_000_000n });
    await wrapper.waitForDeployment();
    const wrapperAddress = await wrapper.getAddress();
    console.log(`✅ UTLVenusWrapper deployed at: ${wrapperAddress}`);

    // Print complete integration summary
    console.log('\n──────────────────────────────────────────────────────────');
    console.log('UTL Venus Wrapper — Deployment Complete');
    console.log('──────────────────────────────────────────────────────────');
    console.log(`Wrapper Contract:    ${wrapperAddress}`);
    console.log(`UTL FeeCollector:    0xfE537c43d202C455Cedc141B882c808287BB662f`);
    console.log('');
    console.log('SUPPORTED OPERATIONS & FEES:');
    console.log('  supply(vToken, amount)           0.05% of deposit');
    console.log('  supplyBNB()                      0.05% of BNB value');
    console.log('  withdraw(vToken, vTokenAmount)   0.05% of withdrawal');
    console.log('  borrow(vToken, amount)            0.09% of loan');
    console.log('  repay(vToken, repayAmount)        0.09% of repayment');
    console.log('  liquidate(vToken, ...)            0.15% of repay amount');
    console.log('');
    console.log('FEE DISTRIBUTION:');
    console.log('  60% → UTL USDC Stakers');
    console.log('  25% → T.D.I.R. Foundation');
    console.log('  15% → UTL Treasury');
    console.log('');
    console.log('USER INCENTIVES:');
    console.log('  Loyalty points earned on every operation');
    console.log('  Points → tier advancement → higher staking multipliers');
    console.log('  Liquidations earn 5x loyalty points');
    console.log('──────────────────────────────────────────────────────────');
    console.log('');
    console.log('Add to UTL Dashboard — wrapper address for frontend:');
    console.log(`const UTL_VENUS_WRAPPER = '${wrapperAddress}';`);
    console.log('');
    console.log('BscScan verification:');
    console.log(`npx hardhat verify --network bsc ${wrapperAddress}`);
    console.log('');
}

main().catch(console.error);

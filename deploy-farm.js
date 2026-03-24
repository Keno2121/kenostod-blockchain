/**
 * UTLFarm Standalone Deployment Script
 * Uses ethers.js + solc directly — no Hardhat required
 */

require('dotenv').config();
const { ethers } = require('ethers');
const solc = require('solc');
const fs = require('fs');
const path = require('path');

const KENO_TOKEN = '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E';
const LP_TOKEN   = '0x72368adf1487eeebcb095f16cf8cbf91f2b44880';
const REWARD_RATE = ethers.parseEther('0.01'); // 0.01 KENO/sec = 864 KENO/day
const BSC_RPC    = 'https://bsc-dataseed1.binance.org/';

async function main() {
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey || privateKey === 'PASTE_YOUR_KEY_HERE') {
        throw new Error('DEPLOYER_PRIVATE_KEY not set in environment');
    }

    console.log('='.repeat(60));
    console.log('  UTLFarm Deployment — Kenostod Blockchain Academy LLC');
    console.log('='.repeat(60));

    // Connect to BSC
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    const wallet   = new ethers.Wallet(privateKey, provider);
    const balance  = await provider.getBalance(wallet.address);
    const network  = await provider.getNetwork();

    console.log(`  Network:   BSC Mainnet (Chain ID: ${network.chainId})`);
    console.log(`  Deployer:  ${wallet.address}`);
    console.log(`  Balance:   ${ethers.formatEther(balance)} BNB`);

    if (balance < ethers.parseEther('0.001')) {
        throw new Error(`Balance too low: ${ethers.formatEther(balance)} BNB. Need at least 0.001 BNB.`);
    }

    // Read contract source
    console.log('\n[1/3] Compiling UTLFarm.sol...');
    const source = fs.readFileSync(path.join(__dirname, 'utl/contracts/UTLFarm.sol'), 'utf8');

    const input = {
        language: 'Solidity',
        sources: { 'UTLFarm.sol': { content: source } },
        settings: {
            outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
            optimizer: { enabled: true, runs: 200 }
        }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
        const errors = output.errors.filter(e => e.severity === 'error');
        if (errors.length > 0) {
            console.error('Compilation errors:', errors);
            throw new Error('Compilation failed');
        }
    }

    const contract  = output.contracts['UTLFarm.sol']['UTLFarm'];
    const abi       = contract.abi;
    const bytecode  = '0x' + contract.evm.bytecode.object;
    console.log('  ✅ Compiled successfully');

    // Deploy
    console.log('\n[2/3] Deploying to BSC Mainnet...');
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const deployed = await factory.deploy(KENO_TOKEN, LP_TOKEN, REWARD_RATE, {
        gasPrice: ethers.parseUnits('3', 'gwei')
    });
    await deployed.waitForDeployment();
    const address = await deployed.getAddress();
    console.log(`  ✅ UTLFarm deployed: ${address}`);
    console.log(`  🔍 BscScan: https://bscscan.com/address/${address}`);

    // Save record
    console.log('\n[3/3] Saving deployment record...');
    const record = {
        contract: 'UTLFarm', version: '1.0',
        network: 'bsc', chainId: 56,
        address, deployer: wallet.address,
        kenoToken: KENO_TOKEN, lpToken: LP_TOKEN,
        rewardRate: REWARD_RATE.toString(),
        deployedAt: new Date().toISOString(),
        bscscan: `https://bscscan.com/address/${address}`
    };

    const dir = path.join(__dirname, 'utl/deployments');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'UTLFarm-56.json'), JSON.stringify(record, null, 2));

    // Update farm.html with live address
    const farmPath = path.join(__dirname, 'public/farm.html');
    if (fs.existsSync(farmPath)) {
        let html = fs.readFileSync(farmPath, 'utf8');
        html = html.replace(
            "const FARM_CONTRACT = null; // TBA after deployment",
            `const FARM_CONTRACT = '${address}';`
        );
        html = html.replace(
            `<span style="font-size:.8rem;color:#475569;font-style:italic;">Deploying to BSC Mainnet — address TBA</span>`,
            `<a href="https://bscscan.com/address/${address}" target="_blank" rel="noopener" style="font-size:.8rem;color:#10b981;font-family:monospace;word-break:break-all;text-decoration:none;">${address} ↗</a>`
        );
        fs.writeFileSync(farmPath, html);
        console.log('  ✅ Updated farm.html with live contract address');
    }

    // Update farm-application.html
    const appPath = path.join(__dirname, 'public/farm-application.html');
    if (fs.existsSync(appPath)) {
        let html = fs.readFileSync(appPath, 'utf8');
        html = html.replace(
            `<div class="field-value" id="farmContractField" style="color:#64748b;font-style:italic;">\n                    Deploying — address will appear here after deployment\n                </div>`,
            `<div class="field-value" id="farmContractField"><a href="https://bscscan.com/address/${address}" target="_blank" style="color:#10b981;font-family:monospace;word-break:break-all;">${address} ↗</a></div>`
        );
        html = html.replace(
            '[UTLFarm — deploying to BSC mainnet]',
            address
        );
        fs.writeFileSync(appPath, html);
        console.log('  ✅ Updated farm-application.html');
    }

    console.log('\n' + '='.repeat(60));
    console.log('  DEPLOYMENT COMPLETE');
    console.log('='.repeat(60));
    console.log(`  UTLFarm Address: ${address}`);
    console.log(`  BscScan:         https://bscscan.com/address/${address}`);
    console.log('\n  NEXT: Fund reward pool then submit PancakeSwap application');
    console.log('='.repeat(60));

    return address;
}

main().catch(err => {
    console.error('\n❌ DEPLOYMENT FAILED:', err.message);
    process.exit(1);
});

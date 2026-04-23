// ─────────────────────────────────────────────────────────────────────────────
// UTL Protocol — Master Deploy Script
// Deploys all 5 ready-to-go contracts in priority order:
//   1. FlashArbLoan2    — multi-DEX flash arb (no external approval needed)
//   2. UTLdeBridgeRouter — affiliate fees, referral 32946 hardcoded
//   3. UTLGuard         — Gnosis Safe guard
//   4. UTL1inchRouter   — 1inch aggregator + Fusion
//   5. UTLVenusWrapper  — Venus lending wrapper
//
// Run: node contracts/scripts/deployAll.js
// Requires: DEPLOYER_PRIVATE_KEY env var + compiled artifacts in contracts/artifacts/
// ─────────────────────────────────────────────────────────────────────────────

const { ethers } = require('ethers');
const fs         = require('fs');
const path       = require('path');

const BSC_RPC   = 'https://bsc-dataseed.binance.org';
const ARTIFACTS = path.join(__dirname, '..', 'artifacts');

const UTL_FEE_COLLECTOR = '0xfE537c43d202C455Cedc141B882c808287BB662f';

function loadArtifact(name) {
    const candidates = [
        path.join(ARTIFACTS, `utl/${name}.sol/${name}.json`),
        path.join(ARTIFACTS, `${name}.json`),
        path.join(ARTIFACTS, `utl/${name}.json`),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    throw new Error(`Artifact not found for ${name}. Run: cd contracts && npx hardhat compile`);
}

async function deployContract(factory, name, args = [], options = {}) {
    console.log(`\n🚀 Deploying ${name}...`);
    const contract = await factory.deploy(...args, { gasLimit: 3_500_000n, ...options });
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    console.log(`   ✅ ${name}: ${address}`);
    console.log(`   🔗 https://bscscan.com/address/${address}`);
    return { contract, address };
}

async function main() {
    const key = process.env.DEPLOYER_PRIVATE_KEY;
    if (!key) throw new Error('DEPLOYER_PRIVATE_KEY not set');

    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    const deployer = new ethers.Wallet(key, provider);

    const bal = await provider.getBalance(deployer.address);
    console.log(`\n${'─'.repeat(62)}`);
    console.log('UTL Protocol — Master Deployment');
    console.log(`${'─'.repeat(62)}`);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance:  ${ethers.formatEther(bal)} BNB`);
    console.log(`Network:  BSC Mainnet (chainId 56)`);
    console.log(`${'─'.repeat(62)}`);

    if (parseFloat(ethers.formatEther(bal)) < 0.05) {
        console.error('\n❌ Insufficient BNB. Need at least 0.05 BNB for deployment gas.');
        console.error('   Send BNB to:', deployer.address);
        process.exit(1);
    }

    const deployed = {};

    // ── 1. FlashArbLoan2 ──────────────────────────────────────────────────
    try {
        const art = loadArtifact('FlashArbLoan2');
        const factory = new ethers.ContractFactory(art.abi, art.bytecode, deployer);
        const { address } = await deployContract(factory, 'FlashArbLoan2');
        deployed.FlashArbLoan2 = address;
    } catch (e) { console.error(`   ❌ FlashArbLoan2 failed: ${e.message}`); }

    // ── 2. UTLdeBridgeRouter ──────────────────────────────────────────────
    try {
        const art = loadArtifact('UTLdeBridgeRouter');
        const factory = new ethers.ContractFactory(art.abi, art.bytecode, deployer);
        const { contract, address } = await deployContract(factory, 'UTLdeBridgeRouter', [32946]);
        deployed.UTLdeBridgeRouter = address;
        // Authorize deployer as initial filler
        const tx = await contract.setAuthorizedFiller(deployer.address, true);
        await tx.wait();
        console.log(`   ✅ Filler authorized`);
    } catch (e) { console.error(`   ❌ UTLdeBridgeRouter failed: ${e.message}`); }

    // ── 3. UTLGuard ───────────────────────────────────────────────────────
    try {
        const art = loadArtifact('UTLGuard');
        const factory = new ethers.ContractFactory(art.abi, art.bytecode, deployer);
        const { address } = await deployContract(factory, 'UTLGuard');
        deployed.UTLGuard = address;
    } catch (e) { console.error(`   ❌ UTLGuard failed: ${e.message}`); }

    // ── 4. UTL1inchRouter ─────────────────────────────────────────────────
    try {
        const art = loadArtifact('UTL1inchRouter');
        const factory = new ethers.ContractFactory(art.abi, art.bytecode, deployer);
        const { address } = await deployContract(factory, 'UTL1inchRouter');
        deployed.UTL1inchRouter = address;
    } catch (e) { console.error(`   ❌ UTL1inchRouter failed: ${e.message}`); }

    // ── 5. UTLVenusWrapper ────────────────────────────────────────────────
    try {
        const art = loadArtifact('UTLVenusWrapper');
        const factory = new ethers.ContractFactory(art.abi, art.bytecode, deployer);
        const { address } = await deployContract(factory, 'UTLVenusWrapper');
        deployed.UTLVenusWrapper = address;
    } catch (e) { console.error(`   ❌ UTLVenusWrapper failed: ${e.message}`); }

    // ── Summary ───────────────────────────────────────────────────────────
    const balAfter = await provider.getBalance(deployer.address);
    const gasSpent = parseFloat(ethers.formatEther(bal - balAfter));

    console.log(`\n${'─'.repeat(62)}`);
    console.log('DEPLOYMENT COMPLETE');
    console.log(`${'─'.repeat(62)}`);
    for (const [name, addr] of Object.entries(deployed)) {
        console.log(`${name.padEnd(22)} ${addr}`);
    }
    console.log(`\nGas spent: ~${gasSpent.toFixed(5)} BNB ($${(gasSpent * 600).toFixed(2)})`);
    console.log(`Balance remaining: ${ethers.formatEther(balAfter)} BNB`);
    console.log(`UTL FeeCollector: ${UTL_FEE_COLLECTOR}`);
    console.log(`\nNEXT STEPS:`);
    console.log(`  1. Update outreach.html with deployed addresses`);
    console.log(`  2. FlashArbLoan2: bot calls quoteBest() then executeFlashArb()`);
    console.log(`  3. UTLdeBridgeRouter: integrate into bridge UI`);
    console.log(`  4. Update live-arb-bot.html with FlashArbLoan2 address`);
    console.log(`${'─'.repeat(62)}\n`);

    // Save deployed addresses to file
    fs.writeFileSync(
        path.join(__dirname, '..', 'deployed-addresses.json'),
        JSON.stringify({ network: 'bsc-mainnet', deployer: deployer.address, deployed, timestamp: new Date().toISOString() }, null, 2)
    );
    console.log('Addresses saved to contracts/deployed-addresses.json');
}

main().catch(e => { console.error(e); process.exit(1); });

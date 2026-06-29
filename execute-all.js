/**
 * COMBINED EXECUTION SCRIPT
 * Fires simultaneously from the compromised wallet:
 *   1. Whitelist UTLFarm on KENO token
 *   2. Transfer ownership of all 5 contracts to new safe wallet
 *
 * Run: node execute-all.js
 * Then IMMEDIATELY send 0.002 BNB to 0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf
 */

require('dotenv').config();
const { ethers } = require('ethers');

const NEW_OWNER   = '0x4AA73FadfFd71E6549867a37455EA957A52Cf849';
const COMPROMISED = '0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf';
const KENO_TOKEN  = '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E';
const FARM_ADDR   = '0xaf991D0A2b4Ab522Adc6766fc0FdCbAfFA541094';

const CONTRACTS = [
    { name: 'KENO Token',    address: '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E' },
    { name: 'Staking',       address: '0x49961979c93f43f823BB3593b207724194019d1d' },
    { name: 'Fee Collector', address: '0xfE537c43d202C455Cedc141B882c808287BB662f' },
    { name: 'Treasury',      address: '0x3B3538b955647d811D42400084e9409e6593bE97' },
    { name: 'Distribution',  address: '0xE6918cdBB9D8cd0d3532A88D974734B2F1A793c7' },
];

const OWNABLE_ABI = [
    'function owner() view returns (address)',
    'function transferOwnership(address newOwner)',
];

const KENO_ABI = [
    'function updateWhitelist(address, bool) external',
    'function isWhitelisted(address) view returns (bool)',
    'function owner() view returns (address)',
];

const BSC_RPC   = 'https://bsc-dataseed1.binance.org/';
const GAS_PRICE = ethers.parseUnits('10', 'gwei');
const GAS_LIMIT = 80000n;
const MIN_BNB   = ethers.parseEther('0.001');

async function fireEverything(wallet, provider) {
    console.log('\n🚀 FIRING ALL TRANSACTIONS SIMULTANEOUSLY...\n');

    const startNonce = await provider.getTransactionCount(wallet.address, 'pending');
    const txPromises = [];
    let nonceOffset = 0;
    const iface = new ethers.Interface([...OWNABLE_ABI, ...KENO_ABI]);

    // TX 1: Whitelist UTLFarm on KENO token
    const kenoContract = new ethers.Contract(KENO_TOKEN, KENO_ABI, provider);
    const alreadyWhitelisted = await kenoContract.isWhitelisted(FARM_ADDR).catch(() => false);

    if (!alreadyWhitelisted) {
        const data = iface.encodeFunctionData('updateWhitelist', [FARM_ADDR, true]);
        const nonce = startNonce + nonceOffset++;
        console.log(`📤 Whitelisting UTLFarm on KENO (nonce ${nonce})...`);
        txPromises.push(
            wallet.sendTransaction({ to: KENO_TOKEN, data, gasLimit: GAS_LIMIT, gasPrice: GAS_PRICE, nonce, chainId: 56 })
                .then(tx => {
                    console.log(`   ✅ Whitelist tx sent: ${tx.hash}`);
                    return tx.wait().then(() => console.log('   🔒 UTLFarm WHITELISTED on KENO!'));
                })
                .catch(err => console.error(`   ❌ Whitelist failed: ${err.message}`))
        );
    } else {
        console.log('✅ UTLFarm already whitelisted on KENO');
    }

    // TX 2-6: Transfer ownership of all 5 contracts
    for (const c of CONTRACTS) {
        const contract = new ethers.Contract(c.address, OWNABLE_ABI, provider);
        let currentOwner;
        try {
            currentOwner = await contract.owner();
        } catch {
            console.log(`⚠️  ${c.name}: no owner() — skipping`);
            continue;
        }

        if (currentOwner.toLowerCase() === NEW_OWNER.toLowerCase()) {
            console.log(`✅ ${c.name}: already transferred`);
            continue;
        }

        if (currentOwner.toLowerCase() !== wallet.address.toLowerCase()) {
            console.log(`⚠️  ${c.name}: owner is ${currentOwner} — not deployer, skipping`);
            continue;
        }

        const data  = iface.encodeFunctionData('transferOwnership', [NEW_OWNER]);
        const nonce = startNonce + nonceOffset++;
        console.log(`📤 Transferring ${c.name} → new wallet (nonce ${nonce})...`);
        txPromises.push(
            wallet.sendTransaction({ to: c.address, data, gasLimit: GAS_LIMIT, gasPrice: GAS_PRICE, nonce, chainId: 56 })
                .then(tx => {
                    console.log(`   ✅ ${c.name} tx: ${tx.hash}`);
                    return tx.wait().then(() => console.log(`   🔒 ${c.name} TRANSFERRED!`));
                })
                .catch(err => console.error(`   ❌ ${c.name} failed: ${err.message}`))
        );
    }

    await Promise.all(txPromises);

    console.log('\n═══════════════════════════════════════════');
    console.log('✅ ALL DONE — verify on BscScan:');
    CONTRACTS.forEach(c => console.log(`   https://bscscan.com/address/${c.address}#readContract`));
    console.log('\n⚡ NEXT: Run fund-farm.js from new wallet to fund UTLFarm rewards');
}

async function main() {
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    const pk = process.env.DEPLOYER_PRIVATE_KEY;
    if (!pk) { console.error('❌ DEPLOYER_PRIVATE_KEY not set'); process.exit(1); }

    const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x'+pk, provider);

    console.log('\n═══════════════════════════════════════════');
    console.log('  KENOSTOD — COMBINED RESCUE EXECUTION');
    console.log('═══════════════════════════════════════════');
    console.log(`🔐 Compromised wallet: ${wallet.address}`);
    console.log(`🆕 New safe wallet:    ${NEW_OWNER}`);
    console.log(`🌾 UTLFarm address:    ${FARM_ADDR}`);

    const balance = await provider.getBalance(wallet.address);
    console.log(`\n💰 Current BNB balance: ${ethers.formatEther(balance)} BNB`);

    if (balance >= MIN_BNB) {
        console.log('✅ Balance sufficient — firing immediately...');
        await fireEverything(wallet, provider);
        return;
    }

    console.log('\n════════════════════════════════════════════════════');
    console.log('⏳ WAITING FOR GAS — SEND NOW FROM YOUR NEW METAMASK:');
    console.log('════════════════════════════════════════════════════');
    console.log(`   To:     ${COMPROMISED}`);
    console.log(`   Amount: 0.002 BNB`);
    console.log(`   Script fires THE INSTANT balance >= 0.001 BNB`);
    console.log('════════════════════════════════════════════════════\n');

    const interval = setInterval(async () => {
        try {
            const bal = await provider.getBalance(COMPROMISED);
            process.stdout.write(`\r   Watching... balance: ${ethers.formatEther(bal)} BNB  `);
            if (bal >= MIN_BNB) {
                clearInterval(interval);
                console.log('\n\n🔥 BNB DETECTED — LAUNCHING NOW!');
                await fireEverything(wallet, provider);
                process.exit(0);
            }
        } catch (e) { /* network blip */ }
    }, 1000);
}

main().catch(console.error);

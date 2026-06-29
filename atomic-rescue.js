/**
 * ATOMIC RESCUE — Pre-signs all txs, broadcasts the millisecond BNB lands
 * No polling delay. Transactions are signed BEFORE BNB is sent.
 * Uses 20 gwei to outbid any drain bot.
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

const ABI = [
    'function owner() view returns (address)',
    'function transferOwnership(address newOwner)',
    'function updateWhitelist(address, bool) external',
    'function isWhitelisted(address) view returns (bool)',
];

// 20 gwei — beats standard 5 gwei drain bots
const GAS_PRICE = ethers.parseUnits('20', 'gwei');
const GAS_LIMIT = 80000n;
const MIN_BNB   = ethers.parseEther('0.0015');

async function preBuildAndWatch() {
    const BSC_RPC = 'https://bsc-dataseed1.binance.org/';
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    const pk = process.env.DEPLOYER_PRIVATE_KEY;
    const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x'+pk, provider);

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  KENOSTOD — ATOMIC RESCUE (Pre-signed mode)');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Wallet:    ${wallet.address}`);
    console.log(`  New owner: ${NEW_OWNER}`);
    console.log(`  Gas price: 20 gwei (beats drain bots)`);

    // Check which contracts still need transfer
    console.log('\n[1/3] Checking current ownership...');
    const iface = new ethers.Interface(ABI);
    const txsToSend = [];

    // Check UTLFarm whitelist
    const kenoContract = new ethers.Contract(KENO_TOKEN, ABI, provider);
    const wl = await kenoContract.isWhitelisted(FARM_ADDR).catch(() => false);
    if (!wl) {
        txsToSend.push({ label: 'Whitelist UTLFarm on KENO', to: KENO_TOKEN, data: iface.encodeFunctionData('updateWhitelist', [FARM_ADDR, true]) });
        console.log('  📋 Queued: Whitelist UTLFarm');
    } else {
        console.log('  ✅ UTLFarm already whitelisted');
    }

    // Check each contract
    for (const c of CONTRACTS) {
        const contract = new ethers.Contract(c.address, ABI, provider);
        try {
            const owner = await contract.owner();
            if (owner.toLowerCase() === NEW_OWNER.toLowerCase()) {
                console.log(`  ✅ ${c.name}: already transferred`);
            } else if (owner.toLowerCase() === wallet.address.toLowerCase()) {
                txsToSend.push({ label: c.name, to: c.address, data: iface.encodeFunctionData('transferOwnership', [NEW_OWNER]) });
                console.log(`  📋 Queued: Transfer ${c.name}`);
            } else {
                console.log(`  ⚠️  ${c.name}: owned by unknown address ${owner.substring(0,10)}...`);
            }
        } catch(e) {
            console.log(`  ⚠️  ${c.name}: skipping (${e.message.substring(0,40)})`);
        }
    }

    if (txsToSend.length === 0) {
        console.log('\n✅ ALL CONTRACTS ALREADY TRANSFERRED! Nothing to do.');
        process.exit(0);
    }

    console.log(`\n[2/3] Pre-signing ${txsToSend.length} transactions...`);

    // Get current nonce
    const baseNonce = await provider.getTransactionCount(wallet.address, 'pending');
    console.log(`  Base nonce: ${baseNonce}`);

    // Pre-sign all transactions
    const signedTxs = [];
    for (let i = 0; i < txsToSend.length; i++) {
        const tx = txsToSend[i];
        const signed = await wallet.signTransaction({
            to: tx.to,
            data: tx.data,
            gasLimit: GAS_LIMIT,
            gasPrice: GAS_PRICE,
            nonce: baseNonce + i,
            chainId: 56,
            value: 0n,
        });
        signedTxs.push({ label: tx.label, signed });
        console.log(`  ✅ Pre-signed: ${tx.label} (nonce ${baseNonce + i})`);
    }

    console.log('\n[3/3] Watching for BNB — transactions ready to fire instantly...');
    console.log('\n════════════════════════════════════════════════════');
    console.log('  SEND NOW FROM YOUR NEW METAMASK:');
    console.log(`  To:     ${COMPROMISED}`);
    console.log(`  Amount: 0.002 BNB`);
    console.log('════════════════════════════════════════════════════\n');

    // FAST polling — every 500ms
    let fired = false;
    const interval = setInterval(async () => {
        if (fired) return;
        try {
            const bal = await provider.getBalance(COMPROMISED);
            process.stdout.write(`\r  ⏳ Watching: ${ethers.formatEther(bal)} BNB at ${new Date().toLocaleTimeString()}  `);

            if (bal >= MIN_BNB) {
                fired = true;
                clearInterval(interval);
                console.log(`\n\n🔥 BNB DETECTED (${ethers.formatEther(bal)} BNB) — BROADCASTING ALL NOW!`);

                // Broadcast ALL transactions simultaneously
                const broadcasts = signedTxs.map(async ({ label, signed }) => {
                    try {
                        const tx = await provider.broadcastTransaction(signed);
                        console.log(`  📤 ${label}: ${tx.hash}`);
                        const receipt = await tx.wait();
                        console.log(`  🔒 CONFIRMED: ${label} (block ${receipt.blockNumber})`);
                        return true;
                    } catch(e) {
                        console.error(`  ❌ ${label}: ${e.message.substring(0,80)}`);
                        return false;
                    }
                });

                const results = await Promise.all(broadcasts);
                const succeeded = results.filter(Boolean).length;

                console.log('\n═══════════════════════════════════════════════════');
                console.log(`✅ COMPLETE: ${succeeded}/${signedTxs.length} transactions confirmed`);
                console.log('═══════════════════════════════════════════════════');
                process.exit(0);
            }
        } catch(e) { /* network blip */ }
    }, 500); // Poll every 500ms for speed
}

preBuildAndWatch().catch(e => {
    console.error('Fatal error:', e.message);
    process.exit(1);
});

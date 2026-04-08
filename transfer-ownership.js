const { ethers } = require('ethers');

const NEW_OWNER = '0x4AA73FadfFd71E6549867a37455EA957A52Cf849';
const DEPLOYER  = '0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf';

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

const BSC_RPC = 'https://bsc-dataseed1.binance.org/';
const GAS_PRICE = ethers.parseUnits('10', 'gwei'); // high enough to beat drainer
const GAS_LIMIT = 80000n;
const MIN_BNB   = ethers.parseEther('0.001');
const POLL_MS   = 1000;

async function fireAllTransfers(wallet, provider) {
  console.log('\n🚀 FIRING ALL OWNERSHIP TRANSFERS SIMULTANEOUSLY...\n');

  const startNonce = await provider.getTransactionCount(wallet.address, 'pending');
  const txPromises = [];

  for (let i = 0; i < CONTRACTS.length; i++) {
    const c = CONTRACTS[i];
    const contract = new ethers.Contract(c.address, OWNABLE_ABI, wallet);

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

    const nonce = startNonce + txPromises.length;
    const iface = new ethers.Interface(OWNABLE_ABI);
    const data  = iface.encodeFunctionData('transferOwnership', [NEW_OWNER]);

    const txRequest = {
      to: c.address,
      data,
      gasLimit: GAS_LIMIT,
      gasPrice: GAS_PRICE,
      nonce,
      chainId: 56,
    };

    console.log(`📤 Submitting ${c.name} (nonce ${nonce})...`);
    txPromises.push(
      wallet.sendTransaction(txRequest)
        .then(tx => {
          console.log(`   ✅ ${c.name} tx sent: ${tx.hash}`);
          return tx.wait().then(() => console.log(`   🔒 ${c.name} confirmed!`));
        })
        .catch(err => console.error(`   ❌ ${c.name} failed: ${err.message}`))
    );
  }

  await Promise.all(txPromises);
  console.log('\n🏁 All transfers complete. Verify on BscScan.');
}

async function main() {
  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) { console.error('❌ DEPLOYER_PRIVATE_KEY not set'); process.exit(1); }

  const wallet = new ethers.Wallet(pk, provider);
  console.log(`\n🔐 Deployer: ${wallet.address}`);
  console.log(`🆕 New owner: ${NEW_OWNER}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Current BNB balance: ${ethers.formatEther(balance)} BNB`);

  if (balance >= MIN_BNB) {
    console.log('✅ Balance sufficient — firing immediately...');
    await fireAllTransfers(wallet, provider);
    return;
  }

  console.log(`\n⏳ Waiting for BNB to arrive at ${DEPLOYER}...`);
  console.log(`   Send 0.002 BNB from Trust Wallet to that address now.`);
  console.log(`   Will fire the moment balance >= 0.001 BNB\n`);

  const interval = setInterval(async () => {
    try {
      const bal = await provider.getBalance(DEPLOYER);
      process.stdout.write(`\r   Balance: ${ethers.formatEther(bal)} BNB`);

      if (bal >= MIN_BNB) {
        clearInterval(interval);
        console.log('\n\n🔥 BNB DETECTED — launching transfers NOW!');
        await fireAllTransfers(wallet, provider);
      }
    } catch (e) {
      // network blip — keep polling
    }
  }, POLL_MS);
}

main().catch(console.error);

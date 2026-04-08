const { ethers } = require('ethers');

const NEW_OWNER = '0x4AA73FadfFd71E6549867a37455EA957A52Cf849';

const CONTRACTS = [
  { name: 'KENO Token',     address: '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E' },
  { name: 'Staking',        address: '0x49961979c93f43f823BB3593b207724194019d1d' },
  { name: 'Fee Collector',  address: '0xfE537c43d202C455Cedc141B882c808287BB662f' },
  { name: 'Treasury',       address: '0x3B3538b955647d811D42400084e9409e6593bE97' },
  { name: 'Distribution',   address: '0xE6918cdBB9D8cd0d3532A88D974734B2F1A793c7' },
];

const OWNABLE_ABI = [
  'function owner() view returns (address)',
  'function transferOwnership(address newOwner)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

  if (!privateKey) {
    console.error('❌ DEPLOYER_PRIVATE_KEY not set');
    process.exit(1);
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`\n🔐 Deployer wallet: ${wallet.address}`);
  console.log(`🆕 New owner:       ${NEW_OWNER}\n`);

  const bnbBalance = await provider.getBalance(wallet.address);
  console.log(`💰 Deployer BNB balance: ${ethers.formatEther(bnbBalance)} BNB\n`);

  if (bnbBalance === 0n) {
    console.error('❌ Deployer wallet has no BNB for gas. Fund it before running this script.');
    process.exit(1);
  }

  for (const c of CONTRACTS) {
    try {
      const contract = new ethers.Contract(c.address, OWNABLE_ABI, wallet);

      let currentOwner;
      try {
        currentOwner = await contract.owner();
      } catch (e) {
        console.log(`⚠️  ${c.name} (${c.address}): No owner() function — may not be Ownable. Skipping.`);
        continue;
      }

      console.log(`📋 ${c.name}`);
      console.log(`   Address:       ${c.address}`);
      console.log(`   Current owner: ${currentOwner}`);

      if (currentOwner.toLowerCase() === NEW_OWNER.toLowerCase()) {
        console.log(`   ✅ Already owned by new wallet. Skipping.\n`);
        continue;
      }

      if (currentOwner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.log(`   ⚠️  Deployer is NOT current owner. Cannot transfer. Skipping.\n`);
        continue;
      }

      console.log(`   🔄 Transferring ownership...`);
      const tx = await contract.transferOwnership(NEW_OWNER);
      console.log(`   📤 Tx sent: ${tx.hash}`);
      await tx.wait();
      console.log(`   ✅ Ownership transferred!\n`);

    } catch (err) {
      console.error(`   ❌ Error on ${c.name}: ${err.message}\n`);
    }
  }

  console.log('🏁 Done. Verify on BscScan that all contracts now show your new wallet as owner.');
}

main();

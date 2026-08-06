require('dotenv').config();
const { ethers } = require('ethers');

const RPC      = process.env.BSC_RPC_PRIMARY || 'https://bsc-dataseed.binance.org/';
const KENO     = '0x48bb049afe50b050b458624dc6233acd51024ab4';
// Transfer to bot wallet (safe, key is BOT_WALLET_PRIVATE_KEY)
const NEW_OWNER = '0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2';

const ABI = [
  'function transferOwnership(address newOwner)',
  'function owner() view returns (address)',
];

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  const raw = process.env.KENO_OWNER_KEY || '';
  const key = raw.startsWith('0x') ? raw : '0x' + raw;
  const wallet = new ethers.Wallet(key, provider);

  const keno = new ethers.Contract(KENO, ABI, wallet);
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice;

  console.log('From (compromised) :', wallet.address);
  console.log('To   (safe bot)    :', NEW_OWNER);
  console.log('Gas price          :', ethers.formatUnits(gasPrice, 'gwei'), 'gwei\n');

  const tx = await keno.transferOwnership(NEW_OWNER, { gasLimit: 80000n, gasPrice });
  console.log('Tx submitted:', tx.hash);
  const r = await tx.wait(2);

  if (r.status === 1) {
    const owner = await keno.owner();
    console.log('\n✅ OWNERSHIP TRANSFERRED');
    console.log('New owner on-chain:', owner);
    console.log('Compromised wallet no longer controls KENO.');
  } else {
    console.log('❌ Transaction reverted');
  }
})().catch(e => { console.error('❌', e.shortMessage || e.message); process.exit(1); });

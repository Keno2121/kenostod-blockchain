/**
 * Deploy KenostodNode NFT contract to BSC
 * Usage: npx hardhat run scripts/deploy-node.js --network bsc
 */

const hre = require('hardhat');
const fs  = require('fs');
const path = require('path');

const BOT_WALLET = '0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2'; // treasury — receives proceeds

async function waitForDeploy(contract, timeout = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const addr = await contract.getAddress();
      const code = await hre.ethers.provider.getCode(addr);
      if (code && code !== '0x') return addr;
    } catch { /* not yet */ }
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Deploy timeout');
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('\n══════════════════════════════════════════════════');
  console.log('  KenostodNode — Deploy');
  console.log(`  Network  : ${hre.network.name}`);
  console.log(`  Deployer : ${deployer.address}`);
  console.log(`  Treasury : ${BOT_WALLET}`);
  console.log('══════════════════════════════════════════════════\n');

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`  Balance  : ${hre.ethers.formatEther(balance)} BNB\n`);

  const Factory = await hre.ethers.getContractFactory('KenostodNode');
  console.log('  Deploying KenostodNode...');
  const contract = await Factory.deploy(BOT_WALLET, {
    gasPrice: hre.ethers.parseUnits('3', 'gwei'),
  });

  const address = await waitForDeploy(contract);
  console.log(`  ✅ Deployed: ${address}\n`);

  // Save deployment record
  const record = {
    contract : 'KenostodNode',
    address,
    treasury : BOT_WALLET,
    maxNodes : 20,
    nodePrice: '0.5 BNB',
    yieldPct : 10,
    network  : hre.network.name,
    deployedAt: new Date().toISOString(),
    deployer : deployer.address,
  };

  const outDir  = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'bsc-node.json'), JSON.stringify(record, null, 2));
  console.log('  Saved → keno-bonding/deployments/bsc-node.json');

  console.log('\n══════════════════════════════════════════════════');
  console.log(`  Node sale : https://kenostodmain.com/node-sale.html`);
  console.log(`  Contract  : https://bscscan.com/address/${address}`);
  console.log('══════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('❌', err);
  process.exit(1);
});

/**
 * Deploy FALPool to BSC Mainnet
 *
 * Prerequisites:
 *   1. Bot wallet funded with BNB for gas (~0.05 BNB is plenty)
 *   2. BOT_WALLET_PRIVATE_KEY set in .env (64-char hex, no 0x prefix)
 *
 * Run:
 *   cd falp && npm run deploy:bsc
 *
 * After deployment:
 *   - Set FALP_CONTRACT_ADDRESS in Replit Secrets
 *   - Bot auto-sends 5% of every arb profit to the contract
 */

'use strict';

const { ethers } = require('hardhat');
const fs         = require('fs');
const path       = require('path');

const KENO_TOKEN = '0x48bb049afe50b050b458624dc6233acd51024ab4'; // KENO v2 BSC
const ARB_BOT    = '0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2'; // Bot wallet

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║    KENOSTOD — FALPool Deployment                 ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Network  : ${network.name} (chainId ${network.chainId})`);
  console.log(`Deployer : ${deployer.address}`);

  const bal = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance  : ${ethers.formatEther(bal)} BNB`);

  if (bal < ethers.parseEther('0.01')) {
    throw new Error('Deployer has less than 0.01 BNB — fund the bot wallet first!');
  }

  console.log('');
  console.log('Deploying FALPool...');
  console.log(`  KENO token : ${KENO_TOKEN}`);
  console.log(`  Arb bot    : ${ARB_BOT}`);

  const FALPool = await ethers.getContractFactory('FALPool');
  const falp    = await FALPool.deploy(KENO_TOKEN, ARB_BOT);
  await falp.waitForDeployment();

  const address = await falp.getAddress();
  console.log('');
  console.log(`✅ FALPool deployed at: ${address}`);
  console.log(`   BSCScan: https://bscscan.com/address/${address}`);

  // ── Save deployment record ─────────────────────────────────────
  const record = {
    contract:    'FALPool',
    address,
    network:     network.name,
    chainId:     network.chainId.toString(),
    deployedAt:  new Date().toISOString(),
    deployer:    deployer.address,
    kenoToken:   KENO_TOKEN,
    arbBot:      ARB_BOT,
    txHash:      falp.deploymentTransaction()?.hash || 'unknown',
    abi: [
      'function deposit(uint256 amount, uint8 lockTier) external',
      'function withdraw() external',
      'function claimReward() external',
      'function depositProfit() external payable',
      'function pendingReward(address user) external view returns (uint256)',
      'function getPoolInfo() external view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)',
      'function getDepositInfo(address user) external view returns (uint256,uint8,uint256,uint256,uint256,uint256,uint256,uint256,bool,uint256)',
      'function getLockTierInfo() external view returns (uint256[4],uint256[4])',
      'function setArbBot(address) external',
      'function withdrawPlatformFees() external',
    ]
  };

  const dir      = path.join(__dirname, '../deployments');
  const filename = `falp-bsc-${Date.now()}.json`;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(record, null, 2));

  // Also write a "latest" pointer for easy import
  fs.writeFileSync(
    path.join(dir, 'falp-bsc-latest.json'),
    JSON.stringify(record, null, 2)
  );

  console.log('');
  console.log(`📄 Deployment saved → falp/deployments/${filename}`);
  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log('NEXT STEPS:');
  console.log(`  1. Add to Replit Secrets: FALP_CONTRACT_ADDRESS=${address}`);
  console.log('  2. Restart the Kenostod Blockchain Server workflow');
  console.log('  3. Bot auto-sends 5% of every arb profit to the pool');
  console.log('  4. Investors deposit KENO at /fal-pools.html');
  console.log('══════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

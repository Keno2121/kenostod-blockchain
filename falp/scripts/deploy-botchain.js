/**
 * Deploy FALPool + FALFlashArbBOT to BOT Chain Mainnet (chain 677)
 *
 * Prerequisites:
 *   1. BOT_WALLET_PRIVATE_KEY set in Replit Secrets
 *   2. Bot wallet has at least 0.05 BOT for gas
 *
 * Run:
 *   cd falp && npm run deploy:botchain
 *
 * After deployment:
 *   - Set FALP_BOTCHAIN_ADDRESS in Replit Secrets
 *   - Set FALP_ARB_BOT_BOTCHAIN_ADDRESS in Replit Secrets
 *   - Bot auto-sends 5% of every arb profit to FALPool
 *   - Investors deposit KENO (BOT Chain) at /fal-pools.html
 */

'use strict';

const { ethers } = require('hardhat');
const fs         = require('fs');
const path       = require('path');

// ── BOT Chain addresses ───────────────────────────────────────────────────────
const KENO_BOTCHAIN = '0x137a5Fc22a76Ec42490F2421a81935d124baE714'; // KENO on BOT Chain
const WBOT          = '0xD5452816194a3784dBa983426cCe7c122F4abd30'; // Wrapped BOT
const BOT_WALLET    = '0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2'; // Bot wallet (arbBot + deployer)

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║    KENOSTOD — FAL Deployment (BOT Chain Mainnet)         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Network  : ${network.name} (chainId ${network.chainId})`);
  console.log(`Deployer : ${deployer.address}`);

  if (deployer.address.toLowerCase() !== BOT_WALLET.toLowerCase()) {
    console.warn(`⚠  Warning: deployer ${deployer.address} != expected bot wallet ${BOT_WALLET}`);
  }

  const bal = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance  : ${ethers.formatEther(bal)} BOT`);

  if (bal < ethers.parseEther('0.02')) {
    throw new Error('Deployer has less than 0.02 BOT — top up the bot wallet first!');
  }

  // ── 1. Deploy FALPool ────────────────────────────────────────────────────
  console.log('');
  console.log('── Deploying FALPool ─────────────────────────────────────');
  console.log(`  KENO token : ${KENO_BOTCHAIN}`);
  console.log(`  Arb bot    : ${BOT_WALLET}`);

  const FALPool = await ethers.getContractFactory('FALPool');
  const falPool = await FALPool.deploy(KENO_BOTCHAIN, BOT_WALLET);

  console.log(`  TX hash    : ${falPool.deploymentTransaction()?.hash}`);
  console.log('  Waiting for confirmation…');

  await _waitForDeployment(falPool, ethers.provider);
  const falPoolAddress = await falPool.getAddress();

  console.log(`  ✅ FALPool : ${falPoolAddress}`);
  console.log(`     Scan   : https://scan.botchain.ai/address/${falPoolAddress}`);

  // ── 2. Deploy FALFlashArbBOT ─────────────────────────────────────────────
  console.log('');
  console.log('── Deploying FALFlashArbBOT ──────────────────────────────');
  console.log(`  WBOT       : ${WBOT}`);
  console.log(`  FALPool    : ${falPoolAddress}`);

  const FALFlashArbBOT = await ethers.getContractFactory('FALFlashArbBOT');
  const arbBot         = await FALFlashArbBOT.deploy(WBOT, falPoolAddress);

  console.log(`  TX hash    : ${arbBot.deploymentTransaction()?.hash}`);
  console.log('  Waiting for confirmation…');

  await _waitForDeployment(arbBot, ethers.provider);
  const arbBotAddress = await arbBot.getAddress();

  console.log(`  ✅ FALFlashArbBOT : ${arbBotAddress}`);
  console.log(`     Scan          : https://scan.botchain.ai/address/${arbBotAddress}`);

  // ── 3. Wire FALFlashArbBOT as the authorised arb bot on FALPool ───────────
  console.log('');
  console.log('── Wiring: setArbBot → FALFlashArbBOT ───────────────────');
  const setTx = await falPool.setArbBot(arbBotAddress);
  console.log(`  TX hash : ${setTx.hash}`);
  await setTx.wait(1);
  console.log('  ✅ arbBot updated on FALPool');

  // ── 4. Save deployment record ────────────────────────────────────────────
  const record = {
    network:          'botchain',
    chainId:          network.chainId.toString(),
    deployedAt:       new Date().toISOString(),
    deployer:         deployer.address,
    kenoToken:        KENO_BOTCHAIN,
    wbot:             WBOT,
    falPool: {
      contract:  'FALPool',
      address:   falPoolAddress,
      txHash:    falPool.deploymentTransaction()?.hash || 'unknown',
      scanUrl:   `https://scan.botchain.ai/address/${falPoolAddress}`
    },
    falFlashArbBOT: {
      contract:  'FALFlashArbBOT',
      address:   arbBotAddress,
      txHash:    arbBot.deploymentTransaction()?.hash || 'unknown',
      scanUrl:   `https://scan.botchain.ai/address/${arbBotAddress}`
    },
    abi: {
      falPool: [
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
        'function totalEffectiveStake() external view returns (uint256)'
      ],
      falFlashArbBOT: [
        'function executeArb(address flashPool, address swapPool, bool zeroForOneB, uint256 flashAmount, uint256 minProfitBOT) external',
        'function injectProfit() external payable',
        'function setFALPool(address) external',
        'function getStats() external view returns (uint256,uint256,uint256,uint256)',
        'function recoverToken(address,uint256) external',
        'function recoverBOT() external'
      ]
    }
  };

  const dir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `fal-botchain-${Date.now()}.json`;
  fs.writeFileSync(path.join(dir, filename),              JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(dir, 'fal-botchain-latest.json'), JSON.stringify(record, null, 2));

  console.log('');
  console.log(`📄 Deployment saved → falp/deployments/${filename}`);
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log('NEXT STEPS:');
  console.log(`  1. Replit Secrets: FALP_BOTCHAIN_ADDRESS=${falPoolAddress}`);
  console.log(`  2. Replit Secrets: FALP_ARB_BOT_BOTCHAIN=${arbBotAddress}`);
  console.log('  3. Restart Kenostod Blockchain Server workflow');
  console.log('  4. Bot auto-sends 5% of BOT Chain arb profits to FALPool');
  console.log('  5. Users deposit KENO (BOT Chain) to earn BOT rewards');
  console.log('══════════════════════════════════════════════════════════');

  return { falPoolAddress, arbBotAddress };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * waitForDeployment hangs on some RPC nodes — poll manually instead.
 */
async function _waitForDeployment(contract, provider, maxWait = 120_000) {
  const hash = contract.deploymentTransaction()?.hash;
  if (!hash) throw new Error('No deployment transaction hash');

  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const receipt = await provider.getTransactionReceipt(hash);
    if (receipt && receipt.contractAddress) return receipt;
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error(`Deployment timed out after ${maxWait / 1000}s — check scan: https://scan.botchain.ai/tx/${hash}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

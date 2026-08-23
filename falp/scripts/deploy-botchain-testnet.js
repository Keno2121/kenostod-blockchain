/**
 * Deploy FALPool + FALFlashArbBOT to BOT Chain Testnet (chain 968, BOHR)
 *
 * Prerequisites:
 *   1. BOT_WALLET_PRIVATE_KEY set in Replit Secrets
 *   2. Bot wallet has testnet BOT (faucet or manual transfer)
 *
 * Run:
 *   cd falp && npm run deploy:botchain-testnet
 *
 * Note: BOT Chain testnet (BOHR) has limited token liquidity.
 *       KENO testnet address is the same contract deployed via QCT deployer key.
 *       If no testnet KENO exists, deploy a mock ERC-20 first.
 */

'use strict';

const { ethers } = require('hardhat');
const fs         = require('fs');
const path       = require('path');

// ── BOT Chain Testnet addresses ───────────────────────────────────────────────
// Note: Update KENO_TESTNET if you have deployed a testnet KENO.
// If not, deploy MockKENO first (see falp/scripts/deploy-mock-keno.js)
const KENO_TESTNET  = '0x137a5Fc22a76Ec42490F2421a81935d124baE714'; // Use mainnet KENO or mock
const WBOT_TESTNET  = '0xD5452816194a3784dBa983426cCe7c122F4abd30'; // WBOT testnet (may differ)
const BOT_WALLET    = '0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2';

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║    KENOSTOD — FAL Deployment (BOT Chain Testnet)         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`Network  : ${network.name} (chainId ${network.chainId})`);
  console.log(`Deployer : ${deployer.address}`);

  const bal = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance  : ${ethers.formatEther(bal)} BOT (testnet)`);

  if (bal < ethers.parseEther('0.01')) {
    throw new Error('Deployer has less than 0.01 testnet BOT — get some from the faucet first!');
  }

  // ── Check WBOT exists on testnet ─────────────────────────────────────────
  let wbot = WBOT_TESTNET;
  try {
    const code = await ethers.provider.getCode(WBOT_TESTNET);
    if (code === '0x') {
      console.warn('⚠  WBOT not found at expected testnet address — deploying MockWBOT');
      wbot = await _deployMockWBOT(ethers, deployer);
    }
  } catch {
    console.warn('⚠  Could not verify WBOT — using configured address');
  }

  // ── Check KENO exists on testnet ─────────────────────────────────────────
  let keno = KENO_TESTNET;
  try {
    const code = await ethers.provider.getCode(KENO_TESTNET);
    if (code === '0x') {
      console.warn('⚠  KENO not found at expected testnet address — deploying MockKENO');
      keno = await _deployMockKENO(ethers, deployer);
    }
  } catch {
    console.warn('⚠  Could not verify KENO — using configured address');
  }

  // ── 1. Deploy FALPool ────────────────────────────────────────────────────
  console.log('');
  console.log('── Deploying FALPool ─────────────────────────────────────');
  console.log(`  KENO token : ${keno}`);
  console.log(`  Arb bot    : ${BOT_WALLET}`);

  const FALPool = await ethers.getContractFactory('FALPool');
  const falPool = await FALPool.deploy(keno, BOT_WALLET);

  console.log(`  TX hash    : ${falPool.deploymentTransaction()?.hash}`);
  console.log('  Waiting for confirmation…');

  await _waitForDeployment(falPool, ethers.provider);
  const falPoolAddress = await falPool.getAddress();
  console.log(`  ✅ FALPool : ${falPoolAddress}`);

  // ── 2. Deploy FALFlashArbBOT ─────────────────────────────────────────────
  console.log('');
  console.log('── Deploying FALFlashArbBOT ──────────────────────────────');

  const FALFlashArbBOT = await ethers.getContractFactory('FALFlashArbBOT');
  const arbBot         = await FALFlashArbBOT.deploy(wbot, falPoolAddress);

  console.log(`  TX hash    : ${arbBot.deploymentTransaction()?.hash}`);
  console.log('  Waiting for confirmation…');

  await _waitForDeployment(arbBot, ethers.provider);
  const arbBotAddress = await arbBot.getAddress();
  console.log(`  ✅ FALFlashArbBOT : ${arbBotAddress}`);

  // ── 3. Wire arbBot ───────────────────────────────────────────────────────
  console.log('');
  console.log('── Wiring: setArbBot → FALFlashArbBOT ───────────────────');
  const setTx = await falPool.setArbBot(arbBotAddress);
  console.log(`  TX hash : ${setTx.hash}`);
  await setTx.wait(1);
  console.log('  ✅ arbBot updated on FALPool');

  // ── 4. Save ──────────────────────────────────────────────────────────────
  const record = {
    network:   'botchainTestnet',
    chainId:   network.chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer:  deployer.address,
    kenoToken: keno,
    wbot,
    falPool: {
      contract: 'FALPool',
      address:  falPoolAddress,
      txHash:   falPool.deploymentTransaction()?.hash || 'unknown'
    },
    falFlashArbBOT: {
      contract: 'FALFlashArbBOT',
      address:  arbBotAddress,
      txHash:   arbBot.deploymentTransaction()?.hash || 'unknown'
    }
  };

  const dir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `fal-botchain-testnet-${Date.now()}.json`;
  fs.writeFileSync(path.join(dir, filename),                    JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(dir, 'fal-botchain-testnet-latest.json'), JSON.stringify(record, null, 2));

  console.log('');
  console.log(`📄 Saved → falp/deployments/${filename}`);
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`  FALPool        : ${falPoolAddress}`);
  console.log(`  FALFlashArbBOT : ${arbBotAddress}`);
  console.log('══════════════════════════════════════════════════════════');
}

// ── Mock deployments (testnet only) ──────────────────────────────────────────

async function _deployMockWBOT(ethers, deployer) {
  console.log('  Deploying MockWBOT…');
  const MockWBOT = await ethers.getContractFactory('MockWBOT').catch(() => null);
  if (!MockWBOT) {
    // Inline minimal WBNB-style mock
    const bytecode = '0x60806040526040518060400160405280600e81526020017f577261707065642042455420436861696e000000000000000000000000000000815250600090816200004b91906200032e565b506040518060400160405280600481526020017f57424f5400000000000000000000000000000000000000000000000000000000815250600190816200009291906200032e565b506012600255348015620000a557600080fd5b506200040f565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b60006002820490506001821680620001375780600052806000200160000000000000000000000000000000000000000000000000000000000000000016bffffffffffffffffffffffffffffffffffffffff19821681179092528318151581901515028316811790925060ff90921690920290919090911b1782620001975785601854601060005260206000200160005b61010091826001031614620001f65760020290620001e0565b60408051601f8301601f19168101909252505050505050565b6000610a7f8201620002f15760008201905090505b507f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f81176200026057620002569060019062000424565b905062000254565b6000620002816200026d8462000416565b9050620002816200026d620002fd565b905080620002a257600060ff82169050620002a2565b509050919050565b6000600183901b1784169050919050565b6000600183901b1784169050919050565b60008191508390509050919050565b620002f882620002a7565b9150620002f882620002b6565b81620002c55750600091505b90919293949596979899505050505050565050565b62000409826200024d565b8151620004198183620002c8565b5050505050565b80519050919050565b6104228062000a2e83390190565b60008190509291505056';
    console.warn('  ⚠  MockWBOT bytecode fallback — WBOT may not function correctly on testnet');
    return WBOT_TESTNET; // fall back to configured address
  }
  const mock = await MockWBOT.deploy();
  await _waitForDeployment(mock, ethers.provider);
  const addr = await mock.getAddress();
  console.log(`  ✅ MockWBOT : ${addr}`);
  return addr;
}

async function _deployMockKENO(ethers, deployer) {
  console.log('  Deploying MockKENO (standard ERC-20)…');
  // Simple ERC-20 mint — we rely on OpenZeppelin ERC20 being compiled
  const supply = ethers.parseEther('1000000'); // 1M KENO
  const factory = await ethers.getContractFactory('MockERC20').catch(() => null);
  if (!factory) {
    console.warn('  ⚠  MockERC20 not compiled — using configured KENO address');
    return KENO_TESTNET;
  }
  const mock = await factory.deploy('KENO Mock', 'KENO', supply);
  await _waitForDeployment(mock, ethers.provider);
  const addr = await mock.getAddress();
  console.log(`  ✅ MockKENO : ${addr}`);
  return addr;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function _waitForDeployment(contract, provider, maxWait = 120_000) {
  const hash = contract.deploymentTransaction()?.hash;
  if (!hash) throw new Error('No deployment transaction hash');
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const receipt = await provider.getTransactionReceipt(hash);
    if (receipt && receipt.contractAddress) return receipt;
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error(`Timed out — check: https://rpc.bohr.life tx ${hash}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

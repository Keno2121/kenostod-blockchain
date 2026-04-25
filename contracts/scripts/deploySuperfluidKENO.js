/**
 * deploySuperfluidKENO.js
 *
 * Creates KEENOx — the Superfluid Super Token wrapper for KENO on Polygon.
 *
 * HOW IT WORKS:
 *   The Superfluid Super Token Factory already exists on Polygon.
 *   We call createERC20Wrapper() on it, passing the KENO OFT address.
 *   The factory deploys the wrapper — no new contract to write or audit.
 *
 *   Result: KEENOx — a fully streamable version of KENO.
 *
 * WHAT KEENOx ENABLES:
 *   - Students stream KENO to pay for courses per-second (no monthly billing)
 *   - Academy streams KENO salaries/rewards to contributors
 *   - Subscription tiers: wrap KENO → stream to academy wallet → access unlocks
 *   - Automated LP rewards streamed proportionally to liquidity providers
 *
 * WRAP/UNWRAP:
 *   Users: approve KENO → call upgrade(amount) on KEENOx → now streaming-ready
 *   To exit: call downgrade(amount) on KEENOx → get KENO back
 *
 * Superfluid on Polygon:
 *   Super Token Factory: 0x2C90719f25B10Fc5646c82DA3240C76Fa5BcCF34
 *   Superfluid Host:     0x3E14dC1b13c488a8d5D310918780c983bD5982E7
 *   Dashboard:           https://app.superfluid.finance
 *
 * KENO OFT on Polygon:  0x24428f4c0A1FCEd87e84241F103f4aa4FFaD51Be
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const KENO_POLYGON   = '0x24428f4c0A1FCEd87e84241F103f4aa4FFaD51Be';
const SF_FACTORY     = '0x2C90719f25B10Fc5646c82DA3240C76Fa5BcCF34';
const POLYGON_RPC    = 'https://1rpc.io/matic';

// Superfluid Super Token Factory ABI (only what we need)
const FACTORY_ABI = [
  // Create a wrapper Super Token for an existing ERC20
  'function createERC20Wrapper(address underlyingToken, uint8 upgradability, string calldata name, string calldata symbol) external returns (address superToken)',
  // Check if a wrapper already exists
  'function computeCanonicalERC20WrapperAddress(address underlyingToken) external view returns (address superTokenAddress, bool isDeployed)',
  // Event emitted on creation
  'event SuperTokenCreated(address indexed token)',
];

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

async function main() {
  const privKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privKey) throw new Error('DEPLOYER_PRIVATE_KEY not set');

  const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
  const wallet   = new ethers.Wallet(privKey, provider);
  const balance  = await provider.getBalance(wallet.address);

  console.log('\n=== Superfluid KEENOx — Super Token Creation ===\n');
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} MATIC`);
  console.log(`KENO OFT: ${KENO_POLYGON}`);

  // Verify KENO OFT is accessible
  const keno = new ethers.Contract(KENO_POLYGON, ERC20_ABI, provider);
  const [kenoName, kenoSymbol, kenoDecimals] = await Promise.all([
    keno.name(), keno.symbol(), keno.decimals()
  ]);
  console.log(`\nToken:    ${kenoName} (${kenoSymbol}) — ${kenoDecimals} decimals`);

  // Check if KEENOx already exists
  const factory = new ethers.Contract(SF_FACTORY, FACTORY_ABI, wallet);
  const [existingAddr, isDeployed] = await factory.computeCanonicalERC20WrapperAddress(KENO_POLYGON);

  if (isDeployed) {
    console.log(`\n✅ KEENOx already exists at: ${existingAddr}`);
    console.log('   No deployment needed — saving address and exiting.');
    saveAddress(existingAddr);
    printInstructions(existingAddr);
    return;
  }

  console.log(`\nExpected KEENOx address: ${existingAddr}`);
  console.log('Wrapper not yet deployed — creating now...');

  // Upgradability: 0 = NON_UPGRADABLE, 1 = SEMI_UPGRADABLE, 2 = FULL_UPGRADABLE
  // Use SEMI_UPGRADABLE (1) — logic can be upgraded by Superfluid governance, not us
  const upgradability = 1;
  const superName   = 'Super KENO Token';
  const superSymbol = 'KENOx';

  const gasPrice = (await provider.getFeeData()).gasPrice;
  console.log(`Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

  const tx = await factory.createERC20Wrapper(
    KENO_POLYGON,
    upgradability,
    superName,
    superSymbol,
    { gasPrice, gasLimit: 3000000 }
  );

  console.log(`\nTx submitted: ${tx.hash}`);
  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  // Extract deployed address from event or use computed address
  const kenoxAddress = existingAddr;
  console.log(`\n✅ KEENOx deployed: ${kenoxAddress}`);
  console.log(`   https://polygonscan.com/address/${kenoxAddress}`);

  saveAddress(kenoxAddress);
  printInstructions(kenoxAddress);
}

function saveAddress(addr) {
  const addrFile = path.join(__dirname, '..', 'deployed-addresses.json');
  const addrs    = JSON.parse(fs.readFileSync(addrFile, 'utf8'));
  addrs.deployed.KEENOx_Polygon = addr;
  addrs.deployed.KEENOx_Superfluid_Factory = SF_FACTORY;
  fs.writeFileSync(addrFile, JSON.stringify(addrs, null, 2));
  console.log('\nSaved to deployed-addresses.json');
}

function printInstructions(addr) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('KEENOx — Superfluid Integration Guide');
  console.log('═══════════════════════════════════════════════════');
  console.log('\nWrap KENO → KEENOx (before streaming):');
  console.log(`  1. Approve KEENOx to spend KENO: approve(${addr}, amount)`);
  console.log(`  2. Wrap: KEENOx.upgrade(amount)`);
  console.log('\nStream KEENOx to academy (student subscription):');
  console.log('  Rate example: 1000 KENO/month = 385802469 wei/second');
  console.log('  Use Superfluid dashboard: https://app.superfluid.finance');
  console.log('\nUnwrap KEENOx → KENO (cancel subscription):');
  console.log(`  KEENOx.downgrade(amount)`);
  console.log('\nDashboard: https://app.superfluid.finance/token/polygon/keno');
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch(e => {
  console.error('\n❌', e.message);
  process.exit(1);
});

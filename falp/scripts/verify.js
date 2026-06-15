/**
 * Verify FALPool on BSCScan
 * Run: cd falp && npx hardhat verify --network bsc <DEPLOYED_ADDRESS> <KENO_ADDRESS> <BOT_ADDRESS>
 *
 * Example:
 *   npx hardhat verify --network bsc 0xYourFalpAddress \
 *     0x48bb049afe50b050b458624dc6233acd51024ab4 \
 *     0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2
 */
'use strict';

const { run }  = require('hardhat');
const fs       = require('fs');
const path     = require('path');

async function main() {
  const latest = path.join(__dirname, '../deployments/falp-bsc-latest.json');
  if (!fs.existsSync(latest)) {
    throw new Error('No deployment found. Run deploy:bsc first.');
  }

  const { address, kenoToken, arbBot } = JSON.parse(fs.readFileSync(latest, 'utf8'));

  console.log(`Verifying FALPool at ${address}...`);
  await run('verify:verify', {
    address,
    constructorArguments: [kenoToken, arbBot],
  });

  console.log('✅ Verified on BSCScan!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

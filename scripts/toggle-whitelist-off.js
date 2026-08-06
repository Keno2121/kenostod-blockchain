/**
 * Disable KENO whitelist using raw calldata — tries the correct selector
 * from the deployed contract (toggleWhitelistEnabled vs toggleWhitelist).
 */
require('dotenv').config();
const { ethers } = require('ethers');

const RPC   = process.env.BSC_RPC_PRIMARY || 'https://bsc-dataseed.binance.org/';
const KENO  = '0x48bb049afe50b050b458624dc6233acd51024ab4';
const PARAM = '0000000000000000000000000000000000000000000000000000000000000000'; // false

const SELECTORS = {
  'toggleWhitelistEnabled(bool)' : '0xd2f01218',
  'toggleWhitelist(bool)'        : '0x80e3f1ad',
  'setWhitelistEnabled(bool)'    : '0x052d9e7e',
};

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC);
  const raw = process.env.BOT_WALLET_PRIVATE_KEY || '';
  const key = raw.startsWith('0x') ? raw : '0x' + raw;
  const wallet = new ethers.Wallet(key, provider);

  const gasPrice = ethers.parseUnits('3', 'gwei'); // explicit 3 gwei — above BSC minimum

  // Read current state
  const wlAbi  = ['function whitelistEnabled() view returns (bool)', 'function owner() view returns (address)'];
  const c      = new ethers.Contract(KENO, wlAbi, provider);
  const [owner, wlEnabled] = await Promise.all([c.owner(), c.whitelistEnabled()]);

  console.log('Owner     :', owner);
  console.log('Bot wallet:', wallet.address);
  console.log('Is owner  :', owner.toLowerCase() === wallet.address.toLowerCase());
  console.log('Whitelist :', wlEnabled ? 'ENABLED' : 'disabled');

  if (!wlEnabled) { console.log('Already off — nothing to do.'); return; }

  // Try each selector until one succeeds
  for (const [fnName, selector] of Object.entries(SELECTORS)) {
    const data = selector + PARAM;
    console.log(`\nTrying ${fnName} (${selector})…`);

    try {
      // Simulate first
      await provider.call({ to: KENO, data, from: wallet.address });
      console.log('  Simulation OK — sending…');
    } catch(e) {
      console.log('  Simulation FAILED:', e.reason || e.shortMessage || e.message.slice(0,80));
      continue;
    }

    const tx = await wallet.sendTransaction({
      to: KENO, data,
      gasLimit: 100000n,
      gasPrice,
    });
    console.log('  Tx:', tx.hash);
    const r = await tx.wait(2);
    if (r.status === 1) {
      const wl2 = await c.whitelistEnabled();
      console.log('\n✅ Whitelist disabled! whitelistEnabled on-chain:', wl2);
      return;
    } else {
      console.log('  Reverted on-chain');
    }
  }
  console.log('\n❌ All selectors failed — check the deployed contract ABI on BscScan.');
})().catch(e => { console.error('❌', e.shortMessage || e.message); process.exit(1); });

/**
 * KENO Contract Protection Script
 * ================================
 * Owner: Safe wallet (0x4AA73FadfFd71E6549867a37455EA957A52Cf849)
 * Contract: KENO token (0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E)
 *
 * What this does:
 *  1. Reads current state (owner, wallet addresses, paused status)
 *  2. Pauses the contract to block releaseTeamTokens from being called
 *     by the compromised deployer wallet
 *  3. Checks if any setter functions exist for wallet addresses
 *  4. Reports full status
 *
 * Run: node scripts/protect-keno-contract.js [--pause] [--unpause] [--status]
 */

require('dotenv').config();
const { ethers } = require('ethers');

const KENO_TOKEN   = '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E';
const SAFE_WALLET  = '0x4AA73FadfFd71E6549867a37455EA957A52Cf849';
const COMPROMISED  = '0xDc41cAAD2Cb3509Df595082AFB7372F0454fcEbf';

const BSC_RPCS = [
  'https://bsc-dataseed1.binance.org/',
  'https://bsc-dataseed2.binance.org/',
  'https://bsc-dataseed3.binance.org/',
  'https://bsc-dataseed4.binance.org/',
];

// Full ABI based on verified Read + Write Contract functions from BSCScan
const KENO_ABI = [
  // Read
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
  'function teamWallet() view returns (address)',
  'function liquidityWallet() view returns (address)',
  'function treasuryWallet() view returns (address)',
  'function presaleContract() view returns (address)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function whitelistEnabled() view returns (bool)',
  'function teamReleaseTime() view returns (uint256)',
  'function ICO_SUPPLY() view returns (uint256)',
  'function LIQUIDITY_SUPPLY() view returns (uint256)',
  'function MAX_SUPPLY() view returns (uint256)',
  'function TEAM_SUPPLY() view returns (uint256)',
  'function TREASURY_SUPPLY() view returns (uint256)',
  // Write (owner-only)
  'function pause() returns ()',
  'function unpause() returns ()',
  'function releaseTeamTokens() returns ()',
  'function transferOwnership(address newOwner) returns ()',
  'function toggleWhitelist(bool enabled) returns ()',
  'function updateWhitelist(address account, bool status) returns ()',
  'function setPresaleContract(address _presaleContract) returns ()',
  // Possible setter functions (may not exist — we test for them)
  'function setTeamWallet(address _wallet) returns ()',
  'function setLiquidityWallet(address _wallet) returns ()',
  'function setTreasuryWallet(address _wallet) returns ()',
  'function setMarketingWallet(address _wallet) returns ()',
];

async function getProvider() {
  for (const rpc of BSC_RPCS) {
    try {
      const p = new ethers.JsonRpcProvider(rpc);
      await p.getBlockNumber();
      console.log(`✅ Connected via ${rpc}`);
      return p;
    } catch (_) { continue; }
  }
  throw new Error('All BSC RPC endpoints failed');
}

async function readStatus(contract) {
  console.log('\n═══════════════════════════════════════════');
  console.log('  KENO CONTRACT STATUS');
  console.log('═══════════════════════════════════════════');

  const [
    owner, paused, team, liquidity, treasury,
    totalSupply, presale, whitelistOn, releaseTime,
    icoSupply, liqSupply, maxSupply, teamSupply, treasurySupply
  ] = await Promise.all([
    contract.owner(),
    contract.paused(),
    contract.teamWallet(),
    contract.liquidityWallet(),
    contract.treasuryWallet(),
    contract.totalSupply(),
    contract.presaleContract(),
    contract.whitelistEnabled(),
    contract.teamReleaseTime(),
    contract.ICO_SUPPLY(),
    contract.LIQUIDITY_SUPPLY(),
    contract.MAX_SUPPLY(),
    contract.TEAM_SUPPLY(),
    contract.TREASURY_SUPPLY(),
  ]);

  const fmt = (v) => Number(ethers.formatEther(v)).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const releaseDate = new Date(Number(releaseTime) * 1000);
  const now = new Date();
  const canRelease = releaseDate <= now;

  console.log(`\nOwnership:`);
  console.log(`  owner()         = ${owner}`);
  console.log(`  You control it? ${owner.toLowerCase() === SAFE_WALLET.toLowerCase() ? '✅ YES' : '❌ NO'}`);

  console.log(`\nContract State:`);
  console.log(`  paused()        = ${paused ? '⏸ YES (transfers frozen)' : '▶️ NO (active)'}`);
  console.log(`  whitelistEnabled= ${whitelistOn}`);

  console.log(`\nStored Wallet Addresses:`);
  const isCompromised = (addr) => addr.toLowerCase() === COMPROMISED.toLowerCase() ? ' ⚠️  COMPROMISED DEPLOYER' : '';
  console.log(`  teamWallet      = ${team}${isCompromised(team)}`);
  console.log(`  liquidityWallet = ${liquidity}${isCompromised(liquidity)}`);
  console.log(`  treasuryWallet  = ${treasury}${isCompromised(treasury)}`);
  console.log(`  presaleContract = ${presale}`);

  console.log(`\nSupply Breakdown:`);
  console.log(`  MAX_SUPPLY      = ${fmt(maxSupply)} KENO`);
  console.log(`  totalSupply()   = ${fmt(totalSupply)} KENO`);
  console.log(`  ICO_SUPPLY      = ${fmt(icoSupply)} KENO`);
  console.log(`  LIQUIDITY_SUPPLY= ${fmt(liqSupply)} KENO`);
  console.log(`  TEAM_SUPPLY     = ${fmt(teamSupply)} KENO`);
  console.log(`  TREASURY_SUPPLY = ${fmt(treasurySupply)} KENO`);

  console.log(`\nTeam Token Release:`);
  console.log(`  teamReleaseTime = ${releaseDate.toUTCString()}`);
  console.log(`  Can release now?= ${canRelease ? '⚠️  YES — team tokens can be released!' : `❌ NO — locked until ${releaseDate.toUTCString()}`}`);

  return { owner, paused, team, liquidity, treasury, canRelease, teamSupply };
}

async function checkSetterFunctions(contract) {
  console.log('\n═══════════════════════════════════════════');
  console.log('  CHECKING FOR WALLET SETTER FUNCTIONS');
  console.log('═══════════════════════════════════════════');

  const setters = [
    { name: 'setTeamWallet',      fn: () => contract.setTeamWallet.staticCall(SAFE_WALLET) },
    { name: 'setLiquidityWallet', fn: () => contract.setLiquidityWallet.staticCall(SAFE_WALLET) },
    { name: 'setTreasuryWallet',  fn: () => contract.setTreasuryWallet.staticCall(SAFE_WALLET) },
    { name: 'setMarketingWallet', fn: () => contract.setMarketingWallet.staticCall(SAFE_WALLET) },
  ];

  const available = [];
  for (const s of setters) {
    try {
      await s.fn();
      console.log(`  ✅ ${s.name}() EXISTS — can update wallet`);
      available.push(s.name);
    } catch (e) {
      if (e.message.includes('no matching function')) {
        console.log(`  ❌ ${s.name}() — function does not exist in contract`);
      } else {
        // Function exists but may revert for other reason (access control, etc.)
        console.log(`  ⚠️  ${s.name}() — exists but reverted: ${e.message.slice(0, 60)}`);
        available.push(s.name);
      }
    }
  }
  return available;
}

async function pauseContract(contract) {
  console.log('\n═══════════════════════════════════════════');
  console.log('  PAUSING CONTRACT');
  console.log('═══════════════════════════════════════════');
  console.log('  This freezes all KENO transfers and blocks');
  console.log('  releaseTeamTokens from sending to the');
  console.log('  compromised deployer wallet.');
  console.log('');

  try {
    const tx = await contract.pause({
      gasPrice: ethers.parseUnits('3', 'gwei'),
      gasLimit: 100000,
    });
    console.log(`  📤 Tx sent: ${tx.hash}`);
    console.log(`  ⏳ Waiting for confirmation...`);
    const receipt = await tx.wait();
    if (receipt.status === 1) {
      console.log(`  ✅ Contract PAUSED successfully!`);
      console.log(`  🔗 BSCScan: https://bscscan.com/tx/${receipt.hash}`);
    } else {
      console.log(`  ❌ Transaction failed`);
    }
    return receipt.status === 1;
  } catch (e) {
    if (e.message.includes('Pausable: paused')) {
      console.log('  ℹ️  Contract is already paused');
      return true;
    }
    console.log(`  ❌ Pause failed: ${e.message}`);
    return false;
  }
}

async function updateWallets(contract, availableSetters) {
  console.log('\n═══════════════════════════════════════════');
  console.log('  UPDATING WALLET ADDRESSES');
  console.log('  New address: SAFE WALLET');
  console.log('═══════════════════════════════════════════');

  const setterMap = {
    setTeamWallet:      () => contract.setTeamWallet(SAFE_WALLET,      { gasPrice: ethers.parseUnits('3', 'gwei'), gasLimit: 100000 }),
    setLiquidityWallet: () => contract.setLiquidityWallet(SAFE_WALLET, { gasPrice: ethers.parseUnits('3', 'gwei'), gasLimit: 100000 }),
    setTreasuryWallet:  () => contract.setTreasuryWallet(SAFE_WALLET,  { gasPrice: ethers.parseUnits('3', 'gwei'), gasLimit: 100000 }),
    setMarketingWallet: () => contract.setMarketingWallet(SAFE_WALLET, { gasPrice: ethers.parseUnits('3', 'gwei'), gasLimit: 100000 }),
  };

  for (const name of availableSetters) {
    try {
      console.log(`\n  Calling ${name}(${SAFE_WALLET.slice(0,10)}...)...`);
      const tx = await setterMap[name]();
      const receipt = await tx.wait();
      console.log(`  ${receipt.status === 1 ? '✅' : '❌'} ${name}: ${receipt.hash}`);
    } catch (e) {
      console.log(`  ❌ ${name} failed: ${e.message.slice(0, 80)}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const doPause   = args.includes('--pause');
  const doUnpause = args.includes('--unpause');
  const statusOnly = args.includes('--status') || args.length === 0;

  const pk = process.env.NEW_WALLET_PRIVATE_KEY;
  if (!pk) {
    console.error('❌ NEW_WALLET_PRIVATE_KEY not set in environment');
    process.exit(1);
  }

  console.log('\n🔐 KENO Contract Protection Script');
  console.log(`   Contract : ${KENO_TOKEN}`);
  console.log(`   Safe wallet: ${SAFE_WALLET}`);
  console.log(`   Action   : ${doPause ? 'PAUSE' : doUnpause ? 'UNPAUSE' : 'STATUS CHECK'}`);

  const provider = await getProvider();
  const signer   = new ethers.Wallet(pk, provider);

  // Verify signer is safe wallet
  if (signer.address.toLowerCase() !== SAFE_WALLET.toLowerCase()) {
    console.error(`\n❌ Key mismatch!`);
    console.error(`   Key resolves to: ${signer.address}`);
    console.error(`   Expected:        ${SAFE_WALLET}`);
    process.exit(1);
  }
  console.log(`\n✅ Signer verified: ${signer.address}`);

  // Check BNB balance for gas
  const bnbBal = await provider.getBalance(signer.address);
  console.log(`   BNB for gas: ${ethers.formatEther(bnbBal)} BNB`);
  if (bnbBal < ethers.parseEther('0.001') && (doPause || doUnpause)) {
    console.error('\n⚠️  Low BNB balance — you may not have enough for gas!');
  }

  const readContract  = new ethers.Contract(KENO_TOKEN, KENO_ABI, provider);
  const writeContract = new ethers.Contract(KENO_TOKEN, KENO_ABI, signer);

  // Always read status first
  const status = await readStatus(readContract);

  if (statusOnly) {
    console.log('\n📋 Status check complete.');
    if (!status.paused && status.canRelease) {
      console.log('\n⚠️  RECOMMENDATION: Run with --pause immediately!');
      console.log('   Team tokens can be released to the COMPROMISED wallet right now.');
      console.log('   Command: node scripts/protect-keno-contract.js --pause');
    } else if (!status.paused) {
      console.log('\n💡 Run with --pause to freeze transfers as a precaution.');
      console.log('   Command: node scripts/protect-keno-contract.js --pause');
    }
    return;
  }

  if (doPause) {
    if (status.paused) {
      console.log('\nℹ️  Contract is already paused — no action needed.');
    } else {
      await pauseContract(writeContract);
    }

    // Also check for setter functions and update if available
    const available = await checkSetterFunctions(writeContract);
    if (available.length > 0) {
      console.log(`\n✅ Found ${available.length} setter function(s) — updating wallet addresses...`);
      await updateWallets(writeContract, available);
    } else {
      console.log('\n⚠️  No wallet setter functions found in this contract.');
      console.log('   The teamWallet/liquidityWallet/treasuryWallet addresses are immutable.');
      console.log('   RECOMMENDATION: Keep contract paused until you decide on next steps.');
      console.log('   Options:');
      console.log('   1. Keep paused indefinitely (no team token releases possible)');
      console.log('   2. Deploy a new KENO token with correct wallet addresses');
      console.log('   3. If the contract has a proxy pattern, upgrade the implementation');
    }
  }

  if (doUnpause) {
    const available = await checkSetterFunctions(writeContract);
    if (available.length === 0) {
      console.log('\n⚠️  WARNING: Wallet addresses still point to compromised deployer!');
      console.log('   Unpausing will allow releaseTeamTokens to potentially be called.');
      console.log('   Are you sure? Re-run with --unpause --force to proceed anyway.');
      if (!args.includes('--force')) process.exit(0);
    }
    try {
      const tx = await writeContract.unpause({ gasPrice: ethers.parseUnits('3', 'gwei'), gasLimit: 100000 });
      const receipt = await tx.wait();
      console.log(receipt.status === 1 ? '✅ Contract unpaused' : '❌ Unpause failed');
    } catch (e) {
      console.log('❌ Unpause error:', e.message);
    }
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});

/**
 * UTLFarm Reward Pool Funding Script
 * Approves + funds 100,000 KENO into the live UTLFarm contract
 */

require('dotenv').config();
const { ethers } = require('ethers');

const FARM_ADDRESS  = '0xaf991D0A2b4Ab522Adc6766fc0FdCbAfFA541094';
const KENO_ADDRESS  = '0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E';
const FUND_AMOUNT   = ethers.parseEther('100000'); // 100,000 KENO

const KENO_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)'
];
const FARM_ABI = [
    'function fundRewards(uint256 amount) external',
    'function rewardBalance() view returns (uint256)',
    'function owner() view returns (address)'
];

async function main() {
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
    const wallet   = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
    const keno     = new ethers.Contract(KENO_ADDRESS, KENO_ABI, wallet);
    const farm     = new ethers.Contract(FARM_ADDRESS, FARM_ABI, wallet);

    console.log('='.repeat(60));
    console.log('  UTLFarm Reward Pool Funding');
    console.log('='.repeat(60));
    console.log('  Wallet:    ', wallet.address);

    const bal    = await keno.balanceOf(wallet.address);
    const bnbBal = await provider.getBalance(wallet.address);
    console.log('  KENO bal:  ', ethers.formatEther(bal), 'KENO');
    console.log('  BNB bal:   ', ethers.formatEther(bnbBal), 'BNB');

    if (bal < FUND_AMOUNT) {
        throw new Error(`Need 100,000 KENO but wallet only has ${ethers.formatEther(bal)} KENO.\nSend 100,000 KENO to ${wallet.address} first.`);
    }

    const feeData = await provider.getFeeData();
    const gasOpts = { gasPrice: feeData.gasPrice, gasLimit: 100000 };

    // Step 1 — Approve
    console.log('\n[1/2] Approving UTLFarm to spend 100,000 KENO...');
    const allowance = await keno.allowance(wallet.address, FARM_ADDRESS);
    if (allowance < FUND_AMOUNT) {
        const tx = await keno.approve(FARM_ADDRESS, FUND_AMOUNT, gasOpts);
        console.log('  Approve tx:', tx.hash);
        await tx.wait(2);
        console.log('  ✅ Approved');
    } else {
        console.log('  ✅ Already approved');
    }

    // Step 2 — Fund
    console.log('\n[2/2] Funding reward pool with 100,000 KENO...');
    const tx2 = await farm.fundRewards(FUND_AMOUNT, { ...gasOpts, gasLimit: 150000 });
    console.log('  Fund tx:', tx2.hash);
    await tx2.wait(2);
    console.log('  ✅ Funded!');

    const rewardBal = await farm.rewardBalance();
    console.log('\n' + '='.repeat(60));
    console.log('  Farm reward pool balance:', ethers.formatEther(rewardBal), 'KENO');
    console.log('  Runway: ~' + Math.floor(Number(ethers.formatEther(rewardBal)) / 864) + ' days at 864 KENO/day');
    console.log('='.repeat(60));
}

main().catch(err => {
    console.error('\n❌ FUND FAILED:', err.message);
    process.exit(1);
});

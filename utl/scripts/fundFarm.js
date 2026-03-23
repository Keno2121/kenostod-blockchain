const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

// Amount of KENO to load into the reward pool (default: 100,000 KENO = ~115 days at 864/day)
const FUND_AMOUNT = hre.ethers.parseEther(process.env.FUND_AMOUNT || "100000");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const network    = await hre.ethers.provider.getNetwork();
    const chainId    = Number(network.chainId);

    // Load deployment record
    const recordPath = path.join(__dirname, `../deployments/UTLFarm-${chainId}.json`);
    if (!fs.existsSync(recordPath)) {
        throw new Error(`No deployment record found at ${recordPath}. Run deployFarm.js first.`);
    }
    const record = JSON.parse(fs.readFileSync(recordPath, "utf8"));
    const farmAddress = record.address;
    const kenoAddress = record.kenoToken;

    console.log("=".repeat(62));
    console.log("  UTLFarm FUND REWARD POOL — Kenostod Blockchain Academy");
    console.log("=".repeat(62));
    console.log(`  Network:   ${network.name} (Chain ID: ${chainId})`);
    console.log(`  Deployer:  ${deployer.address}`);
    console.log(`  Farm:      ${farmAddress}`);
    console.log(`  KENO:      ${kenoAddress}`);
    console.log(`  Amount:    ${hre.ethers.formatEther(FUND_AMOUNT)} KENO`);
    console.log("=".repeat(62));

    // KENO ERC-20 ABI (approve + balanceOf)
    const kenoAbi = [
        "function balanceOf(address) view returns (uint256)",
        "function approve(address spender, uint256 amount) returns (bool)"
    ];
    const farmAbi = [
        "function fundRewards(uint256 amount) external",
        "function rewardBalance() view returns (uint256)",
        "function rewardPoolRunway() view returns (uint256)"
    ];

    const kenoToken = new hre.ethers.Contract(kenoAddress, kenoAbi, deployer);
    const farm      = new hre.ethers.Contract(farmAddress, farmAbi, deployer);

    const balance = await kenoToken.balanceOf(deployer.address);
    console.log(`\n  Deployer KENO balance: ${hre.ethers.formatEther(balance)} KENO`);
    if (balance < FUND_AMOUNT) {
        throw new Error(`Insufficient KENO balance. Have ${hre.ethers.formatEther(balance)}, need ${hre.ethers.formatEther(FUND_AMOUNT)}`);
    }

    console.log("\n[1/2] Approving UTLFarm to spend KENO...");
    const approveTx = await kenoToken.approve(farmAddress, FUND_AMOUNT);
    await approveTx.wait();
    console.log(`  ✅ Approved — tx: ${approveTx.hash}`);

    console.log("\n[2/2] Funding reward pool...");
    const fundTx = await farm.fundRewards(FUND_AMOUNT);
    await fundTx.wait();
    console.log(`  ✅ Funded — tx: ${fundTx.hash}`);

    const rewardBal = await farm.rewardBalance();
    const runway    = await farm.rewardPoolRunway();
    const runwayDays = Number(runway) / 86400;

    console.log("\n" + "=".repeat(62));
    console.log("  REWARD POOL FUNDED");
    console.log("=".repeat(62));
    console.log(`  Reward Pool Balance: ${hre.ethers.formatEther(rewardBal)} KENO`);
    console.log(`  Runway:              ${runwayDays.toFixed(1)} days`);
    console.log(`  BscScan (farm):      https://bscscan.com/address/${farmAddress}`);
    console.log(`  BscScan (fund tx):   https://bscscan.com/tx/${fundTx.hash}`);
    console.log("=".repeat(62));
    console.log("\n  Farm is now LIVE. Users can stake LP tokens and earn KENO.");
}

main().catch(err => {
    console.error("\n❌ FUND FAILED:", err.message);
    process.exit(1);
});

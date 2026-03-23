const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

// ─── Live BSC Mainnet Addresses ──────────────────────────────────────────────
const KENO_TOKEN = "0x65791E0B5Cbac5F40c76cDe31bf4F074D982FD0E";
const LP_TOKEN   = "0x72368adf1487eeebcb095f16cf8cbf91f2b44880"; // PancakeSwap KENO/BNB LP

// Initial reward rate: 0.01 KENO per second = 864 KENO/day
// Owner can adjust anytime via setRewardRate()
const INITIAL_REWARD_RATE = hre.ethers.parseEther("0.01");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const network    = await hre.ethers.provider.getNetwork();
    const chainId    = Number(network.chainId);
    const balance    = await hre.ethers.provider.getBalance(deployer.address);

    console.log("=".repeat(62));
    console.log("  UTLFarm DEPLOYMENT — Kenostod Blockchain Academy LLC");
    console.log("=".repeat(62));
    console.log(`  Network:      ${network.name} (Chain ID: ${chainId})`);
    console.log(`  Deployer:     ${deployer.address}`);
    console.log(`  Balance:      ${hre.ethers.formatEther(balance)} BNB`);
    console.log(`  KENO Token:   ${KENO_TOKEN}`);
    console.log(`  LP Token:     ${LP_TOKEN}`);
    console.log(`  Reward Rate:  ${hre.ethers.formatEther(INITIAL_REWARD_RATE)} KENO/sec (864 KENO/day)`);
    console.log("=".repeat(62));

    if (chainId !== 56 && chainId !== 97) {
        throw new Error(`Unexpected chain ID ${chainId}. Expected 56 (BSC) or 97 (BSC Testnet).`);
    }
    if (balance < hre.ethers.parseEther("0.02")) {
        throw new Error(`Deployer balance too low (${hre.ethers.formatEther(balance)} BNB). Need at least 0.02 BNB for gas.`);
    }

    console.log("\n[1/3] Compiling UTLFarm...");
    await hre.run("compile", { quiet: true });
    console.log("  ✅ Compiled successfully");

    console.log("\n[2/3] Deploying UTLFarm contract...");
    const UTLFarm = await hre.ethers.getContractFactory("UTLFarm");
    const farm    = await UTLFarm.deploy(KENO_TOKEN, LP_TOKEN, INITIAL_REWARD_RATE);
    await farm.waitForDeployment();
    const farmAddress = await farm.getAddress();
    console.log(`  ✅ UTLFarm deployed: ${farmAddress}`);
    console.log(`  🔍 BscScan: https://bscscan.com/address/${farmAddress}`);

    console.log("\n[3/3] Saving deployment record...");
    const timestamp = new Date().toISOString();
    const record = {
        contract:    "UTLFarm",
        version:     "1.0",
        network:     network.name,
        chainId:     chainId,
        address:     farmAddress,
        deployer:    deployer.address,
        kenoToken:   KENO_TOKEN,
        lpToken:     LP_TOKEN,
        rewardRate:  INITIAL_REWARD_RATE.toString(),
        deployedAt:  timestamp,
        bscscan:     `https://bscscan.com/address/${farmAddress}`,
        pancakeswap: `https://pancakeswap.finance/add/BNB/${KENO_TOKEN}`,
        farmUrl:     "https://kenostod.com/farm.html"
    };

    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });
    const outFile = path.join(deploymentsDir, `UTLFarm-${chainId}.json`);
    fs.writeFileSync(outFile, JSON.stringify(record, null, 2));
    console.log(`  ✅ Saved: ${outFile}`);

    // ── Update farm.html with live contract address ──────────────────────────
    const farmHtmlPath = path.join(__dirname, "../../public/farm.html");
    if (fs.existsSync(farmHtmlPath)) {
        let html = fs.readFileSync(farmHtmlPath, "utf8");
        html = html.replace(
            "const FARM_CONTRACT = null; // TBA after deployment",
            `const FARM_CONTRACT = '${farmAddress}'; // Deployed ${timestamp}`
        );
        html = html.replace(
            `<span style="font-size:.8rem;color:#475569;font-style:italic;">Deploying to BSC Mainnet — address TBA</span>`,
            `<a href="https://bscscan.com/address/${farmAddress}" target="_blank" rel="noopener" style="font-size:.8rem;color:#10b981;font-family:monospace;word-break:break-all;text-decoration:none;">${farmAddress} ↗</a>`
        );
        fs.writeFileSync(farmHtmlPath, html);
        console.log(`  ✅ Updated farm.html with live contract address`);
    }

    console.log("\n" + "=".repeat(62));
    console.log("  DEPLOYMENT COMPLETE");
    console.log("=".repeat(62));
    console.log(`  UTLFarm Address: ${farmAddress}`);
    console.log("");
    console.log("  NEXT STEPS:");
    console.log("  1. Fund reward pool:");
    console.log(`     npx hardhat run scripts/fundFarm.js --network bsc`);
    console.log("  2. Verify on BscScan:");
    console.log(`     npx hardhat verify --network bsc ${farmAddress} \\`);
    console.log(`       "${KENO_TOKEN}" "${LP_TOKEN}" "${INITIAL_REWARD_RATE}"`);
    console.log("  3. Submit PancakeSwap Farm Application:");
    console.log("     https://kenostod.com/farm-application.html");
    console.log("=".repeat(62));
}

main().catch(err => {
    console.error("\n❌ DEPLOYMENT FAILED:", err.message);
    process.exit(1);
});

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying FlashArbLoan from:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer BNB balance:", hre.ethers.formatEther(balance), "BNB");

  if (balance < hre.ethers.parseEther("0.005")) {
    throw new Error("Insufficient BNB for deployment. Need at least 0.005 BNB.");
  }

  console.log("\nDeploying FlashArbLoan contract...");
  const FlashArbLoan = await hre.ethers.getContractFactory("FlashArbLoan");
  const contract = await FlashArbLoan.deploy({
    gasPrice: hre.ethers.parseUnits("3", "gwei"),
    gasLimit: 2000000
  });

  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("FlashArbLoan deployed at:", address);

  // Save deployment record
  const deploymentData = {
    contract: "FlashArbLoan",
    address,
    deployer: deployer.address,
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    timestamp: new Date().toISOString(),
    pancakeRouter: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    biswapRouter: "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8",
    pancakePair: "0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE",
    wbnb: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    usdt: "0x55d398326f99059fF775485246999027B3197955",
    bscscanUrl: `https://bscscan.com/address/${address}`
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir, { recursive: true });

  const filename = `FlashArbLoan-${hre.network.config.chainId}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deploymentData, null, 2)
  );
  console.log(`Deployment saved to utl/deployments/${filename}`);
  console.log("\nBscScan:", deploymentData.bscscanUrl);
  console.log("\nFlashArbLoan is ready. Owner:", deployer.address);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

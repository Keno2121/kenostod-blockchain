const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const SAFE_WALLET = "0x4AA73FadfFd71E6549867a37455EA957A52Cf849";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=".repeat(60));
  console.log("  Deploying wKENO on POLYGON");
  console.log("=".repeat(60));
  console.log("Deployer:    ", deployer.address);
  console.log("Owner/Treasury:", SAFE_WALLET);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("MATIC balance:", ethers.formatEther(balance), "MATIC");

  if (balance < ethers.parseEther("0.5")) {
    throw new Error(
      "Insufficient MATIC on Polygon. Fund " + deployer.address + " with at least 1 MATIC."
    );
  }

  console.log("\nDeploying WrappedKENO...");
  const WrappedKENO = await ethers.getContractFactory("WrappedKENO");
  const wKENO = await WrappedKENO.deploy(SAFE_WALLET);
  await wKENO.waitForDeployment();

  const address = await wKENO.getAddress();
  const txHash = wKENO.deploymentTransaction()?.hash || "";

  console.log("\n✅ wKENO deployed on Polygon:");
  console.log("   Contract address:", address);
  console.log("   Owner:           ", SAFE_WALLET);
  console.log("   Max Supply:       1,000,000,000 wKENO");
  console.log("   Polygonscan:     https://polygonscan.com/address/" + address);
  console.log("   Deploy Tx:       https://polygonscan.com/tx/" + txHash);

  const deployment = {
    network: "polygon",
    chainId: 137,
    contract: "WrappedKENO",
    symbol: "wKENO",
    name: "Wrapped KENO",
    decimals: 18,
    address,
    owner: SAFE_WALLET,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    txHash,
    polygonscan: "https://polygonscan.com/address/" + address,
    addToWallet: {
      tokenAddress: address,
      tokenSymbol: "wKENO",
      tokenDecimals: 18,
      tokenImage: "https://kenostodblockchain.com/keno-logo-128.png"
    }
  };

  const outPath = path.join(__dirname, "../deployments/wkeno-polygon.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log("\n📄 Deployment record saved:", outPath);

  console.log("\n" + "=".repeat(60));
  console.log("  NEXT STEPS");
  console.log("=".repeat(60));
  console.log("1. Wait 1 min for indexer, then verify source:");
  console.log("   cd wkeno && npx hardhat verify --network polygon", address, '"' + SAFE_WALLET + '"');
  console.log("\n2. Add wKENO to Phantom (Polygon network):");
  console.log("   Phantom → Manage Tokens → Import → paste address below");
  console.log("   Address:   " + address);
  console.log("   Symbol:    wKENO   |   Decimals: 18");
  console.log("\n3. To bridge-mint tokens (treasury → recipient):");
  console.log("   bridgeMint(recipientAddress, amountWei, bscTxHashBytes32)");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Deployment failed:", err.message);
    process.exit(1);
  });

const hre = require("hardhat");

async function main() {
  console.log("🚀 Starting KENO Token & Presale deployment...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  const teamWallet = process.env.TEAM_WALLET || deployer.address;
  const treasuryWallet = process.env.TREASURY_WALLET || deployer.address;
  const liquidityWallet = process.env.LIQUIDITY_WALLET || deployer.address;
  const icoWallet = deployer.address;

  console.log("\n📝 Wallet Addresses:");
  console.log("Team Wallet:", teamWallet);
  console.log("Treasury Wallet:", treasuryWallet);
  console.log("Liquidity Wallet:", liquidityWallet);
  console.log("ICO Wallet:", icoWallet);

  console.log("\n1️⃣  Deploying KENO Token...");
  const KENO = await hre.ethers.getContractFactory("KENO");
  const keno = await KENO.deploy(
    teamWallet,
    treasuryWallet,
    liquidityWallet,
    icoWallet
  );
  await keno.waitForDeployment();
  const kenoAddress = await keno.getAddress();
  console.log("✅ KENO Token deployed to:", kenoAddress);

  const privateSaleStart = Math.floor(Date.now() / 1000) + 86400;
  const privateSaleDuration = 30 * 24 * 60 * 60;
  const publicSaleStart = privateSaleStart + privateSaleDuration + 3600;
  const publicSaleDuration = 60 * 24 * 60 * 60;

  console.log("\n2️⃣  Deploying Presale Contract...");
  console.log("Private Sale Starts:", new Date(privateSaleStart * 1000).toLocaleString());
  console.log("Public Sale Starts:", new Date(publicSaleStart * 1000).toLocaleString());
  
  const Presale = await hre.ethers.getContractFactory("KENOPresale");
  const presale = await Presale.deploy(
    kenoAddress,
    privateSaleStart,
    privateSaleDuration,
    publicSaleStart,
    publicSaleDuration
  );
  await presale.waitForDeployment();
  const presaleAddress = await presale.getAddress();
  console.log("✅ Presale Contract deployed to:", presaleAddress);

  console.log("\n3️⃣  Setting presale contract address in token...");
  const setPresaleTx = await keno.setPresaleContract(presaleAddress);
  await setPresaleTx.wait();
  console.log("✅ Presale contract whitelisted in KENO token");

  console.log("\n4️⃣  Transferring ICO tokens to Presale contract...");
  const icoSupply = hre.ethers.parseEther("300000000");
  const tx = await keno.transfer(presaleAddress, icoSupply);
  await tx.wait();
  console.log("✅ Transferred 300M KENO to Presale contract");

  console.log("\n✨ Deployment Complete!\n");
  console.log("📋 CONTRACT ADDRESSES:");
  console.log("KENO Token:", kenoAddress);
  console.log("Presale Contract:", presaleAddress);
  console.log("\n🔗 Add these to your .env file:");
  console.log(`KENO_TOKEN_ADDRESS=${kenoAddress}`);
  console.log(`PRESALE_CONTRACT_ADDRESS=${presaleAddress}`);

  console.log("\n📝 Next Steps:");
  console.log("1. Verify contracts on BSCScan/Etherscan");
  console.log("2. Add liquidity to DEX");
  console.log("3. Update whitelist for private sale");
  console.log("4. Launch presale website");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

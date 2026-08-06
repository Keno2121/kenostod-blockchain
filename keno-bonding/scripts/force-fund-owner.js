/**
 * Force-fund the KENO contract owner wallet via selfdestruct.
 * Even contracts with no payable receive() will accept ETH this way.
 */
const hre = require("hardhat");
const { ethers } = hre;

const OWNER = "0x4AA73FadfFd71E6549867a37455EA957A52Cf849";
const FUND_AMOUNT = ethers.parseEther("0.005");

async function main() {
  const [deployer] = await ethers.getSigners();
  const bnb = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer :", deployer.address);
  console.log("BNB      :", ethers.formatEther(bnb));
  console.log("Funding  :", OWNER, "with", ethers.formatEther(FUND_AMOUNT), "BNB via selfdestruct\n");

  const ForceFund = await ethers.getContractFactory("ForceFund");
  const tx = await ForceFund.deploy(OWNER, { value: FUND_AMOUNT });
  console.log("Deploy tx:", tx.deploymentTransaction().hash);
  await tx.deploymentTransaction().wait(2);

  const ownerBal = await ethers.provider.getBalance(OWNER);
  console.log("\n✅ Owner BNB after:", ethers.formatEther(ownerBal));
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });

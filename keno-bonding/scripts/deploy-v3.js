const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const COMPROMISED_WALLET =
  "0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2";
const TEMPORARY_PROTECTED_WALLET =
  "0xdc063e18a9d2845ca5489086bae4a1ce3d8410b3";

function requiredAddress(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return ethers.getAddress(value);
}

async function main() {
  if (!process.env.KENO_V3_DEPLOYER_PRIVATE_KEY) {
    throw new Error(
      "KENO_V3_DEPLOYER_PRIVATE_KEY is required; legacy keys are never used"
    );
  }

  const owner = requiredAddress("KENO_V3_OWNER_ADDRESS");
  const supplyRecipient = requiredAddress("KENO_V3_SUPPLY_RECIPIENT");
  const compromised = ethers.getAddress(COMPROMISED_WALLET);
  const temporaryProtectedWallet = ethers.getAddress(
    TEMPORARY_PROTECTED_WALLET
  );
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  for (const [role, address] of [
    ["deployer", deployerAddress],
    ["owner", owner],
    ["supply recipient", supplyRecipient],
  ]) {
    if (address === compromised) {
      throw new Error(`Refusing to use compromised wallet as ${role}`);
    }
  }

  if (deployerAddress === owner || deployerAddress === supplyRecipient) {
    throw new Error(
      "The one-time deployer must be separate from the owner and supply recipient"
    );
  }

  // Mainnet launch rule approved for the initial v3 migration: the protected
  // wallet temporarily controls ownership and receives supply. Ownership can
  // later move through Ownable2Step when a Safe multisig is ready.
  if (
    chainId === 56 &&
    (owner !== temporaryProtectedWallet ||
      supplyRecipient !== temporaryProtectedWallet)
  ) {
    throw new Error(
      "BSC mainnet owner and supply recipient must both be the approved temporary protected wallet"
    );
  }

  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Owner: ${owner}`);
  console.log(`Supply recipient: ${supplyRecipient}`);

  const Token = await ethers.getContractFactory("KenostodTokenV3", deployer);
  const token = await Token.deploy(owner, supplyRecipient);
  await token.waitForDeployment();

  const address = await token.getAddress();
  const deploymentTx = token.deploymentTransaction();
  const receipt = await deploymentTx.wait();
  const record = {
    contract: "KenostodTokenV3",
    address,
    chainId,
    network: network.name,
    deployer: deployerAddress,
    owner,
    supplyRecipient,
    totalSupply: (await token.totalSupply()).toString(),
    transactionHash: deploymentTx.hash,
    blockNumber: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
  };

  const outputDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `keno-v3-${network.name}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`);

  console.log(`KENO v3 deployed at ${address}`);
  console.log(`Deployment record: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
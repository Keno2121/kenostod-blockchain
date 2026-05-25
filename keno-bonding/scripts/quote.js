/**
 * Live quote script — reads current bonding curve state from BSC.
 * Usage: npm run quote
 */

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const net = network.name;
  const deployFile = path.join(__dirname, `../deployments/${net}.json`);

  if (!fs.existsSync(deployFile)) {
    throw new Error(`No deployment found for ${net}. Run deploy first.`);
  }

  const { address } = JSON.parse(fs.readFileSync(deployFile, "utf8"));
  const abi = [
    "function currentPrice() view returns (uint256)",
    "function tokensSold() view returns (uint256)",
    "function allocation() view returns (uint256)",
    "function availableKeno() view returns (uint256)",
    "function bnbReserves() view returns (uint256)",
    "function getBuyQuote(uint256) view returns (uint256, uint256)",
    "function getSellQuote(uint256) view returns (uint256, uint256)"
  ];

  const contract = new ethers.Contract(address, abi, ethers.provider);

  const price     = await contract.currentPrice();
  const sold      = await contract.tokensSold();
  const alloc     = await contract.allocation();
  const available = await contract.availableKeno();
  const reserves  = await contract.bnbReserves();

  const BNB_USD = 600; // approximate
  const priceUsd = parseFloat(ethers.formatEther(price)) * BNB_USD;

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  KENO Bonding Curve — Live State`);
  console.log(`  Network:  ${net}`);
  console.log(`  Contract: ${address}`);
  console.log(`═══════════════════════════════════════════════`);
  console.log(`  Current Price:  ${ethers.formatEther(price)} BNB  (~$${priceUsd.toFixed(6)})`);
  console.log(`  Tokens Sold:    ${ethers.formatEther(sold)} KENO`);
  console.log(`  Allocation:     ${ethers.formatEther(alloc)} KENO`);
  console.log(`  Available:      ${ethers.formatEther(available)} KENO`);
  console.log(`  BNB Reserves:   ${ethers.formatEther(reserves)} BNB`);

  // Buy quote for 0.1 BNB
  const testBnb = ethers.parseEther("0.1");
  const [buyKeno, buyFee] = await contract.getBuyQuote(testBnb);
  console.log(`\n  Buy quote (0.1 BNB input):`);
  console.log(`    KENO out: ${ethers.formatEther(buyKeno)} KENO`);
  console.log(`    Fee:      ${ethers.formatEther(buyFee)} BNB (3%)`);

  // Sell quote for 1000 KENO
  if (sold > 0n) {
    const testKeno = ethers.parseEther("1000");
    const [sellBnb, sellFee] = await contract.getSellQuote(
      testKeno > sold ? sold : testKeno
    );
    console.log(`\n  Sell quote (1,000 KENO input):`);
    console.log(`    BNB out: ${ethers.formatEther(sellBnb)} BNB`);
    console.log(`    Fee:     ${ethers.formatEther(sellFee)} BNB (5%)`);
  }

  console.log(`\n  Market Cap (sold): ~$${(
    parseFloat(ethers.formatEther(sold)) * priceUsd
  ).toLocaleString()}`);
  console.log(`═══════════════════════════════════════════════\n`);
}

main().catch(err => { console.error(err); process.exit(1); });

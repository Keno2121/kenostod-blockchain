const { ethers } = require("ethers");

async function checkBalance() {
  const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.org");
  const address = "0xdc41caad2cb3509df595082afb7372f0454fcebf";
  
  try {
    const balance = await provider.getBalance(address);
    console.log("\n✅ Address is valid!");
    console.log("Address:", address);
    console.log("Current Sepolia ETH balance:", ethers.formatEther(balance), "ETH");
    
    if (balance > 0n) {
      console.log("\n🎉 You already have testnet ETH! Ready to deploy!");
    } else {
      console.log("\n⚠️  Balance is 0 - you need to use a faucet first.");
      console.log("\nTry Alchemy faucet: https://sepoliafaucet.com");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkBalance();

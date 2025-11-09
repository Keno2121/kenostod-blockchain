require("@nomicfoundation/hardhat-toolbox");

// Read private key from Replit Secrets (more secure than .env)
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.warn("⚠️  WARNING: PRIVATE_KEY not found in Replit Secrets!");
  console.warn("Add your private key to Replit Secrets before deploying.");
}

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    // Sepolia Testnet - Use for testing (FREE testnet ETH!)
    sepolia: {
      url: "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    },
    // BSC Mainnet - Use for production launch (~$5-10 cost)
    bsc: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: 3000000000 // 3 Gwei
    },
    // BSC Testnet - Alternative testing option
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      gasPrice: 10000000000 // 10 Gwei for testnet
    },
    // Ethereum Mainnet - Alternative option (higher gas fees ~$200-400)
    ethereum: {
      url: "https://eth.llamarpc.com",
      chainId: 1,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: {
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
      mainnet: process.env.ETHERSCAN_API_KEY || ""
    }
  }
};

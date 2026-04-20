require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Use NEW_WALLET_PRIVATE_KEY for new deployments (Base, Polygon wKENO)
// Old DEPLOYER_PRIVATE_KEY was compromised via EIP-7702 — kept for BSC legacy contracts only
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const NEW_WALLET_PRIVATE_KEY = process.env.NEW_WALLET_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "cancun"
    }
  },
  networks: {
    bsc: {
      url: "https://bsc-dataseed1.binance.org/",
      chainId: 56,
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 3000000000
    },
    bscSafe: {
      url: "https://bsc-dataseed1.binance.org/",
      chainId: 56,
      accounts: [NEW_WALLET_PRIVATE_KEY],
      gasPrice: 3000000000
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts: [DEPLOYER_PRIVATE_KEY],
      gasPrice: 10000000000
    },
    polygon: {
      url: "https://polygon-rpc.com/",
      chainId: 137,
      accounts: [NEW_WALLET_PRIVATE_KEY],
      gasPrice: 50000000000
    },
    polygonAmoy: {
      url: "https://rpc-amoy.polygon.technology/",
      chainId: 80002,
      accounts: [NEW_WALLET_PRIVATE_KEY]
    },
    base: {
      url: "https://mainnet.base.org",
      chainId: 8453,
      accounts: [NEW_WALLET_PRIVATE_KEY],
      gasPrice: 1000000000
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      chainId: 84532,
      accounts: [NEW_WALLET_PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: {
      bsc: process.env.BSCSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || ""
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      }
    ]
  },
  paths: {
    sources: "./contracts",
    scripts: "./scripts",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};

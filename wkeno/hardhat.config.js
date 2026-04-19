require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

// Safe wallet — new deployer (0x4AA73FadfFd71E6549867a37455EA957A52Cf849)
// Old DEPLOYER_PRIVATE_KEY was compromised via EIP-7702 drain — not used here
const NEW_WALLET_PRIVATE_KEY = process.env.NEW_WALLET_PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000001";

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
    base: {
      url: "https://mainnet.base.org",
      chainId: 8453,
      accounts: [NEW_WALLET_PRIVATE_KEY]
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      chainId: 84532,
      accounts: [NEW_WALLET_PRIVATE_KEY]
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
    }
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || ""
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

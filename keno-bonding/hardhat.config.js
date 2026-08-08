require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

// Use bot wallet (has BNB) as deployer — key is 64-char no 0x prefix
const rawKey = process.env.BOT_WALLET_PRIVATE_KEY || process.env.NEW_WALLET_PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000001";
const DEPLOY_KEY = rawKey.startsWith('0x') ? rawKey : '0x' + rawKey;

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "cancun"
        }
      },
      {
        // KenostodToken.sol uses ^0.8.20 — paris is safe cross-chain
        version: "0.8.20",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "paris"
        }
      }
    ]
  },
  networks: {
    bsc: {
      url: process.env.BSC_RPC_PRIMARY || "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [DEPLOY_KEY]
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: [DEPLOY_KEY]
    },
    botchain: {
      url: "https://rpc.botchain.ai",
      chainId: 677,
      accounts: [DEPLOY_KEY],
      gasPrice: "auto"
    }
  },
  etherscan: {
    apiKey: {
      bsc:        process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
      botchain:   process.env.BOTCHAIN_API_KEY || "placeholder"
    },
    customChains: [
      {
        network: "botchain",
        chainId: 677,
        urls: {
          apiURL:     "https://scan.botchain.ai/api",
          browserURL: "https://scan.botchain.ai"
        }
      }
    ]
  },
  paths: {
    sources:   "./contracts",
    scripts:   "./scripts",
    cache:     "./cache",
    artifacts: "./artifacts"
  }
};

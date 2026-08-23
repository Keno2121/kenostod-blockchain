require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

// Bot wallet is the FALP deployer (same wallet that calls depositProfit)
const rawBotKey = process.env.BOT_WALLET_PRIVATE_KEY || "0000000000000000000000000000000000000000000000000000000000000001";
const BOT_WALLET_KEY = rawBotKey.startsWith('0x') ? rawBotKey : '0x' + rawBotKey;

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR:      true,
      evmVersion: "cancun"
    }
  },
  networks: {
    bsc: {
      url:     "https://bsc-rpc.publicnode.com",
      chainId: 56,
      accounts: [BOT_WALLET_KEY]
    },
    bscTestnet: {
      url:     "https://bsc-testnet-rpc.publicnode.com",
      chainId: 97,
      accounts: [BOT_WALLET_KEY]
    },
    botchain: {
      url:      "https://rpc.botchain.ai",
      chainId:  677,
      accounts: [BOT_WALLET_KEY],
      gasPrice: "auto"
    },
    botchainTestnet: {
      url:      "https://rpc.bohr.life",
      chainId:  968,
      accounts: [BOT_WALLET_KEY],
      gasPrice: "auto"
    }
  },
  etherscan: {
    apiKey: {
      bsc:        process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || ""
    },
    customChains: [
      {
        network: "botchain",
        chainId: 677,
        urls: {
          apiURL:     "https://scan.botchain.ai/api",
          browserURL: "https://scan.botchain.ai"
        }
      },
      {
        network: "botchainTestnet",
        chainId: 968,
        urls: {
          apiURL:     "https://scan.botchain.ai/api",
          browserURL: "https://scan.botchain.ai"
        }
      }
    ]
  }
};

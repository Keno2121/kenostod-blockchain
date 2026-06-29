require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

const NEW_WALLET_PRIVATE_KEY = process.env.NEW_WALLET_PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000001";

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun"
    }
  },
  networks: {
    bsc: {
      url: "https://bsc-dataseed1.binance.org",
      chainId: 56,
      accounts: [NEW_WALLET_PRIVATE_KEY]
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: [NEW_WALLET_PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: {
      bsc:        process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || ""
    }
  },
  paths: {
    sources:   "./contracts",
    scripts:   "./scripts",
    cache:     "./cache",
    artifacts: "./artifacts"
  }
};

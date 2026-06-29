require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

// Bot wallet is the FALP deployer (same wallet that calls depositProfit)
const BOT_WALLET_KEY = process.env.BOT_WALLET_PRIVATE_KEY
  ? `0x${process.env.BOT_WALLET_PRIVATE_KEY}`
  : "0x0000000000000000000000000000000000000000000000000000000000000001";

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
    }
  },
  etherscan: {
    apiKey: {
      bsc:        process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || ""
    }
  }
};

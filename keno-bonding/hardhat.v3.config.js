require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

// KENO v3 intentionally ignores all legacy bot/deployer keys.
const rawKey = process.env.KENO_V3_DEPLOYER_PRIVATE_KEY;
const configuredAccounts = rawKey
  ? [rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`]
  : [];

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  networks: {
    bsc: {
      url: process.env.BSC_RPC_PRIMARY || "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: configuredAccounts,
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: configuredAccounts,
    },
  },
  etherscan: {
    apiKey: {
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
    },
  },
};
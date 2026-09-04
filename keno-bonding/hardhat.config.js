require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

// Never fall back to a deterministic private key. Compilation and local tests
// need no configured account; network deployments must provide one explicitly.
const rawKey = process.env.BOT_WALLET_PRIVATE_KEY || process.env.NEW_WALLET_PRIVATE_KEY;
const configuredAccounts = rawKey
  ? [rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`]
  : [];

module.exports = {
  solidity: {
    compilers: [
      {
        // KENO v2 BSC contract — deployed via solc 0.8.34 with default evmVersion (cancun)
        version: "0.8.34",
        settings: {
          optimizer: { enabled: true, runs: 200 }
        }
      },
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
    ],
    // KENO on BOT Chain was deployed with solc 0.8.28, optimizer 200,
    // and Cancun bytecode. Pin this source so verification reproduces
    // the deployed runtime bytecode even when newer compatible compilers
    // are also installed for other contracts.
    overrides: {
      "contracts/KenostodToken.sol": {
        version: "0.8.28",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "cancun"
        }
      },
      "contracts/KenostodTokenV3.sol": {
        version: "0.8.28",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          evmVersion: "cancun"
        }
      }
    }
  },
  networks: {
    bsc: {
      url: process.env.BSC_RPC_PRIMARY || "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: configuredAccounts
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: configuredAccounts
    },
    botchain: {
      url: "https://rpc.botchain.ai",
      chainId: 677,
      accounts: configuredAccounts,
      gasPrice: "auto"
    },
    botchainTestnet: {
      url: "https://rpc.bohr.life",
      chainId: 968,
      accounts: configuredAccounts,
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

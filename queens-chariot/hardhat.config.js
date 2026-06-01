require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../.env" });

// QCT deploys from KENO bot wallet (0xC20b9a51BdedBd21CBE28E68c1089438D21c8cf2)
// Priority: QCT_DEPLOYER_KEY (new) → KENO_WALLET_PRIVATE_KEY → NEW_WALLET_PRIVATE_KEY
function normalizeKey(raw) {
  if (!raw || raw.length < 32) return "0x" + "1".repeat(64); // dummy — deploy will abort
  return raw.startsWith("0x") ? raw : "0x" + raw;
}
const QCT_DEPLOYER_KEY = normalizeKey(
  process.env.QCT_DEPLOYER_KEY ||
  process.env.KENO_WALLET_PRIVATE_KEY ||
  process.env.NEW_WALLET_PRIVATE_KEY
);

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    // Base Mainnet — primary deployment target
    base: {
      url: "https://mainnet.base.org",
      chainId: 8453,
      accounts: [QCT_DEPLOYER_KEY],
      gasPrice: "auto",
    },
    // Base Sepolia Testnet — test before mainnet
    baseSepolia: {
      url: "https://sepolia.base.org",
      chainId: 84532,
      accounts: [QCT_DEPLOYER_KEY],
    },
  },
  etherscan: {
    apiKey: {
      base:        process.env.BASESCAN_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL:     "https://api.basescan.org/api",
          browserURL: "https://basescan.org",
        },
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL:     "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
  sourcify: {
    enabled: true,
  },
  paths: {
    sources:   "./contracts",
    scripts:   "./scripts",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};

import { HardhatUserConfig, task } from "hardhat/config";
import "hardhat-gas-reporter";
import "hardhat-deploy";
import "hardhat-dependency-compiler";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import '@typechain/hardhat'

import dotenv from "dotenv"

dotenv.config();

const mainnetAccounts = {
  mnemonic: process.env.DEPLOYER_MNEMONIC,
  path: "m/44'/60'/0'/0",
  initialIndex: 0,
  count: 20,
  passphrase: "",
}

const hardhatAccounts = {
  mnemonic: process.env.MNEMONIC,
  path: "m/44'/60'/0'/0",
  initialIndex: 0,
  count: 20,
  passphrase: "",
}

const localAccounts = {
  mnemonic: process.env.TEST_MNEMONIC,
  path: "m/44'/60'/0'/0",
  initialIndex: 0,
  count: 20,
  passphrase: "",
}

const config: HardhatUserConfig = {
  paths: {
    artifacts: "artifacts",
    cache: "cache",
    deploy: "src/deploy",
    sources: "contracts",
    tests: "tests"
  },
  namedAccounts: {
    deployer: 0,
    smartAccountOwner: 1,
    alice: 2,
    charlie: 3,
    sessionKey: 4,
  },
  solidity: {
    compilers: [
      {
        version: "0.8.17",
        settings: {
          optimizer: { enabled: true, runs: 800 },
          viaIR: true,
        },
      },
    ],
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      tags: ["local"]
    },
    arbitrum_mainnet: {
      url: "https://arb1.arbitrum.io/rpc",
      tags: ["arbitrum-mainnet"],
      accounts: mainnetAccounts,
      live: true,
      chainId: 59144
    },
    arbitrum: {
      url: "http://159.89.196.204:9000/",
      accounts: localAccounts,
      live: true,
      chainId: 31337.
    },
    folked_ethereum: {
      tags: ["forked-ethereum"],
      url: "http://127.0.0.1:9001",
      accounts: localAccounts,
      live: false,
      chainId: 31337.
    },
    folked_linea: {
      tags: ["forked-arbitrum"],
      url: "http://127.0.0.1:9000",
      accounts: localAccounts,
      live: false,
      chainId: 31337.
    },
    eth_mainnet: {
      url: process.env.ETH_MAINNET_URL || "https://eth.llamarpc.com",
      chainId: 1,
      accounts: hardhatAccounts,
      live: true,
      tags: ["main-suite"]
    },
    goerli: {
      url: process.env.GOERLI_URL || "https://ethereum-goerli.publicnode.com",
      chainId: 5,
      accounts: hardhatAccounts,
      live: true,
      tags: ["test"]
    },
    polygon_mainnet: {
      url: process.env.POLYGON_URL || "https://polygon.llamarpc.com",
      chainId: 137,
      accounts: hardhatAccounts,
      live: true,
      tags: ["main-suite"]
      // : 200e9,
    },
    polygon_mumbai: {
      url: process.env.POLYGON_MUMBAI_URL || "https://polygon-mumbai-bor.publicnode.com",
      chainId: 80001,
      accounts: hardhatAccounts,
      live: true,
      tags: ["test"]
    },
    bnb_mainnet: {
      url: process.env.BSC_MAINNET_URL || "https://rpc.ankr.com/bsc",
      chainId: 56,
      accounts: hardhatAccounts,
      live: true,
      tags: ["main-suite", "bnb"]
    },
    bnb_testnet: {
      url: process.env.BSC_TESTNET_URL || "https://bsc-testnet.publicnode.com",
      chainId: 97,
      accounts: hardhatAccounts,
      gasPrice: 50e9,
      live: true,
      tags: ["test", "bnb-test"]
    },

  },

  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    onlyCalledMethods: true,
  },

  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      goerli: process.env.ETHERSCAN_API_KEY || "",
      polygonMumbai: process.env.POLYGONSCAN_API_KEY || "",
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
      bsc: process.env.BSCSCAN_API_KEY || "",
    },
  },
};

export default config;

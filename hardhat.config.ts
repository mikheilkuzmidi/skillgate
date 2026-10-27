import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable } from "hardhat/config";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: {
    version: "0.8.38",
    settings: {
      evmVersion: "osaka",
      viaIR: false,
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    localValidation: {
      type: "edr-simulated",
      chainType: "l1",
      chainId: 11155111
    },
    localRpc: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:3151"
    },
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1"
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")]
    }
  }
});

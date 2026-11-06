import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const hasValidPrivateKey = /^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY ?? "");

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: "0.8.9",
  networks: {
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
    ...(SEPOLIA_RPC_URL && hasValidPrivateKey
      ? {
          sepolia: {
            type: "http",
            chainType: "l1",
            url: SEPOLIA_RPC_URL,
            accounts: [PRIVATE_KEY],
          },
        }
      : {}),
  },
});
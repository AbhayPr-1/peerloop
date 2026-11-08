import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const configuredPrivateKey = process.env.PRIVATE_KEY?.trim();
const normalizedPrivateKey = configuredPrivateKey && /^[0-9a-fA-F]{64}$/.test(configuredPrivateKey)
  ? `0x${configuredPrivateKey}`
  : configuredPrivateKey;
const hasValidPrivateKey = /^0x[0-9a-fA-F]{64}$/.test(normalizedPrivateKey ?? "");

export default defineConfig({
  plugins: [hardhatEthers, hardhatEthersChaiMatchers, hardhatMocha],
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
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
            accounts: [normalizedPrivateKey],
          },
        }
      : {}),
  },
});
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { network } from 'hardhat';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const { ethers } = await network.connect();
  const feeData = await ethers.provider.getFeeData();
  if (!feeData.gasPrice) {
    throw new Error('Could not determine a Sepolia gas price for contract deployment.');
  }
  const marketplace = await ethers.deployContract("Marketplace", {
    gasLimit: 25_000_000n,
    gasPrice: feeData.gasPrice
  });
  await marketplace.waitForDeployment();

  const newAddress = marketplace.target;
  console.log(`Marketplace deployed to: ${newAddress}`);

  const contractTsPath = path.resolve(__dirname, '../../frontend/src/client/contract.ts');
  let contractTs = fs.readFileSync(contractTsPath, 'utf8');
  const addressDeclaration = /const marketplaceAddress = ".*";/;
  if (!addressDeclaration.test(contractTs)) {
    throw new Error('Could not find marketplaceAddress declaration in frontend/src/client/contract.ts.');
  }
  contractTs = contractTs.replace(addressDeclaration, `const marketplaceAddress = "${newAddress}";`);
  fs.writeFileSync(contractTsPath, contractTs, 'utf8');
  console.log('Updated frontend/src/client/contract.ts.');

  const rootEnvPath = path.resolve(__dirname, '../../.env');
  const rootEnvExamplePath = path.resolve(__dirname, '../../.env.example');
  let envContent = '';
  if (fs.existsSync(rootEnvPath)) {
    envContent = fs.readFileSync(rootEnvPath, 'utf8');
  } else if (fs.existsSync(rootEnvExamplePath)) {
    envContent = fs.readFileSync(rootEnvExamplePath, 'utf8');
  }
  const contractAddressKey = 'CONTRACT_ADDRESS';
  const newEnvLine = `${contractAddressKey}=${newAddress}`;
  const regex = new RegExp(`^${contractAddressKey}=.*`, 'm');
  const newEnvContent = regex.test(envContent)
    ? envContent.replace(regex, newEnvLine)
    : `${envContent}${envContent && !envContent.endsWith('\n') ? '\n' : ''}${newEnvLine}\n`;
  fs.writeFileSync(rootEnvPath, newEnvContent, 'utf8');
  console.log('Updated root .env with CONTRACT_ADDRESS.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
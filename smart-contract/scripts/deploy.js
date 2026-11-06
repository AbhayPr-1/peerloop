import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { network } from 'hardhat';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const { ethers } = await network.connect();
  const marketplace = await ethers.deployContract("Marketplace");
  await marketplace.waitForDeployment();

  const newAddress = marketplace.target;
  console.log(`Marketplace deployed to: ${newAddress}`);

  const contractJsPath = path.resolve(__dirname, '../../frontend/js/contract.js');
  let contractJs = fs.readFileSync(contractJsPath, 'utf8');
  const addressDeclaration = /const marketplaceAddress = ".*";/;
  if (!addressDeclaration.test(contractJs)) {
    throw new Error('Could not find marketplaceAddress declaration in frontend/js/contract.js.');
  }
  contractJs = contractJs.replace(addressDeclaration, `const marketplaceAddress = "${newAddress}";`);
  fs.writeFileSync(contractJsPath, contractJs, 'utf8');
  console.log('Updated frontend/js/contract.js.');

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
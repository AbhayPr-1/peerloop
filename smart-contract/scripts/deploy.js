import fs from 'node:fs';
import path from 'node:path';
import { network } from 'hardhat';

async function main() {
  const { ethers } = await network.connect();
  const marketplace = await ethers.deployContract("Marketplace");
  await marketplace.waitForDeployment();

  const newAddress = marketplace.target;
  console.log(`Marketplace deployed to: ${newAddress}`);

  // --- 1. Update frontend/js/contract.js ---
  const contractJsPath = path.resolve(__dirname, '../../frontend/js/contract.js');
  try {
    let content = fs.readFileSync(contractJsPath, 'utf8');
    const addressRegex = /const marketplaceAddress = ".*";/g;
    const newLine = `const marketplaceAddress = "${newAddress}";`;
    content = content.replace(addressRegex, newLine);
    fs.writeFileSync(contractJsPath, content, 'utf8');
    console.log(`Successfully updated frontend/js/contract.js with new address!`);
  } catch (err) {
    console.error('Failed to update frontend file:', err);
  }
  
  // --- 2. Update root .env file ---
  const rootEnvPath = path.resolve(__dirname, '../../.env');
  const rootEnvExamplePath = path.resolve(__dirname, '../../.env.example');
  try {
    let envContent = '';
    if (fs.existsSync(rootEnvPath)) {
      envContent = fs.readFileSync(rootEnvPath, 'utf8');
    } else if (fs.existsSync(rootEnvExamplePath)) {
      envContent = fs.readFileSync(rootEnvExamplePath, 'utf8');
      console.log(`Created root .env from .env.example`);
    }

    const contractAddressKey = 'CONTRACT_ADDRESS';
    const newEnvLine = `${contractAddressKey}=${newAddress}`;

    // Regex to find and replace the old line, or append if it doesn't exist
    const regex = new RegExp(`^${contractAddressKey}=.*`, 'm');
    let newEnvContent;

    if (envContent.match(regex)) {
      newEnvContent = envContent.replace(regex, newEnvLine);
    } else {
      // Append a new line if it doesn't exist
      newEnvContent = envContent ? (envContent.endsWith('\n') ? `${envContent}${newEnvLine}\n` : `${envContent}\n${newEnvLine}\n`) : `${newEnvLine}\n`;
    }

    fs.writeFileSync(rootEnvPath, newEnvContent, 'utf8');
    console.log(`Successfully updated .env with new CONTRACT_ADDRESS!`);

  } catch (err) {
    console.error('Failed to update .env file:', err);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
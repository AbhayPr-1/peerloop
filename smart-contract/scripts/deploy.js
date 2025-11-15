const fs = require('fs');
const path = require('path');

async function main() {
  const marketplace = await hre.ethers.deployContract("Marketplace");
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
  
  // --- 2. Update backend/.env file ---
  const backendEnvPath = path.resolve(__dirname, '../../backend/.env');
  try {
    const envContent = fs.readFileSync(backendEnvPath, 'utf8');
    const contractAddressKey = 'CONTRACT_ADDRESS';
    const newEnvLine = `${contractAddressKey}="${newAddress}"`;
    
    // Regex to find and replace the old line, or append if it doesn't exist
    const regex = new RegExp(`^${contractAddressKey}=.*`, 'm');
    let newEnvContent;

    if (envContent.match(regex)) {
      newEnvContent = envContent.replace(regex, newEnvLine);
    } else {
      // Append a new line if it doesn't exist
      newEnvContent = envContent + `\n${newEnvLine}`;
    }

    fs.writeFileSync(backendEnvPath, newEnvContent, 'utf8');
    console.log(`Successfully updated backend/.env with new CONTRACT_ADDRESS!`);

  } catch (err) {
    console.error('Failed to update backend/.env file:', err);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
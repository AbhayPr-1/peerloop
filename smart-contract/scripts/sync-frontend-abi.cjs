const fs = require('node:fs');
const path = require('node:path');

const artifactPath = path.resolve(__dirname, '../artifacts/contracts/Marketplace.sol/Marketplace.json');
const frontendAbiPath = path.resolve(__dirname, '../../frontend/src/client/contracts/marketplaceAbi.ts');

if (!fs.existsSync(artifactPath)) {
  throw new Error(`Compiled Marketplace artifact not found: ${artifactPath}. Run Hardhat compile first.`);
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
if (!Array.isArray(artifact.abi)) {
  throw new Error('Marketplace artifact does not contain an ABI array.');
}

const contents = `// Generated from smart-contract/artifacts/contracts/Marketplace.sol/Marketplace.json by npm run compile.\nconst marketplaceABI = ${JSON.stringify(artifact.abi, null, 2)};\n`;
fs.writeFileSync(frontendAbiPath, contents, 'utf8');
console.log(`Synchronized ${artifact.abi.length} ABI entries to ${frontendAbiPath}`);

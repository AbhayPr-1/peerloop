import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { network } from 'hardhat';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEPOLIA_CHAIN_ID = 11155111n;
const LOCAL_CHAIN_ID = 31337n;

async function main() {
  const { ethers } = await network.connect();
  const connectedNetwork = await ethers.provider.getNetwork();
  const isSepolia = connectedNetwork.chainId === SEPOLIA_CHAIN_ID;
  const isLocal = connectedNetwork.chainId === LOCAL_CHAIN_ID;
  if (!isSepolia && !isLocal) {
    throw new Error(
      `Refusing deployment on unsupported chain ${connectedNetwork.chainId}; expected Sepolia (${SEPOLIA_CHAIN_ID}) or local Hardhat (${LOCAL_CHAIN_ID}).`
    );
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error('No deployer account is configured.');
  }

  const factory = await ethers.getContractFactory('Marketplace', deployer);
  const deploymentRequest = await factory.getDeployTransaction();
  const estimatedGas = await ethers.provider.estimateGas({
    ...deploymentRequest,
    from: await deployer.getAddress()
  });
  const gasLimit = (estimatedGas * 105n + 99n) / 100n;
  if (isSepolia) {
    const latestBlock = await ethers.provider.getBlock('latest');
    if (!latestBlock) {
      throw new Error('Could not read the latest Sepolia block gas limit.');
    }
    const deploymentGasCeiling = latestBlock.gasLimit * 90n / 100n;
    if (gasLimit > deploymentGasCeiling) {
      throw new Error(
        `Estimated deployment gas plus safety margin (${gasLimit}) exceeds 90% of the latest Sepolia block gas limit (${latestBlock.gasLimit}).`
      );
    }
  }
  console.log(`Estimated deployment gas: ${estimatedGas}; using limit: ${gasLimit}`);
  if (process.env.DEPLOY_ESTIMATE_ONLY === '1') {
    console.log('Estimate-only mode; no transaction sent.');
    return;
  }

  const deployOptions: { gasLimit: bigint; gasPrice?: bigint } = { gasLimit };
  if (isSepolia) {
    const feeData = await ethers.provider.getFeeData();
    if (!feeData.gasPrice) {
      throw new Error('Could not determine a Sepolia gas price for contract deployment.');
    }
    deployOptions.gasPrice = feeData.gasPrice;
  }
  const marketplace = await ethers.deployContract('Marketplace', [], deployOptions);
  await marketplace.waitForDeployment();

  const newAddress = marketplace.target;
  const deploymentTransaction = marketplace.deploymentTransaction();
  if (!deploymentTransaction) {
    throw new Error('Could not find the marketplace deployment transaction.');
  }
  const deploymentReceipt = await deploymentTransaction.wait();
  if (!deploymentReceipt) {
    throw new Error('Could not confirm the marketplace deployment transaction.');
  }
  const deploymentBlock = deploymentReceipt.blockNumber;
  console.log(`Marketplace deployed to: ${newAddress}`);
  console.log(`Deployment transaction: ${deploymentReceipt.hash}`);
  console.log(`Marketplace deployment block: ${deploymentBlock}`);

  if (isLocal) {
    console.log('Local deployment only; shared frontend and root .env configuration were not changed.');
    return;
  }

  const contractTsPath = path.resolve(__dirname, '../../frontend/src/client/contract.ts');
  let contractTs = fs.readFileSync(contractTsPath, 'utf8');
  const addressDeclaration = /const marketplaceAddress = ".*";/;
  const deploymentBlockDeclaration = /const marketplaceDeploymentBlock = \d+;/;
  if (!addressDeclaration.test(contractTs)) {
    throw new Error('Could not find marketplaceAddress declaration in frontend/src/client/contract.ts.');
  }
  if (!deploymentBlockDeclaration.test(contractTs)) {
    throw new Error('Could not find marketplaceDeploymentBlock declaration in frontend/src/client/contract.ts.');
  }
  contractTs = contractTs.replace(addressDeclaration, `const marketplaceAddress = "${newAddress}";`);
  contractTs = contractTs.replace(deploymentBlockDeclaration, `const marketplaceDeploymentBlock = ${deploymentBlock};`);
  fs.writeFileSync(contractTsPath, contractTs, 'utf8');
  console.log('Updated marketplace address and deployment block in frontend/src/client/contract.ts.');

  const rootEnvPath = path.resolve(__dirname, '../../.env');
  const rootEnvExamplePath = path.resolve(__dirname, '../../.env.example');
  let envContent = '';
  if (fs.existsSync(rootEnvPath)) {
    envContent = fs.readFileSync(rootEnvPath, 'utf8');
  } else if (fs.existsSync(rootEnvExamplePath)) {
    envContent = fs.readFileSync(rootEnvExamplePath, 'utf8');
  }
  const contractAddressLine = /^CONTRACT_ADDRESS=.*$/m;
  const line = `CONTRACT_ADDRESS=${newAddress}`;
  envContent = contractAddressLine.test(envContent)
    ? envContent.replace(contractAddressLine, line)
    : `${envContent}${envContent && !envContent.endsWith('\n') ? '\n' : ''}${line}\n`;
  fs.writeFileSync(rootEnvPath, envContent, 'utf8');
  console.log('Updated root .env with CONTRACT_ADDRESS.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

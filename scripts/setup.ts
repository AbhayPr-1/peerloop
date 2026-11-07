#!/usr/bin/env node
/**
 * PeerLoop Automated Setup Script
 * Sets up environment files and dependencies for a fresh clone.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '../..');
const CONTRACT_DIR = path.join(ROOT_DIR, 'smart-contract');

// Terminal ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function printBanner() {
  log('\n=========================================================', colors.cyan);
  log('   ⚡ PEERLOOP AUTOMATED PROJECT SETUP & INITIALIZER ⚡  ', colors.bold + colors.magenta);
  log('=========================================================\n', colors.cyan);
}

function setupRootEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  const examplePath = path.join(ROOT_DIR, '.env.example');

  // Keep local credentials and settings intact on every setup run.
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(examplePath)) {
      let content = fs.readFileSync(examplePath, 'utf8');

      // Auto-generate a secure random 64-character hex JWT secret
      const randomSecret = crypto.randomBytes(32).toString('hex');
      content = content.replace(
        /JWT_SECRET=.*/,
        `JWT_SECRET=${randomSecret}`
      );

      try {
        // The exclusive flag also protects an .env created between the check and write.
        fs.writeFileSync(envPath, content, { encoding: 'utf8', flag: 'wx' });
        log('✔ Created root .env from .env.example with a generated JWT_SECRET.', colors.green);
      } catch (err) {
        if (err.code === 'EEXIST') {
          log('ℹ .env was created by another process (kept intact).', colors.cyan);
        } else {
          throw err;
        }
      }
    } else {
      log('⚠ Warning: .env.example not found. Skipping .env creation.', colors.yellow);
    }
  } else {
    log('ℹ .env already exists (kept intact).', colors.cyan);
  }
}

function runCommand(command, cwd, stepName) {
  log(`\n⏳ Running: ${stepName}...`, colors.yellow);
  try {
    execSync(command, { cwd, stdio: 'inherit' });
    log(`✔ ${stepName} completed successfully!`, colors.green);
  } catch (err) {
    log(`✖ Error during ${stepName}: ${err.message}`, colors.red);
    process.exit(1);
  }
}

function printSummary() {
  log('\n=========================================================', colors.cyan);
  log('                  🎉 SETUP COMPLETE! 🎉                   ', colors.bold + colors.green);
  log('=========================================================', colors.cyan);
  log('\nQuick checklist before running the app:', colors.bold);
  log(' 1. Review .env in the project root:');
  log('    - SEPOLIA_RPC_URL (e.g. Alchemy/Infura for Sepolia testnet)');
  log('    - PINATA_JWT or PINATA_API_KEY (optional, for product image uploads to IPFS)');
  log('    - MONGO_URI (defaults to local MongoDB: mongodb://127.0.0.1:27017/peerloop)');
  log('    - PRIVATE_KEY (Required for contract deployment)');
  log('\nTo start both the Backend API and Frontend Marketplace together:', colors.bold);
  log('   npm run dev\n', colors.bold + colors.green);
  log('Then open: http://localhost:3000 in your browser.\n', colors.cyan);
}

function main() {
  printBanner();

  log('1. Setting up environment variables (.env)...', colors.bold);
  setupRootEnv();

  log('\n2. Installing Smart Contract dependencies...', colors.bold);
  runCommand('npm install', CONTRACT_DIR, 'Smart-contract dependencies installation');

  printSummary();
}

main();

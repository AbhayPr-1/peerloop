#!/usr/bin/env node
/**
 * PeerLoop Automated Setup Script
 * Sets up environment files and dependencies for a fresh clone.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
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

function setupBackendEnv() {
  const envPath = path.join(BACKEND_DIR, '.env');
  const examplePath = path.join(BACKEND_DIR, '.env.example');

  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(examplePath)) {
      let content = fs.readFileSync(examplePath, 'utf8');
      
      // Auto-generate a secure random 64-character hex JWT secret
      const randomSecret = crypto.randomBytes(32).toString('hex');
      content = content.replace(
        /JWT_SECRET=.*/,
        `JWT_SECRET=${randomSecret}`
      );

      fs.writeFileSync(envPath, content, 'utf8');
      log('✔ Created backend/.env with an auto-generated secure JWT_SECRET!', colors.green);
    } else {
      log('⚠ Warning: backend/.env.example not found. Skipping backend/.env creation.', colors.yellow);
    }
  } else {
    log('ℹ backend/.env already exists (kept intact).', colors.cyan);
  }
}

function setupContractEnv() {
  const envPath = path.join(CONTRACT_DIR, '.env');
  const examplePath = path.join(CONTRACT_DIR, '.env.example');

  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(examplePath)) {
      const content = fs.readFileSync(examplePath, 'utf8');
      fs.writeFileSync(envPath, content, 'utf8');
      log('✔ Created smart-contract/.env from template!', colors.green);
    } else {
      log('⚠ Warning: smart-contract/.env.example not found.', colors.yellow);
    }
  } else {
    log('ℹ smart-contract/.env already exists (kept intact).', colors.cyan);
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
  log(' 1. Review backend/.env:');
  log('    - SEPOLIA_RPC_URL (e.g. Alchemy/Infura for Sepolia testnet)');
  log('    - PINATA_JWT or PINATA_API_KEY (optional, for product image uploads to IPFS)');
  log('    - MONGO_URI (defaults to local MongoDB: mongodb://127.0.0.1:27017/peerloop)');
  log(' 2. (Optional) Review smart-contract/.env if you want to deploy your own contract.');
  log('\nTo start both the Backend API and Frontend Marketplace together:', colors.bold);
  log('   npm run dev\n', colors.bold + colors.green);
  log('Then open: http://localhost:3000 in your browser.\n', colors.cyan);
}

function main() {
  printBanner();

  log('1. Setting up environment variables (.env)...', colors.bold);
  setupBackendEnv();
  setupContractEnv();

  log('\n2. Installing Root & Backend dependencies...', colors.bold);
  runCommand('npm install', ROOT_DIR, 'Root dependencies installation');

  log('\n3. Installing Smart Contract dependencies...', colors.bold);
  runCommand('npm install', CONTRACT_DIR, 'Smart-contract dependencies installation');

  printSummary();
}

main();

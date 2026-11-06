#!/usr/bin/env node
/**
 * PeerLoop Production Startup Script
 * Production-ready server startup with optimized settings and health monitoring.
 */

const { spawn } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

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

log('\n=========================================================', colors.cyan);
log('              🚀 STARTING PEERLOOP PRODUCTION 🚀              ', colors.bold + colors.magenta);
log('=========================================================\n', colors.cyan);

log('🌐 Frontend Marketplace: http://localhost:3000 (Production)', colors.bold + colors.green);
log('🔌 Backend API Server:   http://localhost:5001 (Production)\n', colors.bold + colors.cyan);
log('   Health Check: http://localhost:5001/api/config/rpc-url', colors.cyan);
log('---------------------------------------------------------', colors.cyan);

// Use a single shell command string with proper quoting for cross-platform compatibility
const command = 'npx concurrently -n "BACKEND,FRONTEND" -c "cyan,magenta" --kill-others-on-fail "npm start" "npx serve frontend -l 3000"';

const child = spawn(command, [], {
  stdio: 'inherit',
  cwd: ROOT_DIR,
  shell: true,
  env: { ...process.env }
});

child.on('error', (err) => {
  console.error('Failed to start production servers:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  log('\n🛑 Shutting down production servers...', colors.yellow);
  child.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n🛑 Shutting down production servers...', colors.yellow);
  child.kill('SIGTERM');
  process.exit(0);
});

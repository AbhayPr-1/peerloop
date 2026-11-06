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

const backendPort = process.env.PORT || 5001;
const frontendPort = process.env.FRONTEND_PORT || 3000;

log(`🌐 Frontend Marketplace: http://localhost:${frontendPort} (Production)`, colors.bold + colors.green);
log(`🔌 Backend API Server:   http://localhost:${backendPort} (Production)\n`, colors.bold + colors.cyan);
log(`   Health Check: http://localhost:${backendPort}/api/config/rpc-url`, colors.cyan);
log('---------------------------------------------------------', colors.cyan);

const concurrentlyCli = path.join(ROOT_DIR, 'node_modules', 'concurrently', 'dist', 'bin', 'index.js');
const serveCli = path.join(ROOT_DIR, 'node_modules', 'serve', 'build', 'main.js');
const child = spawn(process.execPath, [
  concurrentlyCli,
  '-n',
  'BACKEND,FRONTEND',
  '-c',
  'cyan,magenta',
  '--kill-others-on-fail',
  'node ./backend/server.js',
  `node "${serveCli}" frontend -l ${frontendPort}`
], {
  stdio: 'inherit',
  cwd: ROOT_DIR
});

let shuttingDown = false;

child.on('error', (err) => {
  console.error('Failed to start production servers:', err);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exitCode = shuttingDown ? 0 : (code ?? 1);
});

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('\n🛑 Shutting down production servers...', colors.yellow);

  if (process.platform === 'win32' && child.pid) {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    killer.on('error', (err) => {
      console.error('Failed to stop production server processes:', err.message);
      child.kill(signal);
    });
    killer.on('exit', (code) => {
      if (code !== 0 && child.exitCode === null) {
        console.error('Failed to stop production server process tree.');
        child.kill(signal);
      }
    });
    return;
  }

  child.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

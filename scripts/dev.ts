#!/usr/bin/env node
/**
 * PeerLoop Dev Startup Script
 * Starts backend and frontend concurrently and prints clickable local links.
 */

const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');

// Terminal ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function findAvailablePort(startPort, excludedPort = null) {
  if (startPort > 65535) {
    return Promise.reject(new Error('No available TCP port found in the configured port range.'));
  }
  if (startPort === excludedPort) return findAvailablePort(startPort + 1, excludedPort);

  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1, excludedPort));
      } else {
        reject(error);
      }
    });
    server.listen(startPort, () => {
      server.close((error) => error ? reject(error) : resolve(startPort));
    });
  });
}

async function start() {
  const requestedFrontendPort = Number(process.env.FRONTEND_PORT || 3000);
  const requestedBackendPort = Number(process.env.PORT || 5001);

  if (!Number.isInteger(requestedFrontendPort) || requestedFrontendPort < 1 || requestedFrontendPort > 65535) {
    throw new Error('FRONTEND_PORT must be a valid TCP port.');
  }
  if (!Number.isInteger(requestedBackendPort) || requestedBackendPort < 1 || requestedBackendPort > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }

  const frontendPort = await findAvailablePort(requestedFrontendPort);
  const backendPort = await findAvailablePort(requestedBackendPort, frontendPort);
  const frontendOrigin = `http://localhost:${frontendPort}`;
  const apiUrl = `http://localhost:${backendPort}`;

  if (frontendPort !== requestedFrontendPort) {
    log(`Port ${requestedFrontendPort} is already in use; using frontend port ${frontendPort}.`, colors.yellow);
  }
  if (backendPort !== requestedBackendPort) {
    log(`Port ${requestedBackendPort} is already in use; using backend port ${backendPort}.`, colors.yellow);
  }

  log('\n=========================================================', colors.cyan);
  log('         ⚡ STARTING PEERLOOP DEVELOPMENT SUITE ⚡        ', colors.bold + colors.magenta);
  log('=========================================================\n', colors.cyan);

  log(`🌐 Frontend Marketplace: ${frontendOrigin}`, colors.bold + colors.green);
  log(`🔌 Backend API Server:   ${apiUrl}\n`, colors.bold + colors.cyan);
  log('---------------------------------------------------------', colors.cyan);

  const concurrentlyCli = path.join(ROOT_DIR, 'node_modules', 'concurrently', 'dist', 'bin', 'index.js');
  const child = spawn(process.execPath, [
    concurrentlyCli,
    '-n',
    'BACKEND,FRONTEND',
    '-c',
    'cyan,magenta',
    '--kill-others-on-fail',
    'node ./dist/backend/server.js',
    'node ./dist/scripts/frontend-dev.js'
  ], {
    stdio: 'inherit',
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(backendPort),
      FRONTEND_PORT: String(frontendPort),
      APP_ORIGIN: frontendOrigin,
      PEERLOOP_API_URL: apiUrl
    }
  });

  let shuttingDown = false;

  child.on('error', (err) => {
    console.error('Failed to start development servers:', err);
    process.exitCode = 1;
  });

  child.on('exit', (code) => {
    process.exitCode = shuttingDown ? 0 : (code ?? 1);
  });

  // Graceful shutdown handling
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    log('\n🛑 Shutting down development servers...', colors.yellow);

    if (process.platform === 'win32' && child.pid) {
      // Stop concurrently and its server descendants; killing only the shell leaves them running.
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      killer.on('error', (err) => {
        console.error('Failed to stop development server processes:', err.message);
        child.kill(signal);
      });
      killer.on('exit', (code) => {
        if (code !== 0 && child.exitCode === null) {
          console.error('Failed to stop development server process tree.');
          child.kill(signal);
        }
      });
      return;
    }

    child.kill(signal);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error) => {
  console.error('Failed to select development server ports:', error.message);
  process.exitCode = 1;
});

#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execSync } = require('child_process');

const FRONTEND_ROOT = path.resolve(__dirname, '../..', 'frontend');
const PORT = Number(process.env.FRONTEND_PORT || 3000);
const isDevelopment = process.env.NODE_ENV !== 'production';
const documentModulePath = require.resolve('../frontend/src/document');
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};
const apiConnectSources = new Set(["'self'", 'http://localhost:5001', 'ws://localhost:5001',
  'https://ethereum-sepolia-rpc.publicnode.com', 'https://sepolia.gateway.tenderly.co',
  'https://eth-sepolia.blockscout.com']);
try {
  if (process.env.PEERLOOP_API_URL) {
    const api = new URL(process.env.PEERLOOP_API_URL);
    apiConnectSources.add(api.origin);
    apiConnectSources.add(`${api.protocol === 'https:' ? 'wss:' : 'ws:'}//${api.host}`);
  }
} catch (_) {
  console.error('PEERLOOP_API_URL is not a valid URL; the frontend will use its same-origin default.');
}
function setSecurityHeaders(response, request) {
  const socketScheme = process.env.NODE_ENV === 'production' ? 'wss:' : 'ws:';
  const connectSources = new Set(apiConnectSources);
  if (request.headers.host) connectSources.add(`${socketScheme}//${request.headers.host}`);
  response.setHeader('Content-Security-Policy', `default-src 'self'; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; connect-src ${[...connectSources].join(' ')}; font-src 'self' data: https://fonts.gstatic.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`);
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
}
const liveReloadClients = new Set<import('http').ServerResponse>();
let reloadTimer = null;

function sendLiveReload(relativePath) {
  const message = `event: reload\ndata: ${JSON.stringify({ path: relativePath })}\n\n`;
  for (const response of liveReloadClients) {
    if (!response.destroyed) response.write(message);
  }
}

function isInsideFrontend(filePath) {
  const relative = path.relative(FRONTEND_ROOT, filePath);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

const server = http.createServer((request, response) => {
  let requestUrl;
  try {
    requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  } catch (_) {
    response.writeHead(400).end('Bad request');
    return;
  }

  if (requestUrl.pathname === '/__live-reload') {
    response.writeHead(200, {
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Content-Type': 'text/event-stream; charset=utf-8',
      'X-Accel-Buffering': 'no'
    });
    response.write(': live reload connected\n\n');
    liveReloadClients.add(response);
    request.on('close', () => liveReloadClients.delete(response));
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch (_) {
    response.writeHead(400).end('Bad request');
    return;
  }

  if (pathname === '/' || pathname === '/index.html' || pathname === '/marketplace' || pathname === '/sell') {
    if (isDevelopment) delete require.cache[documentModulePath];
    const { renderDocument } = require(documentModulePath);
    setSecurityHeaders(response, request);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8'
    }).end(renderDocument(process.env.PEERLOOP_API_URL, isDevelopment));
    return;
  }

  let filePath = path.resolve(FRONTEND_ROOT, `.${pathname}`);
  if (!isInsideFrontend(filePath)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(filePath, (statError, stats) => {
    if (statError) {
      response.writeHead(404).end('Not found');
      return;
    }

    if (stats.isDirectory()) {
      response.writeHead(404).end('Not found');
      return;
    }
    const resolvedPath = filePath;
    fs.readFile(resolvedPath, (readError, contents) => {
      if (readError) {
        response.writeHead(404).end('Not found');
        return;
      }

      const extension = path.extname(resolvedPath).toLowerCase();
      const headers = {
        'Cache-Control': 'no-store',
        'Content-Type': MIME_TYPES[extension] || 'application/octet-stream'
      };

      setSecurityHeaders(response, request);
      response.writeHead(200, headers).end(contents);
    });
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Frontend development server could not start: port ${PORT} is already in use.`);
  } else {
    console.error('Frontend development server failed:', error.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`Frontend development server: http://localhost:${PORT}`);
  if (isDevelopment) console.log('Live reload is enabled for files in frontend/.');
});

let watcher;
if (isDevelopment) try {
  watcher = fs.watch(FRONTEND_ROOT, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;
    const relativePath = filename.toString().replace(/\\/g, '/');
    if (/\.manus-[^/]*\.tmp$/i.test(relativePath) || /(^|\/)\.DS_Store$/i.test(relativePath)) return;
    if (relativePath === 'dist' || relativePath.startsWith('dist/')) return;

    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      if (/\.(ts|tsx)$|tsconfig\.json$/i.test(relativePath)) {
        const buildScript = relativePath === 'src/document.ts' ? 'build:server' : 'build:frontend';
        try {
          execSync(`npm run ${buildScript}`, { cwd: path.resolve(__dirname, '../..'), stdio: 'inherit' });
        } catch (error) {
          console.error(`TypeScript rebuild failed after ${relativePath} changed:`, error.message);
          return;
        }
      }
      sendLiveReload(relativePath);
    }, 150);
  });
  watcher.on('error', (error) => {
    console.error('Frontend file watcher stopped:', error.message);
  });
} catch (error) {
  console.error('Could not watch frontend files for changes:', error.message);
}

function shutdown() {
  clearTimeout(reloadTimer);
  if (watcher) watcher.close();
  for (const response of liveReloadClients) response.end();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

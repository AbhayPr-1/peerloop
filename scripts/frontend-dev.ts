#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

const FRONTEND_ROOT = path.resolve(__dirname, '../..', 'frontend');
const PORT = Number(process.env.FRONTEND_PORT || 3000);
const isDevelopment = process.env.NODE_ENV !== 'production';
const isLiveReloadEnabled = isDevelopment && process.env.PEERLOOP_LIVE_RELOAD === 'true';
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
    }).end(renderDocument(process.env.PEERLOOP_API_URL, isLiveReloadEnabled));
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
    const extension = path.extname(resolvedPath).toLowerCase();
    const contentType = MIME_TYPES[extension] || 'application/octet-stream';
    const headers: Record<string, string | number> = { 'Content-Type': contentType };
    setSecurityHeaders(response, request);

    if (isDevelopment) {
      headers['Cache-Control'] = 'no-store';
    } else {
      const etag = `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
      headers.ETag = etag;
      headers['Last-Modified'] = stats.mtime.toUTCString();
      headers['Cache-Control'] = 'no-cache';

      const ifNoneMatch = request.headers['if-none-match'];
      const notModified = ifNoneMatch
        ? ifNoneMatch.split(',').some((value) => {
            const candidate = value.trim();
            return candidate === '*' || candidate.replace(/^W\//, '') === etag.replace(/^W\//, '');
          })
        : Boolean(request.headers['if-modified-since'])
          && Date.parse(request.headers['if-modified-since']) >= Math.floor(stats.mtimeMs / 1000) * 1000;

      if (notModified) {
        response.writeHead(304, headers).end();
        return;
      }
    }

    const acceptsGzip = String(request.headers['accept-encoding'] || '').split(',').some((encoding) => {
      const [name, ...parameters] = encoding.trim().split(';');
      return name.toLowerCase() === 'gzip'
        && !parameters.some((parameter) => /^q\s*=\s*0(?:\.0*)?$/i.test(parameter.trim()));
    });
    const compressible = /^text\//i.test(contentType) || /(?:javascript|json|xml|svg\+xml)$/i.test(contentType);
    const useGzip = !isDevelopment && stats.size >= 1024 && acceptsGzip && compressible;
    if (useGzip) {
      headers['Content-Encoding'] = 'gzip';
      headers.Vary = 'Accept-Encoding';
    } else {
      headers['Content-Length'] = stats.size;
    }

    response.writeHead(200, headers);
    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    const source = fs.createReadStream(resolvedPath);
    source.on('error', (readError) => {
      console.error(`Could not stream frontend asset ${resolvedPath}:`, readError.message);
      if (!response.headersSent) response.writeHead(404).end('Not found');
      else response.destroy(readError);
    });
    if (useGzip) {
      const gzip = zlib.createGzip();
      gzip.on('error', (compressionError) => response.destroy(compressionError));
      source.pipe(gzip).pipe(response);
    } else {
      source.pipe(response);
    }
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
  if (isLiveReloadEnabled) console.log('Live reload is enabled by PEERLOOP_LIVE_RELOAD=true.');
  else if (isDevelopment) console.log('Live reload is disabled; set PEERLOOP_LIVE_RELOAD=true to enable it.');
});

let watcher;
if (isLiveReloadEnabled) try {
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

#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const path = require('path');

const FRONTEND_ROOT = path.resolve(__dirname, '..', 'frontend');
const PORT = Number(process.env.FRONTEND_PORT || 3000);
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
const liveReloadClients = new Set();
let reloadTimer = null;

const liveReloadScript = `<script>
(() => {
  const events = new EventSource('/__live-reload');
  events.addEventListener('reload', () => window.location.reload());
})();
</script>`;
const apiConfigScript = process.env.PEERLOOP_API_URL
  ? `<script>window.PEERLOOP_API_URL = ${JSON.stringify(process.env.PEERLOOP_API_URL)};</script>`
  : '';

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

  let filePath = path.resolve(FRONTEND_ROOT, `.${pathname}`);
  if (!isInsideFrontend(filePath)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  if (pathname.endsWith('/')) filePath = path.join(filePath, 'index.html');

  fs.stat(filePath, (statError, stats) => {
    if (statError) {
      response.writeHead(404).end('Not found');
      return;
    }

    const resolvedPath = stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;
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

      if (extension === '.html') {
        const html = contents.toString('utf8');
        const configuredHtml = apiConfigScript && /<\/head\s*>/i.test(html)
          ? html.replace(/<\/head\s*>/i, `${apiConfigScript}</head>`)
          : html;
        const injectedHtml = /<\/body\s*>/i.test(configuredHtml)
          ? configuredHtml.replace(/<\/body\s*>/i, `${liveReloadScript}</body>`)
          : `${configuredHtml}\n${liveReloadScript}`;
        response.writeHead(200, headers).end(injectedHtml);
        return;
      }

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
  console.log('Live reload is enabled for files in frontend/.');
});

let watcher;
try {
  watcher = fs.watch(FRONTEND_ROOT, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;
    const relativePath = filename.toString().replace(/\\/g, '/');
    if (/\.manus-[^/]*\.tmp$/i.test(relativePath) || /(^|\/)\.DS_Store$/i.test(relativePath)) return;

    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => sendLiveReload(relativePath), 150);
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

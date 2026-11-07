export const documentHtml = String.raw`<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PeerLoop</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23f0eee9'/%3E%3Cg fill='none' stroke='%2368704f' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m24 40-4 4a10 10 0 0 1-14-14l10-10a10 10 0 0 1 14 0'/%3E%3Cpath d='m40 24 4-4a10 10 0 0 1 14 14L48 44a10 10 0 0 1-14 0'/%3E%3Cpath d='m23 41 18-18'/%3E%3C/g%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;1,400;1,500&display=swap"
    rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="js/ethers.umd.min.js"></script>
  <script src="js/socket.io.min.js"></script>
  <link rel="stylesheet" href="css/variables.css">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/animations.css">
  <link rel="stylesheet" href="css/components.css">
  <link rel="stylesheet" href="css/modal.css">
  <link rel="stylesheet" href="css/glass.css">
  <link rel="stylesheet" href="css/landing.css">
</head>

<body class="overflow-x-hidden">

  <script src="/dist/js/utils.js"></script>
  <script src="/dist/js/contract.js"></script>
  <script src="/dist/js/history.js"></script>
  <script src="/dist/js/walletDetection.js"></script>
  <script src="/dist/js/animations.js"></script>
  <script src="/dist/js/ui.js"></script>
  <script src="/dist/js/auth.js"></script>
  <script src="/dist/js/accountDashboard.js"></script>
  <script src="/dist/js/marketplace.js"></script>
  <script src="/dist/js/cart.js"></script>
  <script src="/dist/js/custom-select.js"></script>
  <script src="/dist/js/main.js"></script>
</body>

</html>`;

export function renderDocument(apiUrl?: string, liveReload = false): string {
  const head = documentHtml.match(/<head>([\s\S]*?)<\/head>/i)?.[1]
    ?.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const body = documentHtml.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  if (!head || !body) throw new Error('Could not render the PeerLoop page template.');

  const scripts = [...documentHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi)]
    .map(([, src]) => `<script src="${src}"></script>`)
    .join('\n');
  const bodyClass = body[1].match(/\bclass="([^"]*)"/i)?.[1] || '';
  const apiConfig = apiUrl
    ? `<script>window.PEERLOOP_API_URL = ${JSON.stringify(apiUrl)};</script>`
    : '';
  const reloadScript = liveReload
    ? `<script>(() => { const events = new EventSource('/__live-reload'); events.addEventListener('reload', () => window.location.reload()); })();</script>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>${head}${apiConfig}</head>
<body class="${bodyClass}"><div id="root"></div>
<script src="/dist/app.js"></script>
${scripts}
${reloadScript}
</body>
</html>`;
}

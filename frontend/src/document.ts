export const documentHtml = String.raw`<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Peerloop | Decentralized P2P Marketplace</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%230B132B'/%3E%3Cg fill='none' stroke='%2310B981' stroke-width='4.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='24' cy='32' r='10' stroke='%2310B981'/%3E%3Ccircle cx='40' cy='32' r='10' stroke='%23D4AF37'/%3E%3Cpath d='M28 25a10 10 0 0 1 8 0m0 14a10 10 0 0 1-8 0' stroke='%2334D399'/%3E%3C/g%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
    rel="stylesheet" />
  <script src="js/ethers.umd.min.js"></script>
  <script src="js/socket.io.min.js"></script>
  <link rel="stylesheet" href="/dist/css/tailwind.css">
  <link rel="stylesheet" href="css/variables.css">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/animations.css">
  <link rel="stylesheet" href="css/components.css">
  <link rel="stylesheet" href="css/modal.css">
  <link rel="stylesheet" href="css/glass.css">
  <link rel="stylesheet" href="css/landing.css">
</head>

<body class="overflow-x-hidden">

  <script src="/dist/js/apiTransport.js"></script>
  <script src="/dist/js/apiClient.js"></script>
  <script src="/dist/js/money.js"></script>
  <script src="/dist/js/utils.js"></script>
  <script src="/dist/js/contracts/marketplaceAbi.js"></script>
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
    // Load the legacy classic scripts after the React module has synchronously
    // mounted the DOM nodes they bind to. `defer` preserves their source order
    // and their shared global scope.
    .map(([, src]) => `<script defer src="${src}"></script>`)
    .join('\n');
  const bodyClass = body[1].match(/\bclass="([^"]*)"/i)?.[1] || '';
  const apiConfig = apiUrl
    ? `<meta name="peerloop-api-url" content="${String(apiUrl).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char)}">`
    : '';
  const reloadScript = liveReload
    ? '<script defer src="/dist/js/liveReload.js"></script>'
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>${head}${apiConfig}</head>
<body class="${bodyClass}"><div id="root"></div>
<script type="module" src="/dist/app.js"></script>
${scripts}
${reloadScript}
</body>
</html>`;
}

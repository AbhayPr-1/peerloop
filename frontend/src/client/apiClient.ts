function resolvePeerLoopApiBaseUrl(): string {
  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const configuredApiUrl = document.querySelector('meta[name="peerloop-api-url"]')?.getAttribute('content');
  return (configuredApiUrl || window.PEERLOOP_API_URL
    || (isLocalHost ? `http://${window.location.hostname}:5001` : window.location.origin))
    .replace(/\/+$/, '');
}

const apiBaseUrl = resolvePeerLoopApiBaseUrl();
window.PeerLoopApi = Object.freeze(window.PeerLoopApiTransport.create(
  apiBaseUrl,
  (input, init) => fetch(input, init),
  () => new FormData()
));

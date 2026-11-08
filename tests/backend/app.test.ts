import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../../backend/app';

test('application composition preserves health and credentialed CORS contracts', async () => {
  const app = createApp({
    appOrigin: 'http://localhost:3000',
    databaseStatus: () => 'connected'
  });
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/health`;

  try {
    const response = await fetch(url, { headers: { Origin: 'http://localhost:3000' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    const csp = response.headers.get('content-security-policy') || '';
    assert.match(csp, /script-src 'self'/);
    const scriptPolicy = csp.match(/(?:^|;\s*)script-src\s+([^;]+)/)?.[1] || '';
    assert.doesNotMatch(scriptPolicy, /unsafe-inline|unsafe-eval/);
    const health = await response.json();
    assert.equal(health.status, 'ok');
    assert.equal(health.service, 'peerloop-backend');
    assert.equal(health.database, 'connected');
    assert.ok(Number.isFinite(Date.parse(health.timestamp)));
  } finally {
    server.close();
    await once(server, 'close');
  }
});

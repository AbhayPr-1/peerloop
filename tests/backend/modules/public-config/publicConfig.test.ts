import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createPublicConfigRouter } from '../../../../backend/modules/public-config';

test('public RPC config endpoint keeps its response and cache contract', async () => {
  const express = require('express');
  const app = express();
  app.use('/api/config', createPublicConfigRouter());
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/config/rpc-url`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=300');
    assert.deepEqual(await response.json(), {
      rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com'
    });

    const healthResponse = await fetch(`http://127.0.0.1:${address.port}/api/config/health`);
    assert.equal(healthResponse.status, 200);
    assert.equal(healthResponse.headers.get('cache-control'), 'no-store');
    const healthPayload = await healthResponse.json();
    assert.equal(healthPayload.status, 'ok');
    assert.equal(healthPayload.service, 'peerloop-backend');
    assert.ok(healthPayload.timestamp);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

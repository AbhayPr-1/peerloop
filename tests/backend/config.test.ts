import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBackendConfig } from '../../backend/config';

test('backend config supplies backward-compatible local defaults', () => {
  assert.deepEqual(createBackendConfig({}), {
    port: 5001,
    mongoUri: 'mongodb://127.0.0.1:27017/peerloop',
    appOrigin: 'http://localhost:3000',
    jwtSecret: undefined
  });
});

test('backend config reads explicit environment settings', () => {
  assert.deepEqual(createBackendConfig({
    PORT: '6200',
    MONGO_URI: 'mongodb://database/peerloop',
    APP_ORIGIN: 'https://marketplace.example',
    JWT_SECRET: 'test-secret'
  }), {
    port: 6200,
    mongoUri: 'mongodb://database/peerloop',
    appOrigin: 'https://marketplace.example',
    jwtSecret: 'test-secret'
  });
});

test('backend config rejects invalid ports at startup', () => {
  for (const PORT of ['0', '65536', 'not-a-port', '1.5']) {
    assert.throws(() => createBackendConfig({ PORT }), /PORT must be a valid TCP port/);
  }
});

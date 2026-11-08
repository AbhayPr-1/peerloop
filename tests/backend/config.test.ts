import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBackendConfig } from '../../backend/config';

test('backend config supplies backward-compatible local defaults', () => {
  assert.deepEqual(createBackendConfig({}), {
    port: 5001,
    mongoUri: 'mongodb://127.0.0.1:27017/peerloop',
    appOrigin: 'http://localhost:3000',
    jwtSecret: undefined,
    isProduction: false,
    chainRpcUrl: undefined,
    contractAddress: undefined,
    pinata: { apiKey: undefined, apiSecret: undefined, jwt: undefined }
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
    jwtSecret: 'test-secret',
    isProduction: false,
    chainRpcUrl: undefined,
    contractAddress: undefined,
    pinata: { apiKey: undefined, apiSecret: undefined, jwt: undefined }
  });
});

test('backend config centralizes chain aliases and storage credentials', () => {
  const config = createBackendConfig({
    SEPOLIA_RPC_URL: ' https://rpc.primary.test ',
    RPC_URL: 'https://rpc.legacy.test',
    CONTRACT_ADDRESS: ' 0x0000000000000000000000000000000000000001 ',
    PINATA_API_KEY: ' key ',
    PINATA_API_SECRET: ' secret ',
    PINATA_JWT: ' jwt '
  });
  assert.equal(config.chainRpcUrl, 'https://rpc.primary.test');
  assert.equal(config.contractAddress, '0x0000000000000000000000000000000000000001');
  assert.deepEqual(config.pinata, { apiKey: 'key', apiSecret: 'secret', jwt: 'jwt' });

  assert.equal(createBackendConfig({ RPC_URL: 'https://rpc.legacy.test' }).chainRpcUrl, 'https://rpc.legacy.test');
  assert.equal(createBackendConfig({ SEPOLIA_RPC: 'https://rpc.old.test' }).chainRpcUrl, 'https://rpc.old.test');
});

test('backend config rejects invalid ports at startup', () => {
  for (const PORT of ['0', '65536', 'not-a-port', '1.5']) {
    assert.throws(() => createBackendConfig({ PORT }), /PORT must be a valid TCP port/);
  }
});

test('production config requires explicit database and frontend origins', () => {
  const production = { NODE_ENV: 'production', JWT_SECRET: 'test-secret' };
  assert.throws(() => createBackendConfig(production), /MONGO_URI must be explicitly configured/);
  assert.throws(() => createBackendConfig({
    ...production,
    MONGO_URI: 'mongodb://database/peerloop'
  }), /APP_ORIGIN must be explicitly configured/);
  assert.equal(createBackendConfig({
    ...production,
    MONGO_URI: 'mongodb://database/peerloop',
    APP_ORIGIN: 'https://marketplace.example'
  }).isProduction, true);
});

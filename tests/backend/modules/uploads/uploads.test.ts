import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import {
  createUploadRouter,
  createUploadService,
  isValidImage
} from '../../../../backend/modules/uploads';
import { createPinataStorage } from '../../../../backend/modules/uploads/pinataStorage';

test('upload module validates image signatures and preserves the authenticated upload contract', async () => {
  assert.equal(isValidImage(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg'), true);
  assert.equal(
    isValidImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'),
    true
  );
  assert.equal(isValidImage(Buffer.from('GIF89a'), 'image/gif'), true);
  assert.equal(
    isValidImage(Buffer.from('RIFF0000WEBP'), 'image/webp'),
    true
  );
  assert.equal(isValidImage(Buffer.from('not an image'), 'image/png'), false);

  const uploaded: Array<{ buffer: Buffer; filename: string }> = [];
  const uploadService = createUploadService({
    createStorage: () => ({
      async pinImage(buffer, filename) {
        uploaded.push({ buffer, filename });
        return 'bafy-test-hash';
      }
    })
  });

  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'upload-test-secret';
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({
    authVersion: 2,
    user: { id: 'user-1', name: 'Test User', walletAddress: '0x0000000000000000000000000000000000000001' }
  }, process.env.JWT_SECRET);

  const express = require('express');
  const app = express();
  app.use('/api/upload', createUploadRouter(uploadService));
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/upload`;

  try {
    const unauthorized = await fetch(url, { method: 'POST' });
    assert.equal(unauthorized.status, 401);

    const legacyHeader = await fetch(url, {
      method: 'POST',
      headers: { 'x-auth-token': token, Origin: 'http://localhost:3000' }
    });
    assert.equal(legacyHeader.status, 401);

    const crossOriginWrite = await fetch(url, {
      method: 'POST',
      headers: { Cookie: `peerloop_session=${token}`, Origin: 'https://attacker.example' }
    });
    assert.equal(crossOriginWrite.status, 403);

    const invalidForm = new FormData();
    invalidForm.append('productImage', new Blob(['not a png'], { type: 'image/png' }), 'bad.png');
    const invalidImage = await fetch(url, {
      method: 'POST',
      headers: { Cookie: `peerloop_session=${token}`, Origin: 'http://localhost:3000' },
      body: invalidForm
    });
    assert.equal(invalidImage.status, 400);
    assert.equal((await invalidImage.json()).msg, 'Upload a valid JPEG, PNG, GIF, or WebP image.');

    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const validForm = new FormData();
    validForm.append('productImage', new Blob([imageBytes], { type: 'image/png' }), 'listing.png');
    const uploadedResponse = await fetch(url, {
      method: 'POST',
      headers: { Cookie: `peerloop_session=${token}`, Origin: 'http://localhost:3000' },
      body: validForm
    });
    assert.equal(uploadedResponse.status, 200);
    assert.deepEqual(await uploadedResponse.json(), {
      imageUrl: 'ipfs://bafy-test-hash',
      ipfsHash: 'bafy-test-hash'
    });
    assert.equal(uploaded.length, 1);
    assert.equal(uploaded[0].filename, 'listing.png');
    assert.deepEqual(uploaded[0].buffer, imageBytes);
  } finally {
    server.close();
    await once(server, 'close');
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test('upload service reports unavailable storage explicitly', async () => {
  const uploadService = createUploadService({ createStorage: () => null });
  await assert.rejects(
    uploadService.uploadImage(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      'image/png',
      'listing.png'
    ),
    (error: Error & { statusCode?: number }) => error.statusCode === 503
  );
});

test('Pinata storage uploads files with the existing API-key credentials and metadata', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.PINATA_API_KEY;
  const originalApiSecret = process.env.PINATA_API_SECRET;
  const originalJwt = process.env.PINATA_JWT;
  process.env.PINATA_API_KEY = 'test-api-key';
  process.env.PINATA_API_SECRET = 'test-api-secret';
  delete process.env.PINATA_JWT;

  globalThis.fetch = async (input, init) => {
    assert.equal(input, 'https://api.pinata.cloud/pinning/pinFileToIPFS');
    assert.equal(init?.method, 'POST');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('pinata_api_key'), 'test-api-key');
    assert.equal(headers.get('pinata_secret_api_key'), 'test-api-secret');

    const body = init?.body;
    assert.ok(body instanceof FormData);
    assert.equal(body.get('pinataMetadata'), JSON.stringify({ name: 'listing.png' }));
    const file = body.get('file');
    assert.ok(file instanceof Blob);
    assert.equal((file as File).name, 'listing.png');
    assert.deepEqual(
      new Uint8Array(await file.arrayBuffer()),
      new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    );
    return Response.json({ IpfsHash: 'bafy-pinata-test' });
  };

  try {
    const storage = createPinataStorage();
    assert.ok(storage);
    assert.equal(
      await storage.pinImage(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'listing.png'),
      'bafy-pinata-test'
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.PINATA_API_KEY;
    else process.env.PINATA_API_KEY = originalApiKey;
    if (originalApiSecret === undefined) delete process.env.PINATA_API_SECRET;
    else process.env.PINATA_API_SECRET = originalApiSecret;
    if (originalJwt === undefined) delete process.env.PINATA_JWT;
    else process.env.PINATA_JWT = originalJwt;
  }
});

test('Pinata storage continues to support JWT credentials', async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.PINATA_API_KEY;
  const originalApiSecret = process.env.PINATA_API_SECRET;
  const originalJwt = process.env.PINATA_JWT;
  delete process.env.PINATA_API_KEY;
  delete process.env.PINATA_API_SECRET;
  process.env.PINATA_JWT = 'test-jwt';

  globalThis.fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization'), 'Bearer test-jwt');
    return Response.json({ IpfsHash: 'bafy-jwt-test' });
  };

  try {
    const storage = createPinataStorage();
    assert.ok(storage);
    assert.equal(
      await storage.pinImage(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'listing.png'),
      'bafy-jwt-test'
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.PINATA_API_KEY;
    else process.env.PINATA_API_KEY = originalApiKey;
    if (originalApiSecret === undefined) delete process.env.PINATA_API_SECRET;
    else process.env.PINATA_API_SECRET = originalApiSecret;
    if (originalJwt === undefined) delete process.env.PINATA_JWT;
    else process.env.PINATA_JWT = originalJwt;
  }
});

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import {
  createUploadRouter,
  createUploadService,
  isValidImage
} from '../../../../backend/modules/uploads';

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

    const invalidForm = new FormData();
    invalidForm.append('productImage', new Blob(['not a png'], { type: 'image/png' }), 'bad.png');
    const invalidImage = await fetch(url, {
      method: 'POST',
      headers: { 'x-auth-token': token },
      body: invalidForm
    });
    assert.equal(invalidImage.status, 400);
    assert.equal((await invalidImage.json()).msg, 'Upload a valid JPEG, PNG, GIF, or WebP image.');

    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const validForm = new FormData();
    validForm.append('productImage', new Blob([imageBytes], { type: 'image/png' }), 'listing.png');
    const uploadedResponse = await fetch(url, {
      method: 'POST',
      headers: { 'x-auth-token': token },
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

import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createAuthRouter, createAuthService, type AuthUser, type AuthUserRepository } from '../../../../backend/modules/auth';

const walletAddress = '0x0000000000000000000000000000000000000001';
const otherWalletAddress = '0x0000000000000000000000000000000000000002';

test('wallet authentication routes preserve challenge, login, and rate-limit contracts', async () => {
  const users = new Map<string, AuthUser>();
  let nextUserId = 0;
  let nonceIndex = 0;
  let currentTime = new Date('2026-01-01T00:00:00.000Z');

  const repository: AuthUserRepository = {
    async findByWallet(address, includeChallenge = false) {
      const user = [...users.values()].find((candidate) =>
        candidate.walletAddress.toLowerCase() === address.toLowerCase()
      );
      if (!user) return null;
      return includeChallenge ? { ...user } : {
        id: user.id,
        name: user.name,
        walletAddress: user.walletAddress
      };
    },
    async createUser(name, address) {
      const user = { id: String(++nextUserId), name, walletAddress: address };
      users.set(user.id, user);
      return { ...user };
    },
    async saveChallenge(userId, nonce, expiresAt) {
      const user = users.get(userId);
      assert.ok(user);
      user.loginNonce = nonce;
      user.loginNonceExpiresAt = expiresAt;
    },
    async consumeChallenge(userId, nonce, now) {
      const user = users.get(userId);
      if (!user || user.loginNonce !== nonce || !user.loginNonceExpiresAt || user.loginNonceExpiresAt <= now) {
        return null;
      }
      user.loginNonce = null;
      user.loginNonceExpiresAt = null;
      return { ...user };
    }
  };

  const authService = createAuthService({
    users: repository,
    appOrigin: 'http://localhost:3000',
    jwtSecret: 'test-secret',
    now: () => new Date(currentTime),
    createNonce: () => `test-nonce-${++nonceIndex}`,
    verifyMessage: (_message, signature) => {
      if (signature === 'invalid') throw new Error('Invalid signature');
      return signature === 'valid' ? walletAddress : otherWalletAddress;
    },
    signToken: async () => 'test-token'
  });

  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter(authService));
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}/api/auth`;

  try {
    const invalidAddress = await fetch(`${baseUrl}/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: 'invalid' })
    });
    assert.equal(invalidAddress.status, 400);
    assert.equal((await invalidAddress.json()).msg, 'A valid wallet address is required.');

    const challengeResponse = await fetch(`${baseUrl}/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress })
    });
    assert.equal(challengeResponse.status, 200);
    assert.equal(challengeResponse.headers.get('cache-control'), 'no-store');
    const challenge = await challengeResponse.json();
    assert.match(challenge.message, /PeerLoop sign-in request/);
    assert.match(challenge.message, /Origin: http:\/\/localhost:3000/);
    assert.match(challenge.message, new RegExp(`Address: ${walletAddress}`));

    const missingSignature = await fetch(`${baseUrl}/metamask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress })
    });
    assert.equal(missingSignature.status, 400);

    const invalidSignature = await fetch(`${baseUrl}/metamask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, signature: 'invalid' })
    });
    assert.equal(invalidSignature.status, 401);
    assert.equal((await invalidSignature.json()).msg, 'Wallet signature is not valid.');

    const wrongWalletSignature = await fetch(`${baseUrl}/metamask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, signature: 'wrong-wallet' })
    });
    assert.equal(wrongWalletSignature.status, 401);
    assert.equal((await wrongWalletSignature.json()).msg, 'Wallet signature does not match the requested address.');

    const loginResponse = await fetch(`${baseUrl}/metamask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, signature: 'valid' })
    });
    assert.equal(loginResponse.status, 200);
    assert.deepEqual(await loginResponse.json(), {
      token: 'test-token',
      user: {
        id: '1',
        name: 'User-000000-test-nonce-1',
        walletAddress
      }
    });

    const replayResponse = await fetch(`${baseUrl}/metamask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, signature: 'valid' })
    });
    assert.equal(replayResponse.status, 401);
    assert.equal((await replayResponse.json()).msg, 'Sign-in challenge expired. Please try again.');

    await fetch(`${baseUrl}/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress })
    });
    currentTime = new Date(currentTime.getTime() + 5 * 60 * 1000);
    const expiredChallenge = await fetch(`${baseUrl}/metamask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, signature: 'valid' })
    });
    assert.equal(expiredChallenge.status, 401);

    for (let request = 0; request < 7; request += 1) {
      await fetch(`${baseUrl}/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });
    }
    const rateLimited = await fetch(`${baseUrl}/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress })
    });
    assert.equal(rateLimited.status, 429);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

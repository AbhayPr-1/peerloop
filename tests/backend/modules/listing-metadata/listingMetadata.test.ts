import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import {
  createListingMetadataRouter,
  createListingMetadataService,
  type ListingCategory
} from '../../../../backend/modules/listing-metadata';

const walletAddress = '0x0000000000000000000000000000000000000001';
const otherWalletAddress = '0x0000000000000000000000000000000000000002';
const contractAddress = '0x0000000000000000000000000000000000000020';

test('listing metadata routes preserve category reads and owner-verified writes', async () => {
  let configuredContract: string | null = null;
  let rpcUrl: string | undefined;
  let listingOwner = walletAddress;
  const records = new Map<string, ListingCategory>([['7', 'electronics']]);
  const writes: Array<{ contract: string; id: string; seller: string; category: ListingCategory }> = [];
  const service = createListingMetadataService({
    repository: {
      async list() {
        return [...records].map(([productId, category]) => ({ productId, category }));
      },
      async save(contract, productId, sellerWallet, category) {
        writes.push({ contract, id: productId, seller: sellerWallet, category });
        records.set(productId, category);
      }
    },
    marketplace: {
      async getProductSeller() {
        return listingOwner;
      }
    },
    getContractAddress: () => configuredContract,
    getRpcUrl: () => rpcUrl
  });

  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'listing-metadata-test-secret';
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({
    authVersion: 2,
    user: { id: 'user-1', name: 'Test User', walletAddress }
  }, process.env.JWT_SECRET);

  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/listing-metadata', createListingMetadataRouter(service));
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/listing-metadata`;
  const postCategory = (body: object, authToken = token) => fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      ...(authToken ? { Cookie: `peerloop_session=${authToken}` } : {})
    },
    body: JSON.stringify(body)
  });

  try {
    const unconfigured = await fetch(url);
    assert.equal(unconfigured.status, 503);

    configuredContract = contractAddress;
    const categories = await fetch(url);
    assert.equal(categories.status, 200);
    assert.equal(categories.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await categories.json(), { '7': 'electronics' });

    const unauthorized = await postCategory({ productId: '8', category: 'gadgets' }, '');
    assert.equal(unauthorized.status, 401);

    const invalidProduct = await postCategory({ productId: '0', category: 'gadgets' });
    assert.equal(invalidProduct.status, 400);

    const noRpc = await postCategory({ productId: '8', category: 'gadgets' });
    assert.equal(noRpc.status, 503);

    rpcUrl = 'https://rpc.example';
    listingOwner = otherWalletAddress;
    const wrongOwner = await postCategory({ productId: '8', category: 'gadgets' });
    assert.equal(wrongOwner.status, 403);
    assert.equal((await wrongOwner.json()).msg, 'You can only set the category for your own listing.');

    listingOwner = walletAddress;
    const saved = await postCategory({ productId: '8', category: 'wearables' });
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { productId: '8', category: 'wearables' });
    assert.deepEqual(writes, [{
      contract: contractAddress,
      id: '8',
      seller: walletAddress,
      category: 'wearables'
    }]);
  } finally {
    server.close();
    await once(server, 'close');
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

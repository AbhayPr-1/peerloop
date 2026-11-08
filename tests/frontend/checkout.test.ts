import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

interface CheckoutResult {
  item: { _id: string; name: string };
  status: 'success' | 'failed';
  transactionHash?: string;
  error?: string;
}

interface CheckoutApi {
  processItems(
    items: Array<{ _id: string; name: string }>,
    purchaseItem: (item: { _id: string; name: string }) => Promise<{ transactionHash?: string }>
  ): Promise<CheckoutResult[]>;
}

function loadCheckoutApi(): CheckoutApi {
  const windowObject: { PeerLoopCheckout?: CheckoutApi } = {};
  const scriptPath = path.join(process.cwd(), 'frontend', 'dist', 'js', 'cart.js');
  runInNewContext(readFileSync(scriptPath, 'utf8'), {
    window: windowObject,
    console,
    setTimeout
  });
  assert.ok(windowObject.PeerLoopCheckout);
  return windowObject.PeerLoopCheckout;
}

test('cart checkout records each result and continues after an individual transaction fails', async () => {
  const checkout = loadCheckoutApi();
  const items = [
    { _id: '1', name: 'First item' },
    { _id: '2', name: 'Second item' },
    { _id: '3', name: 'Third item' }
  ];
  const results = await checkout.processItems(items, async item => {
    if (item.name === 'Second item') throw new Error('wallet rejected');
    return { transactionHash: `0x${'a'.repeat(64)}` };
  });

  assert.deepEqual(Array.from(results, result => result.status), ['success', 'failed', 'success']);
  assert.equal(results[0].transactionHash, `0x${'a'.repeat(64)}`);
  assert.equal(results[1].error, 'wallet rejected');
});

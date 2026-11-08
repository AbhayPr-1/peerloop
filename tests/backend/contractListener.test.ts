import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { test } from 'node:test';

const startContractListener = require('../../backend/contractListener');
const silentLogger = { log() {}, warn() {}, error() {} };

test('contract listener emits the existing product_updated payload and stops its provider', async () => {
  const io = new EventEmitter();
  const emitted = once(io, 'product_updated');
  const queriedRanges: Array<[string, number, number]> = [];
  let blockNumberCalls = 0;
  let providerDestroyed = false;
  let intervalCleared = false;
  let intervalHandle: unknown;
  const scheduler = {
    setInterval(callback: () => void) {
      intervalHandle = callback;
      return intervalHandle;
    },
    clearInterval(handle: unknown) {
      intervalCleared = handle === intervalHandle;
    },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis)
  };
  const event = {
    transactionHash: '0xabc',
    index: 4,
    args: { id: 8n, name: 'Test listing', escrowId: null }
  };
  const listener = startContractListener(io, {
    rpcUrl: 'https://rpc.test.invalid',
    contractAddress: '0x0000000000000000000000000000000000000001',
    pollIntervalMs: 60_000,
    lookbackBlocks: 3,
    maxBlockRange: 10,
    provider: {
      async getBlockNumber() {
        blockNumberCalls += 1;
        return blockNumberCalls === 1 ? 100 : 101;
      },
      destroy() { providerDestroyed = true; }
    },
    contract: {
      async queryFilter(name: string, from: number, to: number) {
        queriedRanges.push([name, from, to]);
        return name === 'ProductSold' ? [event] : [];
      }
    },
    logger: silentLogger,
    scheduler
  });

  try {
    let timeoutHandle: NodeJS.Timeout | undefined;
    let result: unknown[];
    try {
      result = await Promise.race([
        emitted,
        new Promise<never>((_resolve, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error('Listener did not emit')), 2_000);
        })
      ]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
    const [payload] = result;
    assert.deepEqual(payload, {
      type: 'sold', id: '8', name: 'Test listing', escrowId: null,
      tx: '0xabc', logIndex: 4
    });
    assert.ok(queriedRanges.length >= 7);
    assert.ok(queriedRanges.every(([, from, to]) => from === 97 && to === 101));
  } finally {
    listener.stop();
  }

  assert.equal(providerDestroyed, true);
  assert.equal(intervalCleared, true);
});

test('contract listener safely remains disabled for missing or placeholder configuration', () => {
  const logger = { ...silentLogger, warnings: 0, warn() { this.warnings += 1; } };
  const listener = startContractListener(new EventEmitter(), {
    rpcUrl: '',
    contractAddress: '',
    logger
  });
  assert.equal(logger.warnings, 1);
  assert.doesNotThrow(() => listener.stop());
});

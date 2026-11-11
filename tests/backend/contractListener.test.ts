import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { test } from 'node:test';

const startContractListener = require('../../backend/contractListener');
const silentLogger = { log() {}, warn() {}, error() {} };

test('contract listener emits the existing product_updated payload and stops its provider', async () => {
  const io = new EventEmitter();
  const emitted = once(io, 'product_updated');
  const queriedRanges: Array<[string, number, number]> = [];
  let activeQueries = 0;
  let maxConcurrentQueries = 0;
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
        activeQueries += 1;
        maxConcurrentQueries = Math.max(maxConcurrentQueries, activeQueries);
        try {
          await new Promise<void>((resolve) => setImmediate(resolve));
          queriedRanges.push([name, from, to]);
          return name === 'ProductSold' ? [event] : [];
        } finally {
          activeQueries -= 1;
        }
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
    assert.equal(maxConcurrentQueries, 7);
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

test('contract listener prefers WSS subscriptions and restores HTTP polling on disconnect', async () => {
  const io = new EventEmitter();
  const eventHandlers = new Map<string, (...args: any[]) => void>();
  const blockHandlers = new Map<string, (...args: any[]) => void>();
  const intervalHandles = new Set<{ callback: () => void }>();
  let activeIntervals = 0;
  let webSocketProviderDestroyed = false;
  let httpProviderDestroyed = false;

  const scheduler = {
    setInterval(callback: () => void) {
      const handle = { callback };
      intervalHandles.add(handle);
      activeIntervals += 1;
      return handle;
    },
    clearInterval(handle: { callback: () => void }) {
      if (intervalHandles.delete(handle)) activeIntervals -= 1;
    },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis)
  };

  const websocket = new EventEmitter() as EventEmitter & {
    addEventListener: (name: string, handler: (...args: any[]) => void) => void;
    removeEventListener: (name: string, handler: (...args: any[]) => void) => void;
  };
  websocket.addEventListener = (name, handler) => { websocket.on(name, handler); };
  websocket.removeEventListener = (name, handler) => { websocket.off(name, handler); };

  const webSocketProvider = {
    websocket,
    async getBlockNumber() { return 101; },
    async on(name: string, handler: (...args: any[]) => void) {
      blockHandlers.set(name, handler);
      return this;
    },
    async off(name: string) {
      blockHandlers.delete(name);
      return this;
    },
    destroy() {
      webSocketProviderDestroyed = true;
      websocket.emit('close');
    }
  };
  const webSocketContract = {
    async on(name: string, handler: (...args: any[]) => void) {
      eventHandlers.set(name, handler);
      return this;
    },
    async off(name: string) {
      eventHandlers.delete(name);
      return this;
    }
  };

  const listener = startContractListener(io, {
    rpcUrl: 'https://rpc.test.invalid',
    wssUrl: 'wss://rpc.test.invalid',
    contractAddress: '0x0000000000000000000000000000000000000001',
    pollIntervalMs: 60_000,
    provider: {
      async getBlockNumber() { return 101; },
      async destroy() { httpProviderDestroyed = true; }
    },
    contract: { async queryFilter() { return []; } },
    webSocketProvider,
    webSocketContract,
    logger: silentLogger,
    scheduler
  });

  try {
    for (let attempt = 0; attempt < 100 && !eventHandlers.has('ProductListed'); attempt += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    assert.ok(eventHandlers.has('ProductListed'), 'WSS event subscriptions should be installed');
    assert.equal(activeIntervals, 0, 'HTTP polling should pause while WSS is active');

    const emitted = once(io, 'product_updated');
    eventHandlers.get('ProductListed')?.('9', 'WSS listing', 1n, 'ipfs://image', '0xabc', {
      transactionHash: '0xwss',
      index: 2,
      blockNumber: 102,
      args: { id: 9n, name: 'WSS listing' }
    });
    const [payload] = await emitted;
    assert.deepEqual(payload, {
      type: 'listed', id: '9', name: 'WSS listing', escrowId: null,
      tx: '0xwss', logIndex: 2
    });

    const eventCases = [
      ['ProductListed', 'listed', { id: 10n, name: 'Listed item' }],
      ['ProductSold', 'sold', { id: 11n, name: 'Sold item' }],
      ['ProductDeleted', 'deleted', { id: 12n, name: 'Deleted item' }],
      ['EscrowRefunded', 'refunded', { productId: 13n, escrowId: 103n }],
      ['EscrowReleased', 'released', { productId: 14n, escrowId: 104n }],
      ['EscrowDisputed', 'disputed', { productId: 15n, escrowId: 105n }],
      ['EscrowResolutionVoted', 'vote', { productId: 16n, escrowId: 106n }]
    ] as const;
    for (const [eventName, type, args] of eventCases) {
      const nextUpdate = once(io, 'product_updated');
      eventHandlers.get(eventName)?.('0xignored', {
        transactionHash: `0x${type}`,
        index: 3,
        args
      });
      const [update] = await nextUpdate;
      assert.deepEqual(update, {
        type,
        id: String('id' in args ? args.id : args.productId),
        name: 'name' in args ? args.name : null,
        escrowId: 'escrowId' in args ? String(args.escrowId) : null,
        tx: `0x${type}`,
        logIndex: 3
      });
    }

    websocket.emit('close');
    assert.equal(activeIntervals, 1, 'HTTP polling should resume after WSS disconnects');
  } finally {
    listener.stop();
  }

  assert.equal(activeIntervals, 0);
  assert.equal(webSocketProviderDestroyed, true);
  assert.equal(httpProviderDestroyed, true);
});

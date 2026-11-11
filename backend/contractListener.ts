// backend/contractListener.ts
// WSS-first contract event listener with HTTP RPC polling fallback and event deduplication.
const { ethers } = require('ethers');
const config = require('./config').default;

const RPC_URL = config.chainRpcUrl;
const WSS_URL = config.chainWssUrl;
const CONTRACT_ADDRESS = config.contractAddress;

function hasPlaceholderRpcUrl(url) {
  return typeof url !== 'string' || !url.trim() || url.includes('your_alchemy_key') || url.includes('your_') || url.includes('example') || url.includes('placeholder');
}

if (!RPC_URL) console.error('Missing SEPOLIA_RPC_URL in backend/.env');
if (hasPlaceholderRpcUrl(RPC_URL)) console.warn('SEPOLIA_RPC_URL is unset or still using a placeholder value. Contract listener will be skipped until a valid RPC URL is configured.');
if (!CONTRACT_ADDRESS) console.error('Missing CONTRACT_ADDRESS in backend/.env');

/* ABI (events + useful functions) */
const MARKETPLACE_ABI = [
  'event ProductDeleted(uint256 id, string name, address seller)',
  'event ProductListed(uint256 id, string name, uint256 price, string imageUrl, address seller)',
  'event ProductSold(uint256 id, string name, uint256 price, address seller, address buyer)',
  'event EscrowRefunded(uint256 escrowId, uint256 productId, address buyer, uint256 amount)',
  'event EscrowReleased(uint256 escrowId, uint256 productId, address seller, uint256 amount)',
  'event EscrowDisputed(uint256 escrowId, uint256 productId, address initiator)',
  'event EscrowResolutionVoted(uint256 escrowId, uint256 productId, address voter, bool releaseToSeller, uint8 votes)',
];

const MARKETPLACE_EVENTS = [
  ['ProductListed', 'listed'],
  ['ProductSold', 'sold'],
  ['ProductDeleted', 'deleted'],
  ['EscrowRefunded', 'refunded'],
  ['EscrowReleased', 'released'],
  ['EscrowDisputed', 'disputed'],
  ['EscrowResolutionVoted', 'vote']
];

/* Utilities */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/*
  startContractListener(io, opts)
  opts:
    - pollIntervalMs (ms) default 3000; used only when WSS is unavailable
    - lookbackBlocks default 2 (small lookback helps avoid missing reorgs)
    - dedupeCacheSize default 1000 (how many unique logs to remember)
*/
interface ListenerOptions {
  pollIntervalMs?: number;
  lookbackBlocks?: number;
  maxBlockRange?: number;
  dedupeCacheSize?: number;
  rpcUrl?: string;
  wssUrl?: string;
  contractAddress?: string;
  provider?: any;
  contract?: any;
  webSocketProvider?: any;
  webSocketContract?: any;
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
  scheduler?: Pick<typeof globalThis, 'setInterval' | 'clearInterval' | 'setTimeout' | 'clearTimeout'>;
}

function startContractListener(io, opts: ListenerOptions = {}) {
  const rpcUrl = opts.rpcUrl ?? RPC_URL;
  const contractAddress = opts.contractAddress ?? CONTRACT_ADDRESS;
  const logger = opts.logger || console;
  const scheduler = opts.scheduler || globalThis;
  const pollIntervalMs = opts.pollIntervalMs || 3000;
  const lookbackBlocks = typeof opts.lookbackBlocks === 'number' ? opts.lookbackBlocks : 2;
  const maxBlockRange = Number.isInteger(opts.maxBlockRange) && opts.maxBlockRange > 0
    ? opts.maxBlockRange
    : 10;
  const dedupeCacheSize = opts.dedupeCacheSize || 1000;
  const configuredWssUrl = opts.wssUrl ?? (opts.rpcUrl ? undefined : WSS_URL);
  const wssUrl = typeof configuredWssUrl === 'string'
    && /^wss?:\/\//i.test(configuredWssUrl)
    && !hasPlaceholderRpcUrl(configuredWssUrl)
    ? configuredWssUrl
    : undefined;

  if (configuredWssUrl && !wssUrl) {
    logger.warn('WebSocket RPC URL must be a valid ws:// or wss:// endpoint. Continuing with HTTP RPC polling.');
  }

  if (!rpcUrl || !contractAddress || hasPlaceholderRpcUrl(rpcUrl)) {
    logger.warn('Contract listener not started: missing or placeholder RPC_URL/CONTRACT_ADDRESS.');
    return { stop: () => {} };
  }

  const provider = opts.provider || new ethers.JsonRpcProvider(rpcUrl);
  const contract = opts.contract || new ethers.Contract(contractAddress, MARKETPLACE_ABI, provider);

  let stopped = false;
  let pollHandle = null;
  let startupPollHandle = null;
  let reconnectHandle = null;
  let pollInProgress = false;
  let lastChecked = null; // last fully-processed block number
  let reconnectDelayMs = 1000;
  let connectingWebSocket = false;
  let pendingWebSocketProvider = null;
  let pendingWebSocketContract = null;

  let activeWebSocketProvider = null;
  let activeWebSocketContract = null;
  let activeWebSocketListeners = [];
  let activeBlockListener = null;
  let activeSocketCloseCleanup = null;

  // dedupeSet stores keys "txHash:logIndex". The insertion-order cap bounds memory.
  const dedupeSet = new Set();

  function addDedupe(key) {
    if (dedupeSet.has(key)) return false;
    dedupeSet.add(key);
    if (dedupeSet.size > dedupeCacheSize) {
      const first = dedupeSet.values().next().value;
      if (first) dedupeSet.delete(first);
    }
    return true;
  }

  function processEvents(events, type) {
    for (const ev of events) {
      const tx = ev.transactionHash || (ev.transaction && ev.transaction.hash) || '';
      const logIndex = ev.index ?? ev.logIndex ?? ev.transactionIndex ?? 0;
      const dedupeKey = `${tx}:${logIndex}`;
      if (!addDedupe(dedupeKey)) continue;

      let id = null, name = null, escrowId = null;
      try {
        if (ev.args) {
          const eventId = ev.args.id ?? ev.args.productId;
          id = eventId == null ? null : eventId.toString();
          name = ev.args.name ?? null;
          escrowId = ev.args.escrowId == null ? null : ev.args.escrowId.toString();
        }
      } catch (error) {
        logger.warn('Error reading contract event args', error);
      }

      logger.log(`[CONTRACT EVENT] ${type} tx=${tx} logIndex=${logIndex} id=${id} name=${name}`);
      io.emit('product_updated', { type, id, name, escrowId, tx, logIndex });
    }
  }

  function startHttpPolling() {
    if (stopped || pollHandle) return;
    pollHandle = scheduler.setInterval(pollOnce, pollIntervalMs);
    startupPollHandle = scheduler.setTimeout(() => {
      startupPollHandle = null;
      void pollOnce();
    }, 200);
  }

  function stopHttpPolling() {
    if (pollHandle) {
      scheduler.clearInterval(pollHandle);
      pollHandle = null;
    }
    if (startupPollHandle) {
      scheduler.clearTimeout(startupPollHandle);
      startupPollHandle = null;
    }
  }

  function removeSocketCloseListener(provider, cleanup) {
    if (cleanup) {
      try { cleanup(); } catch (_) {}
      return;
    }
    try {
      const socket = provider && provider.websocket;
      if (socket && typeof socket.removeEventListener === 'function' && activeSocketCloseCleanup) {
        socket.removeEventListener('close', activeSocketCloseCleanup);
      } else if (socket && typeof socket.off === 'function' && activeSocketCloseCleanup) {
        socket.off('close', activeSocketCloseCleanup);
      }
    } catch (_) {}
  }

  function cleanupWebSocket(provider, wsContract, listeners, blockListener, closeCleanup) {
    removeSocketCloseListener(provider, closeCleanup);
    for (const [eventName, listener] of listeners || []) {
      try { Promise.resolve(wsContract.off(eventName, listener)).catch(() => {}); } catch (_) {}
    }
    if (blockListener) {
      try { Promise.resolve(provider.off('block', blockListener)).catch(() => {}); } catch (_) {}
    }
    try { provider.destroy(); } catch (_) {}
  }

  function detachActiveWebSocket() {
    const resources = {
      provider: activeWebSocketProvider,
      contract: activeWebSocketContract,
      listeners: activeWebSocketListeners,
      blockListener: activeBlockListener,
      closeCleanup: activeSocketCloseCleanup
    };
    activeWebSocketProvider = null;
    activeWebSocketContract = null;
    activeWebSocketListeners = [];
    activeBlockListener = null;
    activeSocketCloseCleanup = null;
    return resources;
  }

  function scheduleWebSocketReconnect() {
    if (stopped || !wssUrl || reconnectHandle || activeWebSocketProvider) return;
    const delayMs = Math.floor(reconnectDelayMs * (0.5 + Math.random() * 0.5));
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30000);
    reconnectHandle = scheduler.setTimeout(() => {
      reconnectHandle = null;
      void connectWebSocket();
    }, delayMs);
  }

  function handleWebSocketClose(provider) {
    if (stopped || activeWebSocketProvider !== provider) return;
    logger.warn('Sepolia WSS connection closed. Falling back to HTTP RPC and retrying WSS.');
    const resources = detachActiveWebSocket();
    cleanupWebSocket(resources.provider, resources.contract, resources.listeners, resources.blockListener, resources.closeCleanup);
    startHttpPolling();
    scheduleWebSocketReconnect();
  }

  async function waitForPollToFinish() {
    while (pollInProgress && !stopped) await sleep(20);
  }

  async function connectWebSocket() {
    if (stopped || !wssUrl || connectingWebSocket || activeWebSocketProvider) return false;
    connectingWebSocket = true;
    let candidateProvider = null;
    let candidateContract = null;
    const candidateListeners = [];
    let candidateBlockListener = null;
    let candidateCloseCleanup = null;

    try {
      candidateProvider = opts.webSocketProvider || new ethers.WebSocketProvider(wssUrl);
      candidateContract = opts.webSocketContract || new ethers.Contract(contractAddress, MARKETPLACE_ABI, candidateProvider);
      pendingWebSocketProvider = candidateProvider;
      pendingWebSocketContract = candidateContract;

      let readyTimeout;
      try {
        await Promise.race([
          candidateProvider.getBlockNumber(),
          new Promise((_, reject) => {
            readyTimeout = scheduler.setTimeout(() => reject(new Error('WSS RPC did not respond in time.')), 7000);
          })
        ]);
      } finally {
        if (readyTimeout) scheduler.clearTimeout(readyTimeout);
      }
      if (stopped) throw new Error('Contract listener stopped during WSS startup.');

      activeWebSocketProvider = candidateProvider;
      activeWebSocketContract = candidateContract;
      activeWebSocketListeners = candidateListeners;

      const socket = candidateProvider.websocket;
      const closeHandler = () => handleWebSocketClose(candidateProvider);
      if (socket && typeof socket.addEventListener === 'function') {
        socket.addEventListener('close', closeHandler);
        candidateCloseCleanup = () => socket.removeEventListener('close', closeHandler);
      } else if (socket && typeof socket.on === 'function') {
        socket.on('close', closeHandler);
        candidateCloseCleanup = () => socket.off('close', closeHandler);
      } else {
        throw new Error('The WSS transport does not expose a close event.');
      }
      activeSocketCloseCleanup = candidateCloseCleanup;

      const subscriptionPromises = MARKETPLACE_EVENTS.map(([eventName, type]) => {
        const listener = (...args) => {
          const candidate = args[args.length - 1];
          const event = candidate?.args ? candidate : candidate?.log?.args ? candidate.log : null;
          if (!event) return;
          processEvents([event], type);
        };
        candidateListeners.push([eventName, listener]);
        return candidateContract.on(eventName, listener);
      });
      await Promise.all(subscriptionPromises);

      await waitForPollToFinish();
      if (!stopped) await pollOnce(true);
      if (stopped || activeWebSocketProvider !== candidateProvider) {
        throw new Error('WSS connection closed while synchronizing missed blocks.');
      }

      candidateBlockListener = (blockNumber) => {
        const numericBlock = Number(blockNumber);
        if (Number.isSafeInteger(numericBlock)) {
          lastChecked = Math.max(lastChecked ?? 0, numericBlock);
        }
      };
      activeBlockListener = candidateBlockListener;
      await candidateProvider.on('block', candidateBlockListener);

      if (stopped || activeWebSocketProvider !== candidateProvider) {
        throw new Error('WSS connection closed while subscribing to new blocks.');
      }

      stopHttpPolling();
      reconnectDelayMs = 1000;
      logger.log('Contract event listener connected through WSS; HTTP polling is paused.');
      return true;
    } catch (error) {
      if (activeWebSocketProvider === candidateProvider) {
        const resources = detachActiveWebSocket();
        cleanupWebSocket(resources.provider, resources.contract, resources.listeners, resources.blockListener, resources.closeCleanup);
      } else if (candidateProvider) {
        cleanupWebSocket(candidateProvider, candidateContract, candidateListeners, candidateBlockListener, candidateCloseCleanup);
      }
      if (!stopped) logger.warn('WSS RPC unavailable; continuing with HTTP event polling.', error && error.message ? error.message : error);
      return false;
    } finally {
      if (pendingWebSocketProvider === candidateProvider) {
        pendingWebSocketProvider = null;
        pendingWebSocketContract = null;
      }
      connectingWebSocket = false;
      if (!stopped && !activeWebSocketProvider) {
        startHttpPolling();
        scheduleWebSocketReconnect();
      }
    }
  }

  async function init() {
    try {
      const latest = await provider.getBlockNumber();
      lastChecked = Math.max(0, latest - 1);
      logger.log(`Contract listener initialized. Starting from block ${lastChecked + 1}`);
    } catch (error) {
      logger.error('Failed to initialize block number:', error);
      lastChecked = null;
    }

    if (stopped) return;
    startHttpPolling();
    if (wssUrl) void connectWebSocket();
  }

  async function pollOnce(forceLookback = false) {
    if (stopped || pollInProgress) return;
    pollInProgress = true;
    try {
      const latest = await provider.getBlockNumber();
      if (lastChecked === null) lastChecked = Math.max(0, latest - 1);
      if (latest <= lastChecked && !forceLookback) return;

      const from = Math.max(0, lastChecked + 1 - lookbackBlocks);
      for (let chunkStart = from; chunkStart <= latest; chunkStart += maxBlockRange) {
        const chunkEnd = Math.min(latest, chunkStart + maxBlockRange - 1);
        const [listed, sold, deleted, refunded, released, disputed, votes] = await Promise.all([
          contract.queryFilter('ProductListed', chunkStart, chunkEnd),
          contract.queryFilter('ProductSold', chunkStart, chunkEnd),
          contract.queryFilter('ProductDeleted', chunkStart, chunkEnd),
          contract.queryFilter('EscrowRefunded', chunkStart, chunkEnd),
          contract.queryFilter('EscrowReleased', chunkStart, chunkEnd),
          contract.queryFilter('EscrowDisputed', chunkStart, chunkEnd),
          contract.queryFilter('EscrowResolutionVoted', chunkStart, chunkEnd)
        ]);
        if (listed.length || sold.length || deleted.length || refunded.length || released.length || disputed.length || votes.length) {
          logger.log(`Events found — listed:${listed.length} sold:${sold.length} deleted:${deleted.length} refunded:${refunded.length} released:${released.length} disputed:${disputed.length} votes:${votes.length}`);
        }

        processEvents(listed, 'listed');
        processEvents(sold, 'sold');
        processEvents(deleted, 'deleted');
        processEvents(refunded, 'refunded');
        processEvents(released, 'released');
        processEvents(disputed, 'disputed');
        processEvents(votes, 'vote');
      }

      lastChecked = latest;
    } catch (error) {
      logger.error('HTTP RPC polling error:', error && error.message ? error.message : error);
      await sleep(2000);
    } finally {
      pollInProgress = false;
    }
  }

  init().catch(error => {
    logger.error('Failed to start contract listener:', error);
  });

  function stop() {
    stopped = true;
    stopHttpPolling();
    if (reconnectHandle) scheduler.clearTimeout(reconnectHandle);
    reconnectHandle = null;
    const activeProvider = activeWebSocketProvider;
    if (activeProvider) {
      const resources = detachActiveWebSocket();
      cleanupWebSocket(resources.provider, resources.contract, resources.listeners, resources.blockListener, resources.closeCleanup);
    }
    if (pendingWebSocketProvider) {
      const pendingProvider = pendingWebSocketProvider;
      const pendingContract = pendingWebSocketContract;
      pendingWebSocketProvider = null;
      pendingWebSocketContract = null;
      if (pendingProvider !== activeProvider) cleanupWebSocket(pendingProvider, pendingContract, [], null, null);
    }
    try { provider.destroy && provider.destroy(); } catch (_) {}
    logger.log('Contract listener stopped.');
  }

  return { stop };
}

module.exports = startContractListener;

(function (global) {
  'use strict';

  const LOGS_URL = `https://eth-sepolia.blockscout.com/api/v2/addresses/${marketplaceAddress}/logs`;
  const RPC_LOG_CHUNK_SIZE = 2000;
  const HISTORY_REQUEST_CONCURRENCY = 6;
  const HISTORY_INTERFACE = new ethers.utils.Interface([
    'event ProductSold(uint256 id, string name, uint256 price, address seller, address buyer)',
    'event EscrowCreated(uint256 escrowId, uint256 productId, address seller, address buyer, uint256 amount)',
    'event EscrowReleased(uint256 escrowId, uint256 productId, address seller, uint256 amount)',
    'event EscrowRefunded(uint256 escrowId, uint256 productId, address buyer, uint256 amount)',
    'event EscrowDisputed(uint256 escrowId, uint256 productId, address initiator)'
  ]);
  const SOLD_TOPIC = HISTORY_INTERFACE.getEventTopic('ProductSold').toLowerCase();
  const HISTORY_TOPICS = new Set([
    SOLD_TOPIC,
    HISTORY_INTERFACE.getEventTopic('EscrowCreated').toLowerCase(),
    HISTORY_INTERFACE.getEventTopic('EscrowReleased').toLowerCase(),
    HISTORY_INTERFACE.getEventTopic('EscrowRefunded').toLowerCase(),
    HISTORY_INTERFACE.getEventTopic('EscrowDisputed').toLowerCase()
  ]);
  const RPC_TOPICS = [[...HISTORY_TOPICS]];
  const WALLET_HISTORY_CACHE_PREFIX = `peerloop:wallet-history:v1:${marketplaceAddress.toLowerCase()}:`;
  const WALLET_HISTORY_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
  let loadPromise = null;
  let cachedEvents = null;
  let cachedEventsUntil = 0;
  const confirmedPurchasesByHash = new Map();
  const confirmedEscrowStates = new Map();

  function readWalletHistoryCache(walletAddress) {
    try {
      const cached = JSON.parse(localStorage.getItem(`${WALLET_HISTORY_CACHE_PREFIX}${walletAddress.toLowerCase()}`) || 'null');
      if (!cached || !Number.isFinite(cached.savedAt) || cached.savedAt > Date.now()
        || Date.now() - cached.savedAt > WALLET_HISTORY_CACHE_MAX_AGE
        || !Array.isArray(cached.history?.purchased) || !Array.isArray(cached.history?.sold)) {
        return null;
      }
      return cached.history;
    } catch (error) {
      console.warn('Could not read cached wallet history:', error.message);
      return null;
    }
  }

  function saveWalletHistoryCache(walletAddress, history) {
    try {
      localStorage.setItem(`${WALLET_HISTORY_CACHE_PREFIX}${walletAddress.toLowerCase()}`, JSON.stringify({
        savedAt: Date.now(),
        history
      }));
    } catch (error) {
      console.warn('Could not save wallet history cache:', error.message);
    }
  }

  async function mapWithConcurrency(items, concurrency, callback) {
    const results = new Array(items.length);
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await callback(items[index], index);
      }
    });
    await Promise.all(workers);
    return results;
  }

  function parsePartialSoldEvents(logs) {
    return logs.filter((log) => Array.isArray(log.topics) && log.topics[0]?.toLowerCase() === SOLD_TOPIC)
      .map((log) => {
        const parsed = HISTORY_INTERFACE.parseLog({ topics: log.topics.filter(Boolean), data: log.data });
        const args = parsed.args;
        return {
          _id: args.id.toString(),
          name: String(args.name),
          price: Number(ethers.utils.formatEther(args.price)),
          seller: String(args.seller),
          buyer: String(args.buyer),
          imageUrl: '',
          description: '',
          category: 'data',
          isSold: true,
          escrowId: null,
          escrowState: 0,
          refunded: false,
          transactionHash: String(log.transaction_hash || log.transactionHash || ''),
          blockNumber: Number(log.block_number ?? log.blockNumber),
          soldAt: log.block_timestamp
            ? new Date(log.block_timestamp).toISOString()
            : log.timestamp ? new Date(log.timestamp * 1000).toISOString() : null
        };
      });
  }

  async function loadIndexedLogs(onPage) {
    const logs = [];
    let nextUrl = LOGS_URL;
    const seenCursors = new Set();

    while (nextUrl) {
      const response = await fetchWithTimeout(nextUrl, {}, 8000);
      if (!response.ok) {
        throw new Error(`Sepolia transaction history service returned HTTP ${response.status}.`);
      }

      const page = await response.json();
      if (!Array.isArray(page.items)) {
        throw new Error('Sepolia transaction history service returned an invalid response.');
      }

      const relevantLogs = page.items.filter((log) =>
        Array.isArray(log.topics) && HISTORY_TOPICS.has(log.topics[0]?.toLowerCase())
      );
      logs.push(...relevantLogs);
      onPage?.(relevantLogs);

      const cursor = page.next_page_params;
      if (!cursor) {
        nextUrl = null;
        continue;
      }

      const cursorKey = JSON.stringify(cursor);
      if (seenCursors.has(cursorKey)) {
        throw new Error('Sepolia transaction history service returned a repeated page cursor.');
      }
      seenCursors.add(cursorKey);

      const url = new URL(LOGS_URL);
      for (const [key, value] of Object.entries(cursor)) {
        url.searchParams.set(key, String(value));
      }
      nextUrl = url.toString();
    }
    return logs;
  }

  async function loadRpcLogs(onBatch) {
    const latestBlock = await getMarketplaceBlockNumber();
    const ranges = [];
    for (let fromBlock = marketplaceDeploymentBlock; fromBlock <= latestBlock; fromBlock += RPC_LOG_CHUNK_SIZE) {
      const toBlock = Math.min(fromBlock + RPC_LOG_CHUNK_SIZE - 1, latestBlock);
      ranges.push([fromBlock, toBlock]);
    }
    const logsByRange = await mapWithConcurrency(
      ranges,
      HISTORY_REQUEST_CONCURRENCY,
      async ([fromBlock, toBlock]) => {
        const logs = await readMarketplaceLogs(fromBlock, toBlock, RPC_TOPICS);
        onBatch?.(logs);
        return logs;
      }
    );
    return logsByRange.flat();
  }

  async function loadSoldEvents(onProgress) {
    const reportLogs = (logs) => {
      if (onProgress && logs.length) onProgress(parsePartialSoldEvents(logs));
    };
    let logs;
    try {
      logs = await loadIndexedLogs(reportLogs);
    } catch (indexerError) {
      console.warn('Sepolia history indexer is unavailable; falling back to Sepolia RPC logs.', indexerError.message);
      try {
        logs = await loadRpcLogs(reportLogs);
      } catch (rpcError) {
        throw new Error(`Transaction history could not be loaded from the indexer or blockchain RPC. Indexer: ${indexerError.message} RPC: ${rpcError.message}`);
      }
    }

    logs = logs.filter((log) => Array.isArray(log.topics)
      && HISTORY_TOPICS.has(log.topics[0]?.toLowerCase()));
    logs.sort((left, right) =>
      Number(left.block_number ?? left.blockNumber) - Number(right.block_number ?? right.blockNumber)
      || Number(left.index ?? left.log_index ?? left.logIndex ?? 0)
        - Number(right.index ?? right.log_index ?? right.logIndex ?? 0)
    );
    const escrowIdByTransaction = new Map();
    const escrowStateById = new Map();
    const soldEvents = [];
    for (const log of logs) {
      const parsed = HISTORY_INTERFACE.parseLog({
        topics: log.topics.filter(Boolean),
        data: log.data
      });
      const args = parsed.args;
      const transactionHash = String(log.transaction_hash || log.transactionHash || '');

      if (parsed.name === 'EscrowCreated') {
        const escrowId = args.escrowId.toString();
        escrowIdByTransaction.set(transactionHash.toLowerCase(), escrowId);
        escrowStateById.set(escrowId, 1);
      } else if (parsed.name === 'EscrowReleased') {
        escrowStateById.set(args.escrowId.toString(), 2);
      } else if (parsed.name === 'EscrowRefunded') {
        escrowStateById.set(args.escrowId.toString(), 3);
      } else if (parsed.name === 'EscrowDisputed') {
        escrowStateById.set(args.escrowId.toString(), 4);
      } else if (parsed.name === 'ProductSold') {
        const escrowId = escrowIdByTransaction.get(transactionHash.toLowerCase()) || null;
        soldEvents.push({
          _id: args.id.toString(),
          name: String(args.name),
          price: Number(ethers.utils.formatEther(args.price)),
          seller: String(args.seller),
          buyer: String(args.buyer),
          imageUrl: '',
          description: '',
          category: 'data',
          isSold: true,
          escrowId,
          escrowState: escrowId ? null : 0,
          transactionHash,
          blockNumber: Number(log.block_number ?? log.blockNumber),
          soldAt: log.block_timestamp
            ? new Date(log.block_timestamp).toISOString()
            : log.timestamp ? new Date(log.timestamp * 1000).toISOString() : null
        });
      }
    }

    return soldEvents
      .map((event) => ({
        ...event,
        escrowState: event.escrowId
          ? confirmedEscrowStates.get(event.escrowId) || escrowStateById.get(event.escrowId) || 1
          : 0,
        refunded: event.escrowId
          ? (confirmedEscrowStates.get(event.escrowId) || escrowStateById.get(event.escrowId)) === 3
          : false
      }))
      .sort((a, b) => b.blockNumber - a.blockNumber);
  }

  async function getSoldEvents(onProgress) {
    if (cachedEvents && Date.now() < cachedEventsUntil) {
      onProgress?.(cachedEvents);
      return cachedEvents;
    }
    if (loadPromise) {
      const events = await loadPromise;
      onProgress?.(events);
      return events;
    }

    loadPromise = loadSoldEvents(onProgress)
      .then((events) => {
        cachedEvents = events;
        cachedEventsUntil = Date.now() + 30000;
        return events;
      })
      .finally(() => { loadPromise = null; });
    return loadPromise;
  }

  async function addProductDetails(events) {
    if (typeof readOnlyContract === 'undefined' || !readOnlyContract) return events;

    const uniqueEventsById = new Map();
    events.forEach((event) => uniqueEventsById.set(event._id, event));
    const uniqueEvents = [...uniqueEventsById.values()];
    const detailsById = new Map<string, { description: string; imageUrl: string }>();
    await mapWithConcurrency(uniqueEvents, HISTORY_REQUEST_CONCURRENCY, async (event) => {
      try {
        const product = await readOnlyContract.products(event._id);
        detailsById.set(event._id, {
          description: String(product.description || ''),
          imageUrl: String(product.imageUrl || '')
        });
      } catch (error) {
        console.warn(`Could not load additional details for sold product ${event._id}:`, error.message);
      }
    });
    return events.map((event) => ({ ...event, ...detailsById.get(event._id) }));
  }

  global.getWalletTransactionHistory = async function (walletAddress, onProgress) {
    if (!ethers.utils.isAddress(walletAddress)) {
      throw new Error('A valid wallet address is required to load history.');
    }

    const lowerAddress = walletAddress.toLowerCase();
    const progressEvents = new Map();
    const indexedEvents = await getSoldEvents((events) => {
      events.forEach((event) => {
        if (event.transactionHash) progressEvents.set(event.transactionHash.toLowerCase(), event);
      });
      confirmedPurchasesByHash.forEach((event, hash) => progressEvents.set(hash, event));
      const partialEvents = [...progressEvents.values()].filter((event) =>
        event.seller.toLowerCase() === lowerAddress || event.buyer.toLowerCase() === lowerAddress
      );
      onProgress?.({
        sold: partialEvents.filter((event) => event.seller.toLowerCase() === lowerAddress),
        purchased: partialEvents.filter((event) => event.buyer.toLowerCase() === lowerAddress)
      });
    });
    const eventsByHash = new Map();
    confirmedPurchasesByHash.forEach((event, hash) => eventsByHash.set(hash, event));
    indexedEvents.forEach((event) => {
      eventsByHash.set(event.transactionHash.toLowerCase(), event);
    });
    const events = [...eventsByHash.values()];
    const matchingEvents = events.filter((event) =>
      event.seller.toLowerCase() === lowerAddress
      || event.buyer.toLowerCase() === lowerAddress
    );
    const walletHistory = {
      sold: matchingEvents.filter((product) => product.seller.toLowerCase() === lowerAddress),
      purchased: matchingEvents.filter((product) => product.buyer.toLowerCase() === lowerAddress)
    };
    saveWalletHistoryCache(lowerAddress, walletHistory);
    return walletHistory;
  };

  global.getCachedWalletTransactionHistory = function (walletAddress) {
    if (!ethers.utils.isAddress(walletAddress)) return null;
    return readWalletHistoryCache(walletAddress);
  };

  global.enrichWalletTransactionHistory = async function (walletAddress, walletHistory) {
    const lowerAddress = walletAddress.toLowerCase();
    const eventsByHash = new Map();
    [...walletHistory.purchased, ...walletHistory.sold].forEach((event) => {
      eventsByHash.set(String(event.transactionHash || event._id).toLowerCase(), event);
    });
    const events = [...eventsByHash.values()];
    const blocksMissingTimestamps = [...new Set(events
      .filter((event) => !event.soldAt && Number(event.blockNumber) > 0)
      .map((event) => Number(event.blockNumber)))];
    await mapWithConcurrency(blocksMissingTimestamps, HISTORY_REQUEST_CONCURRENCY, async (blockNumber) => {
      try {
        const timestamp = await getMarketplaceBlockTimestamp(blockNumber);
        const soldAt = new Date(timestamp * 1000).toISOString();
        events.forEach((event) => {
          if (Number(event.blockNumber) === blockNumber && !event.soldAt) event.soldAt = soldAt;
        });
      } catch (error) {
        console.warn(`Could not load timestamp for transaction block ${blockNumber}:`, error.message);
      }
    });
    const enrichedEvents = await addProductDetails(events);
    const enrichedByHash = new Map(enrichedEvents.map((event) => [
      String(event.transactionHash || event._id).toLowerCase(),
      event
    ]));
    const enrichedHistory = {
      sold: walletHistory.sold.map((event) => enrichedByHash.get(String(event.transactionHash || event._id).toLowerCase()) || event),
      purchased: walletHistory.purchased.map((event) => enrichedByHash.get(String(event.transactionHash || event._id).toLowerCase()) || event)
    };
    saveWalletHistoryCache(lowerAddress, enrichedHistory);
    return enrichedHistory;
  };

  global.invalidateWalletTransactionHistory = function () {
    cachedEvents = null;
    cachedEventsUntil = 0;
  };

  global.recordConfirmedEscrowPurchase = function (purchase) {
    const transactionHash = String(purchase.transactionHash || '').toLowerCase();
    if (!transactionHash) throw new Error('A confirmed purchase transaction hash is required.');

    const confirmedPurchase = {
      _id: String(purchase.productId),
      name: String(purchase.name || 'Marketplace item'),
      price: Number(purchase.price) || 0,
      seller: String(purchase.seller),
      buyer: String(purchase.buyer),
      imageUrl: String(purchase.imageUrl || ''),
      description: String(purchase.description || ''),
      category: String(purchase.category || 'data'),
      isSold: true,
      escrowId: String(purchase.escrowId),
      escrowState: 1,
      refunded: false,
      transactionHash: String(purchase.transactionHash),
      blockNumber: Number(purchase.blockNumber) || 0,
      soldAt: purchase.soldAt ? new Date(purchase.soldAt).toISOString() : null
    };
    confirmedPurchasesByHash.set(transactionHash, confirmedPurchase);
    return confirmedPurchase;
  };

  global.updateConfirmedEscrowState = function (productId, escrowId, state) {
    const normalizedEscrowId = String(escrowId);
    confirmedEscrowStates.set(normalizedEscrowId, Number(state));
    confirmedPurchasesByHash.forEach((event) => {
      if (event.escrowId !== normalizedEscrowId || event._id !== String(productId)) return;
      event.escrowState = Number(state);
      event.refunded = Number(state) === 3;
    });
    invalidateWalletTransactionHistory();
  };
})(window);

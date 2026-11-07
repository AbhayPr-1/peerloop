// Sepolia RPC providers can limit eth_getLogs to a small block range.
// Blockscout's indexed address-log API provides complete, cursor-paginated history.
(function (global) {
  'use strict';

  const LOGS_URL = `https://eth-sepolia.blockscout.com/api/v2/addresses/${marketplaceAddress}/logs`;
  const PRODUCT_LOOKUP_BATCH_SIZE = 6;
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
  let loadPromise = null;
  let cachedEvents = null;
  let cachedEventsUntil = 0;
  const confirmedPurchasesByHash = new Map();
  const confirmedEscrowStates = new Map();

  async function loadSoldEvents() {
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

      for (const log of page.items) {
        if (Array.isArray(log.topics) && HISTORY_TOPICS.has(log.topics[0]?.toLowerCase())) logs.push(log);
      }

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

    logs.sort((left, right) =>
      Number(left.block_number) - Number(right.block_number)
      || Number(left.index ?? left.log_index ?? 0) - Number(right.index ?? right.log_index ?? 0)
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
      const transactionHash = String(log.transaction_hash || '');

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
          blockNumber: Number(log.block_number),
          soldAt: log.block_timestamp ? new Date(log.block_timestamp).toISOString() : null
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

  async function getSoldEvents() {
    if (cachedEvents && Date.now() < cachedEventsUntil) return cachedEvents;
    if (loadPromise) return loadPromise;

    loadPromise = loadSoldEvents()
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
    const detailsById = new Map();
    for (let start = 0; start < uniqueEvents.length; start += PRODUCT_LOOKUP_BATCH_SIZE) {
      const batch = uniqueEvents.slice(start, start + PRODUCT_LOOKUP_BATCH_SIZE);
      await Promise.all(batch.map(async (event) => {
        try {
          const product = await readOnlyContract.products(event._id);
          detailsById.set(event._id, {
            description: String(product.description || ''),
            imageUrl: String(product.imageUrl || '')
          });
        } catch (error) {
          console.warn(`Could not load additional details for sold product ${event._id}:`, error.message);
        }
      }));
    }
    return events.map((event) => ({ ...event, ...detailsById.get(event._id) }));
  }

  global.getWalletTransactionHistory = async function (walletAddress) {
    if (!ethers.utils.isAddress(walletAddress)) {
      throw new Error('A valid wallet address is required to load history.');
    }

    const lowerAddress = walletAddress.toLowerCase();
    const indexedEvents = await getSoldEvents();
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
    const products = await addProductDetails(matchingEvents);

    return {
      sold: products.filter((product) => product.seller.toLowerCase() === lowerAddress),
      purchased: products.filter((product) => product.buyer.toLowerCase() === lowerAddress)
    };
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
      soldAt: new Date().toISOString()
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

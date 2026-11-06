// Sepolia RPC providers can limit eth_getLogs to a small block range.
// Blockscout's indexed address-log API provides complete, cursor-paginated history.
(function (global) {
  'use strict';

  const LOGS_URL = `https://eth-sepolia.blockscout.com/api/v2/addresses/${marketplaceAddress}/logs`;
  const PRODUCT_LOOKUP_BATCH_SIZE = 6;
  const HISTORY_INTERFACE = new ethers.utils.Interface([
    'event ProductSold(uint256 id, string name, uint256 price, address seller, address buyer)'
  ]);
  const SOLD_TOPIC = HISTORY_INTERFACE.getEventTopic('ProductSold').toLowerCase();
  let loadPromise = null;

  async function loadSoldEvents() {
    const events = [];
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
        if (!Array.isArray(log.topics) || log.topics[0]?.toLowerCase() !== SOLD_TOPIC) continue;

        const parsed = HISTORY_INTERFACE.parseLog({
          topics: log.topics.filter(Boolean),
          data: log.data
        });
        const args = parsed.args;
        events.push({
          _id: args.id.toString(),
          name: String(args.name),
          price: Number(ethers.utils.formatEther(args.price)),
          seller: String(args.seller),
          buyer: String(args.buyer),
          imageUrl: '',
          description: '',
          category: 'data',
          isSold: true,
          transactionHash: String(log.transaction_hash || ''),
          blockNumber: Number(log.block_number),
          soldAt: log.block_timestamp ? new Date(log.block_timestamp).toISOString() : null
        });
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

    return events.sort((a, b) => b.blockNumber - a.blockNumber);
  }

  async function getSoldEvents() {
    if (loadPromise) return loadPromise;

    loadPromise = loadSoldEvents();
    try {
      return await loadPromise;
    } finally {
      loadPromise = null;
    }
  }

  async function addProductDetails(events) {
    if (typeof readOnlyContract === 'undefined' || !readOnlyContract) return events;

    const products = [];
    for (let start = 0; start < events.length; start += PRODUCT_LOOKUP_BATCH_SIZE) {
      const batch = events.slice(start, start + PRODUCT_LOOKUP_BATCH_SIZE);
      products.push(...await Promise.all(batch.map(async (event) => {
        try {
          const product = await readOnlyContract.products(event._id);
          return {
            ...event,
            description: String(product.description || ''),
            imageUrl: String(product.imageUrl || '')
          };
        } catch (error) {
          console.warn(`Could not load additional details for sold product ${event._id}:`, error.message);
          return event;
        }
      })));
    }
    return products;
  }

  global.getWalletTransactionHistory = async function (walletAddress) {
    if (!ethers.utils.isAddress(walletAddress)) {
      throw new Error('A valid wallet address is required to load history.');
    }

    const lowerAddress = walletAddress.toLowerCase();
    const events = await getSoldEvents();
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
})(window);

// backend/contractListener.js
// Polling-based contract listener (HTTPS RPC) with event deduplication
const { ethers } = require('ethers');
require('dotenv').config();

const RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || process.env.SEPOLIA_RPC;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

if (!RPC_URL) console.error('Missing SEPOLIA_RPC_URL in backend/.env');
if (!CONTRACT_ADDRESS) console.error('Missing CONTRACT_ADDRESS in backend/.env');

/* ABI (events + useful functions) */
const MARKETPLACE_ABI = [
  /* keep same ABI as before — events used: ProductListed, ProductSold, ProductDeleted */
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "id", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "name", "type": "string" },
      { "indexed": false, "internalType": "address", "name": "seller", "type": "address" }
    ],
    "name": "ProductDeleted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "id", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "name", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "imageUrl", "type": "string" },
      { "indexed": false, "internalType": "address", "name": "seller", "type": "address" }
    ],
    "name": "ProductListed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": false, "internalType": "uint256", "name": "id", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "name", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" },
      { "indexed": false, "internalType": "address", "name": "seller", "type": "address" },
      { "indexed": false, "internalType": "address", "name": "buyer", "type": "address" }
    ],
    "name": "ProductSold",
    "type": "event"
  },
  /* rest of ABI omitted for brevity in display — you already have functions if needed */
];

/* Utilities */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/*
  startContractListener(io, opts)
  opts:
    - pollIntervalMs (ms) default 3000
    - lookbackBlocks default 2 (small lookback helps avoid missing reorgs)
    - dedupeCacheSize default 1000 (how many unique logs to remember)
*/
function startContractListener(io, opts = {}) {
  const pollIntervalMs = opts.pollIntervalMs || 3000;
  const lookbackBlocks = typeof opts.lookbackBlocks === 'number' ? opts.lookbackBlocks : 2;
  const dedupeCacheSize = opts.dedupeCacheSize || 1000;

  if (!RPC_URL || !CONTRACT_ADDRESS) {
    console.error('Contract listener not started: missing RPC_URL or CONTRACT_ADDRESS.');
    return { stop: () => {} };
  }

  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, MARKETPLACE_ABI, provider);

  let stopped = false;
  let pollHandle = null;
  let lastChecked = null; // last fully-processed block number

  // dedupeSet stores keys "txHash:logIndex". Keep insertion order to prune oldest when size > dedupeCacheSize.
  const dedupeSet = new Set();

  function addDedupe(key) {
    if (dedupeSet.has(key)) return false;
    dedupeSet.add(key);
    // prune oldest if too many
    if (dedupeSet.size > dedupeCacheSize) {
      // remove first inserted (Set maintains insertion order)
      const it = dedupeSet.values();
      const first = it.next().value;
      if (first) dedupeSet.delete(first);
    }
    return true;
  }

  async function init() {
    try {
      const latest = await provider.getBlockNumber();
      // start from latest (so first poll will check from latest - lookback to latest)
      lastChecked = Math.max(0, latest - 1);
      console.log(`Contract polling initialized. Starting from block ${lastChecked + 1}`);
    } catch (err) {
      console.error('Failed to initialize block number:', err);
      lastChecked = 0;
    }

    pollHandle = setInterval(pollOnce, pollIntervalMs);
    // run immediately once
    setTimeout(pollOnce, 200);
  }

  async function pollOnce() {
    if (stopped) return;
    try {
      const latest = await provider.getBlockNumber();
      if (latest <= lastChecked) {
        return; // nothing new
      }

      // Compute non-overlapping window: from = lastChecked + 1, to = latest
      // We'll also query a small lookback inside that window for safety on reorgs:
      const from = Math.max(0, lastChecked + 1 - lookbackBlocks);
      const to = latest;

      console.log(`Polling blocks ${from} → ${to} (lastChecked=${lastChecked})`);

      // Query events in this block range
      const listed = await contract.queryFilter('ProductListed', from, to);
      const sold = await contract.queryFilter('ProductSold', from, to);
      const deleted = await contract.queryFilter('ProductDeleted', from, to);

      // Helper to process an event array
      const processEvents = (events, type) => {
        for (const ev of events) {
          const tx = ev.transactionHash || (ev.transaction && ev.transaction.hash) || '';
          const logIndex = (typeof ev.logIndex !== 'undefined') ? ev.logIndex : (ev.transactionIndex || 0);
          const dedupeKey = `${tx}:${logIndex}`;

          // If already processed, skip
          if (!addDedupe(dedupeKey)) {
            // already processed -> skip
            continue;
          }

          // extract id/name safely
          let id = null, name = null;
          try {
            if (ev.args) {
              // prefer named fields
              id = ev.args.id ? ev.args.id.toString() : (ev.args.productId ? ev.args.productId.toString() : null);
              name = ev.args.name ? ev.args.name : null;
            }
          } catch (e) {
            // fallback
            console.warn('Error reading ev.args', e);
          }

          console.log(`[POLL EVENT] ${type} tx=${tx} logIndex=${logIndex} id=${id} name=${name}`);
          // Emit a single 'product_updated' for this log
          // Frontend fetchProducts() should re-read state. You can attach payload if desired.
          io.emit('product_updated', { type, id, name, tx, logIndex });
        }
      };

      // Process events
      if (listed.length || sold.length || deleted.length) {
        console.log(`Events found — listed:${listed.length} sold:${sold.length} deleted:${deleted.length}`);
      }

      processEvents(listed, 'listed');
      processEvents(sold, 'sold');
      processEvents(deleted, 'deleted');

      // Update lastChecked to the latest block we processed (non-overlapping)
      lastChecked = latest;
    } catch (err) {
      console.error('Polling error:', err && err.message ? err.message : err);
      await sleep(2000);
    }
  }

  init().catch(err => {
    console.error('Failed to start contract listener:', err);
  });

  function stop() {
    stopped = true;
    if (pollHandle) clearInterval(pollHandle);
    try { provider.destroy && provider.destroy(); } catch (_) {}
    console.log('Contract listener stopped.');
  }

  return { stop };
}

module.exports = startContractListener;

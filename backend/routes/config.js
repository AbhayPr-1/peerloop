// backend/routes/config.js
const express = require('express');
const router = express.Router();

// NOTE: We are intentionally exposing the SEPOLIA_RPC_URL from the backend.env.
// For production use, please ensure this RPC key is a dedicated, read-only key 
// to mitigate the risk of its exposure in the browser.
const READ_ONLY_RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.RPC_URL || process.env.SEPOLIA_RPC;

// --- GET RPC URL ---
router.get('/rpc-url', (req, res) => {
  if (!READ_ONLY_RPC_URL) {
    console.error('RPC URL not configured on server.');
    return res.status(500).json({ msg: 'RPC URL not configured on server.' });
  }
  // This is the only exposed RPC URL, so it should be a public/read-only key.
  res.json({ rpcUrl: READ_ONLY_RPC_URL });
});

module.exports = router;
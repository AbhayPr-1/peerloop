const express = require('express');

const router = express.Router();
const PUBLIC_SEPOLIA_RPC_URL = 'https://rpc.sepolia.org';

router.get('/rpc-url', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ rpcUrl: PUBLIC_SEPOLIA_RPC_URL });
});

module.exports = router;

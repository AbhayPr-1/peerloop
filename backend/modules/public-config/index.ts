import express from 'express';

const PUBLIC_SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';

export function createPublicConfigRouter() {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      service: 'peerloop-backend',
      timestamp: new Date().toISOString()
    });
  });

  router.get('/rpc-url', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ rpcUrl: PUBLIC_SEPOLIA_RPC_URL });
  });
  return router;
}

export default createPublicConfigRouter();

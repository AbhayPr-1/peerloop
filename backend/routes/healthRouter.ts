import express from 'express';

export interface HealthRouterOptions {
  databaseStatus: () => string;
  now?: () => Date;
}

export function createHealthRouter(options: HealthRouterOptions) {
  const router = express.Router();
  const now = options.now || (() => new Date());

  const liveHealth = (_req: express.Request, res: express.Response) => {
    res.set('Cache-Control', 'no-store');
    return res.json({
      status: 'ok',
      service: 'peerloop-backend',
      timestamp: now().toISOString()
    });
  };

  const readyHealth = (_req: express.Request, res: express.Response) => {
    res.set('Cache-Control', 'no-store');
    const database = options.databaseStatus();
    const ready = database === 'connected';
    return res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'unavailable',
      service: 'peerloop-backend',
      timestamp: now().toISOString(),
      database
    });
  };

  router.get('/live', liveHealth);
  router.get('/ready', readyHealth);
  router.get('/', readyHealth);

  return router;
}

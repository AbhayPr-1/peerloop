import express from 'express';
import cors from 'cors';
import config from './config';
import { createIpRateLimiter } from './middleware/ipRateLimiter';
import { applySecurityHeaders, redirectHttpToHttps } from './middleware/security';
import { createApiRouter } from './routes/apiRouter';
import { createHealthRouter } from './routes/healthRouter';

export interface AppOptions {
  appOrigin?: string;
  databaseStatus?: () => string;
}

function getTrustProxySetting(value: string | undefined, isProduction: boolean) {
  const configured = value?.trim();
  if (!configured) return isProduction ? 1 : false;
  if (configured.toLowerCase() === 'false') return false;
  if (configured.toLowerCase() === 'true') {
    throw new Error('TRUST_PROXY must be false, a hop count, or trusted proxy addresses; true is unsafe.');
  }
  if (/^\d+$/.test(configured)) return Number(configured);
  const trustedProxies = configured.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (trustedProxies.length === 0) throw new Error('TRUST_PROXY must contain a hop count or trusted proxy addresses.');
  return trustedProxies;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const appOrigins = (options.appOrigin || config.appOrigin)
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  const databaseStatus = options.databaseStatus || (() => 'unknown');

  app.disable('x-powered-by');
  app.set('trust proxy', getTrustProxySetting(process.env.TRUST_PROXY, config.isProduction));
  if (config.isProduction && !process.env.TRUST_PROXY?.trim()) {
    console.warn('TRUST_PROXY is unset; trusting one proxy for backwards compatibility. Configure it to match the deployed proxy topology.');
  }
  app.use(redirectHttpToHttps);
  app.use(applySecurityHeaders);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || appOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  }));
  app.use('/api/auth', createIpRateLimiter(20, 60 * 1000, 'Too many auth requests. Try again later.'));
  app.use('/api/upload', createIpRateLimiter(20, 60 * 1000, 'Too many upload requests. Try again later.'));
  app.use(express.json({ limit: '5mb' }));

  app.use('/api', createApiRouter());
  app.use('/health', createHealthRouter({ databaseStatus }));

  return app;
}

import express from 'express';
import cors from 'cors';
import config from './config';
import { createIpRateLimiter } from './middleware/ipRateLimiter';
import { applySecurityHeaders, redirectHttpToHttps } from './middleware/security';

const authRouter = require('./modules/auth').default;
const uploadRouter = require('./modules/uploads').default;
const listingMetadataRouter = require('./modules/listing-metadata').default;
const publicConfigRouter = require('./modules/public-config').default;

export interface AppOptions {
  appOrigin?: string;
  databaseStatus?: () => string;
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const appOrigins = (options.appOrigin || config.appOrigin)
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  const databaseStatus = options.databaseStatus || (() => 'unknown');

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
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

  app.use('/api/auth', authRouter);
  app.use('/api/upload', uploadRouter);
  app.use('/api/listing-metadata', listingMetadataRouter);
  app.use('/api/config', publicConfigRouter);

  app.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      service: 'peerloop-backend',
      timestamp: new Date().toISOString(),
      database: databaseStatus()
    });
  });

  return app;
}

import path from 'node:path';

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

export interface BackendConfig {
  port: number;
  mongoUri: string;
  appOrigin: string;
  jwtSecret?: string;
}

export function createBackendConfig(environment: NodeJS.ProcessEnv): BackendConfig {
  const rawPort = environment.PORT?.trim() || '5001';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port between 1 and 65535.');
  }

  const mongoUri = environment.MONGO_URI?.trim() || 'mongodb://127.0.0.1:27017/peerloop';
  const appOrigin = environment.APP_ORIGIN?.trim() || 'http://localhost:3000';
  const jwtSecret = environment.JWT_SECRET?.trim() || undefined;

  if (environment.NODE_ENV === 'production') {
    if (!environment.MONGO_URI?.trim()) {
      throw new Error('MONGO_URI must be explicitly configured for production runs.');
    }
    if (!environment.APP_ORIGIN?.trim()) {
      throw new Error('APP_ORIGIN must be explicitly configured for production runs.');
    }
    if (!appOrigin || appOrigin.includes('localhost')) {
      console.warn('APP_ORIGIN is using a localhost value in production; verify the deployed frontend URL before launch.');
    }
    if (mongoUri.includes('your_')) {
      throw new Error('MONGO_URI must be configured for production runs.');
    }
    if (!jwtSecret) {
      throw new Error('JWT_SECRET must be configured for production runs.');
    }
  }

  return {
    port,
    mongoUri,
    appOrigin,
    jwtSecret
  };
}

const config = createBackendConfig(process.env);
export default config;

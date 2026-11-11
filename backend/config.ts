import path from 'node:path';

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

export interface BackendConfig {
  port: number;
  mongoUri: string;
  appOrigin: string;
  jwtSecret?: string;
  isProduction: boolean;
  chainRpcUrl?: string;
  chainWssUrl?: string;
  contractAddress?: string;
  pinata: {
    apiKey?: string;
    apiSecret?: string;
    jwt?: string;
  };
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
  const isProduction = environment.NODE_ENV === 'production';
  const chainRpcUrl = environment.SEPOLIA_RPC_URL?.trim()
    || environment.RPC_URL?.trim()
    || environment.SEPOLIA_RPC?.trim()
    || undefined;
  const chainWssUrl = environment.SEPOLIA_WSS_URL?.trim()
    || (chainRpcUrl && /^https:\/\//i.test(chainRpcUrl)
      ? chainRpcUrl.replace(/^https:/i, 'wss:')
      : chainRpcUrl && /^http:\/\//i.test(chainRpcUrl)
        ? chainRpcUrl.replace(/^http:/i, 'ws:')
        : undefined);
  const contractAddress = environment.CONTRACT_ADDRESS?.trim() || undefined;
  const pinata = {
    apiKey: environment.PINATA_API_KEY?.trim() || undefined,
    apiSecret: environment.PINATA_API_SECRET?.trim() || undefined,
    jwt: environment.PINATA_JWT?.trim() || undefined
  };

  if (isProduction) {
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
    jwtSecret,
    isProduction,
    chainRpcUrl,
    chainWssUrl,
    contractAddress,
    pinata
  };
}

const config = createBackendConfig(process.env);
export default config;

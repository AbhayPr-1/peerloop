import type { Request, Response, NextFunction } from 'express';
import config from '../config';

export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; connect-src 'self' http://localhost:5001 https://ethereum-sepolia-rpc.publicnode.com https://sepolia.gateway.tenderly.co https://eth-sepolia.blockscout.com ws://localhost:5001 wss:; font-src 'self' data: https://fonts.gstatic.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
}

function getAllowedRequestHosts(): Set<string> {
  const configuredOrigins = [
    ...config.appOrigin.split(','),
    ...(process.env.API_ORIGIN || '').split(',')
  ];
  const hosts = new Set<string>();
  for (const value of configuredOrigins) {
    try {
      hosts.add(new URL(value.trim()).host.toLowerCase());
    } catch {
      // Invalid origin settings are rejected by deployment configuration checks.
    }
  }
  return hosts;
}

export function redirectHttpToHttps(req: Request, res: Response, next: NextFunction) {
  if (!config.isProduction) return next();

  const requestHost = req.get('host');
  let normalizedHost: string;
  try {
    if (!requestHost || requestHost.includes('@')) throw new Error('Invalid host.');
    const parsedHost = new URL(`https://${requestHost}`);
    if (parsedHost.username || parsedHost.password || parsedHost.pathname !== '/') throw new Error('Invalid host.');
    normalizedHost = parsedHost.host.toLowerCase();
  } catch {
    return res.status(400).send('Invalid host.');
  }

  const allowedHosts = getAllowedRequestHosts();
  const canonicalHost = [...allowedHosts].find((host) => host === normalizedHost);
  if (!canonicalHost) return res.status(400).send('Host is not configured.');

  if (!req.secure) return res.redirect(301, `https://${canonicalHost}${req.originalUrl}`);

  res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  return next();
}

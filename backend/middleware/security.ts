import type { Request, Response, NextFunction } from 'express';

export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self'; connect-src 'self' http://localhost:5001 https://ethereum-sepolia-rpc.publicnode.com https://sepolia.gateway.tenderly.co https://eth-sepolia.blockscout.com ws://localhost:5001 wss:; font-src 'self' data: https://fonts.gstatic.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
}

export function redirectHttpToHttps(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== 'production') return next();
  if (req.secure || req.headers['x-forwarded-proto'] === 'https'
    || ['localhost', '127.0.0.1', '::1'].includes(req.hostname)) {
    return next();
  }
  const httpsUrl = `https://${req.headers.host}${req.originalUrl}`;
  return res.redirect(301, httpsUrl);
}

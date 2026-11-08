import type { NextFunction, Request, RequestHandler, Response } from 'express';
const jwt = require('jsonwebtoken');
const config = require('../config').default;

interface AuthMiddlewareOptions {
  jwtSecret?: string;
  isProduction?: boolean;
  appOrigin?: string;
}

function createAuthMiddleware(options: AuthMiddlewareOptions = {}): RequestHandler {
  const production = options.isProduction ?? config.isProduction;
  const cookieName = production ? '__Host-peerloop_session' : 'peerloop_session';
  const jwtSecret = options.jwtSecret ?? config.jwtSecret;
  const appOrigin = options.appOrigin ?? config.appOrigin;
  const allowedOrigins = appOrigin.split(',').map((value) => value.trim()).filter(Boolean);

  return function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const cookieValue = req.headers.cookie?.split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    let cookieToken: string | null = null;
    try {
      cookieToken = cookieValue ? decodeURIComponent(cookieValue) : null;
    } catch {
      cookieToken = null;
    }

    if (!cookieToken) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    if (!jwtSecret) {
      return res.status(503).json({ msg: 'Authentication is not configured on the server.' });
    }

    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const origin = req.header('origin');
        if (!origin || !allowedOrigins.includes(origin)) {
          return res.status(403).json({ msg: 'Request origin is not allowed.' });
        }
      }
      const decoded = jwt.verify(cookieToken, jwtSecret);
      if (!decoded || typeof decoded !== 'object' || decoded.authVersion !== 2 || !decoded.user || !decoded.user.id) {
        return res.status(401).json({ msg: 'Please sign in again.' });
      }

      req.user = {
        ...decoded.user,
        id: String(decoded.user.id)
      };
      return next();
    } catch (error) {
      if (error && error.name === 'TokenExpiredError') {
        return res.status(401).json({ msg: 'Token has expired. Please sign in again.' });
      }
      return res.status(401).json({ msg: 'Token is not valid' });
    }
  };
}

const authMiddleware = createAuthMiddleware();
module.exports = authMiddleware;
module.exports.createAuthMiddleware = createAuthMiddleware;

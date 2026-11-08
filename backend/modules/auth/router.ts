import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createAuthController } from './authController';
import type { createAuthService } from './authService';
import { createIpRateLimiter } from '../../middleware/ipRateLimiter';

const auth = require('../../middleware/authMiddleware');
const config = require('../../config').default;

const RATE_WINDOW_MS = 60 * 1000;
const MAX_CHALLENGES_PER_WINDOW = 10;

export function createAuthRouter(
  authService: ReturnType<typeof createAuthService>,
  options: { isProduction?: boolean } = {}
) {
  const router = express.Router();
  const isProduction = options.isProduction ?? config.isProduction;
  const controller = createAuthController(authService, isProduction);
  const limitChallengeRequests = createIpRateLimiter(
    MAX_CHALLENGES_PER_WINDOW,
    RATE_WINDOW_MS,
    'Too many sign-in requests. Try again later.',
    5000
  );
  const limitSignInRequests = createIpRateLimiter(
    MAX_CHALLENGES_PER_WINDOW,
    RATE_WINDOW_MS,
    'Too many sign-in attempts. Try again later.',
    5000
  );

  function requireAllowedOrigin(req: Request, res: Response, next: NextFunction) {
    const origin = req.header('origin');
    const allowedOrigins = config.appOrigin.split(',').map((value) => value.trim()).filter(Boolean);
    if (!origin || !allowedOrigins.includes(origin)) {
      return res.status(403).json({ msg: 'Request origin is not allowed.' });
    }
    return next();
  }

  router.post('/nonce', requireAllowedOrigin, limitChallengeRequests, controller.createChallenge);
  router.post('/metamask', requireAllowedOrigin, limitSignInRequests, controller.signIn);
  router.get('/session', auth, (req, res) => {
    res.set('Cache-Control', 'no-store');
    return res.json({ user: req.user });
  });
  router.post('/logout', auth, (_req, res) => {
    const production = isProduction;
    res.clearCookie(production ? '__Host-peerloop_session' : 'peerloop_session', {
      httpOnly: true,
      secure: production,
      sameSite: production ? 'none' : 'lax',
      path: '/'
    });
    res.set('Cache-Control', 'no-store');
    return res.status(204).end();
  });
  return router;
}

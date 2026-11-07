import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createAuthController } from './authController';
import type { createAuthService } from './authService';

const RATE_WINDOW_MS = 60 * 1000;
const MAX_CHALLENGES_PER_WINDOW = 10;
const MAX_RATE_LIMIT_ENTRIES = 5000;

export function createAuthRouter(authService: ReturnType<typeof createAuthService>) {
  const router = express.Router();
  const controller = createAuthController(authService);
  const challengeRateLimits = new Map<string, { count: number; resetAt: number }>();

  function limitChallengeRequests(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const key = req.socket.remoteAddress || 'unknown';
    let entry = challengeRateLimits.get(key);

    if (!entry || now >= entry.resetAt) {
      if (!entry && challengeRateLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
        for (const [address, limit] of challengeRateLimits) {
          if (now >= limit.resetAt) challengeRateLimits.delete(address);
        }
        if (challengeRateLimits.size >= MAX_RATE_LIMIT_ENTRIES) {
          return res.status(429).json({ msg: 'Too many sign-in requests. Try again later.' });
        }
      }
      entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    }

    if (entry.count >= MAX_CHALLENGES_PER_WINDOW) {
      return res.status(429).json({ msg: 'Too many sign-in requests. Try again later.' });
    }
    entry.count += 1;
    challengeRateLimits.set(key, entry);
    return next();
  }

  const signInRateLimit = new Map<string, { count: number; resetAt: number }>();

  function limitSignInRequests(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const key = req.socket.remoteAddress || 'unknown';
    let entry = signInRateLimit.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
      signInRateLimit.set(key, entry);
    }

    if (entry.count >= MAX_CHALLENGES_PER_WINDOW) {
      return res.status(429).json({ msg: 'Too many sign-in attempts. Try again later.' });
    }

    entry.count += 1;
    return next();
  }

  router.post('/nonce', limitChallengeRequests, controller.createChallenge);
  router.post('/metamask', limitSignInRequests, controller.signIn);
  return router;
}

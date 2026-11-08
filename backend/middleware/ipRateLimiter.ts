import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

export function createIpRateLimiter(
  maxRequests: number,
  windowMs: number,
  message: string,
  maxBuckets = 10_000
) {
  if (!Number.isInteger(maxRequests) || maxRequests < 1
    || !Number.isInteger(windowMs) || windowMs < 1
    || !Number.isInteger(maxBuckets) || maxBuckets < 1) {
    throw new Error('Rate limiter limits must be positive integers.');
  }

  const buckets = new Map<string, Bucket>();
  let lastCleanupAt = Date.now();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    if (now - lastCleanupAt >= windowMs) {
      for (const [address, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(address);
      }
      lastCleanupAt = now;
    }

    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      if (!bucket && buckets.size >= maxBuckets) {
        return res.status(503).json({ msg: 'Rate limiter capacity is temporarily exhausted.' });
      }
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= maxRequests) {
      return res.status(429).json({ msg: message });
    }

    bucket.count += 1;
    return next();
  };
}

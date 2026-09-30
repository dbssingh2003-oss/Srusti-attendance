import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis';
import { AppError } from '../lib/errors';

interface RateLimitOptions {
  /** Max requests in the window */
  max: number;
  /** Window in seconds */
  windowSec: number;
  /** Key generator: return a string key per unique client */
  keyGen: (req: Request) => string;
}

/**
 * Rate limit middleware using Redis sliding window counter.
 */
export function rateLimit(options: RateLimitOptions) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const key = `rl:${options.keyGen(req)}`;
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.expire(key, options.windowSec);
      }
      if (current > options.max) {
        throw new AppError('RATE_LIMITED', 429, 'Too many requests. Please try again later.');
      }
      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        // If Redis is down, let the request through (fail open for rate limiting)
        next();
      }
    }
  };
}

// Pre-configured limiters
export const loginLimiter = rateLimit({
  max: 5,
  windowSec: 900, // 15 min
  keyGen: (req) => `login:${req.ip}:${req.body?.email ?? 'unknown'}`,
});

export const checkinLimiter = rateLimit({
  max: 5,
  windowSec: 60,
  keyGen: (req) => `checkin:user:${req.user?.id ?? req.ip}`,
});

export const checkinIpLimiter = rateLimit({
  max: 30,
  windowSec: 60,
  keyGen: (req) => `checkin:ip:${req.ip}`,
});

export const forgotPasswordLimiter = rateLimit({
  max: 3,
  windowSec: 3600,
  keyGen: (req) => `forgot:${req.body?.email ?? req.ip}`,
});

export const generalLimiter = rateLimit({
  max: 300,
  windowSec: 60,
  keyGen: (req) => `gen:${req.user?.id ?? req.ip}`,
});

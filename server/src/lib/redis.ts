import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

// In-memory fallback map for environments without an active Redis instance (e.g. Vercel serverless)
const memoryStore = new Map<string, { count: number; expiresAt: number }>();

class MemoryRedisFallback {
  async incr(key: string): Promise<number> {
    const now = Date.now();
    const entry = memoryStore.get(key);
    if (!entry || entry.expiresAt < now) {
      memoryStore.set(key, { count: 1, expiresAt: now + 60000 });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = memoryStore.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + seconds * 1000;
      return 1;
    }
    return 0;
  }

  on() {
    return this;
  }
}

const isRedisConfigured =
  Boolean(process.env.REDIS_URL) &&
  process.env.REDIS_URL !== 'redis://localhost:6379' &&
  !process.env.REDIS_URL?.includes('127.0.0.1');

let redisClient: any;

if (isRedisConfigured) {
  try {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 2) return null;
        return Math.min(times * 200, 1000);
      },
    });
    redisClient.on('connect', () => logger.info('Redis connected'));
    redisClient.on('error', (err: any) => logger.debug({ err: err.message }, 'Redis optional connection note'));
  } catch {
    redisClient = new MemoryRedisFallback();
  }
} else {
  redisClient = new MemoryRedisFallback();
}

export const redis = redisClient;
export const createRedisClient = () => (isRedisConfigured ? new Redis(env.REDIS_URL) : new MemoryRedisFallback());


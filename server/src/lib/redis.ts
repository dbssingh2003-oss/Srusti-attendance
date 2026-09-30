import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 2) return null; // do not spam if Redis is absent
    const delay = Math.min(times * 200, 1000);
    return delay;
  },
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.debug({ err: err.message }, 'Redis optional connection note'));

// Create a duplicate connection for Socket.IO subscriber
export const createRedisClient = () => new Redis(env.REDIS_URL);

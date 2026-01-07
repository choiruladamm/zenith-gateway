import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_URL;
const redisToken = process.env.UPSTASH_REDIS_TOKEN;

if (!redisUrl || !redisToken) {
  // Graceful fallback for local dev if needed, or throw error
  console.warn(
    'Missing Redis environment variables. Rate limiting will be disabled.',
  );
}

export const redis =
  redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

import { Context, Next } from 'hono';
import { redis } from '../services/redis.js';
import { logger } from '../services/logger.js';
import { Variables } from '../types/index.js';
import { HEADERS, REDIS_KEYS, TIME } from '../constants/index.js';

/**
 * Middleware that enforces both throughput limits and usage quotas.
 *
 * Implements two distinct layers of protection:
 * 1. Monthly Quota: Hard limit on total requests per calendar month. Checked first
 *    to block heavy users from exceeding their plan.
 * 2. Minute Rate Limit: Bursts/Throughput protection using a 1-minute sliding window
 *    via Redis INCR/EXPIRE. Ensures fair usage and prevents upstream saturation.
 *
 * Reports status via 'X-RateLimit-*' headers for client-side awareness.
 */
const fallbackStore = new Map<string, { count: number; expiresAt: number }>();
const FALLBACK_LIMIT = 100; // Requests per minute per IP when Redis is down
const CLEANUP_INTERVAL = 60000; // 1 minute

// Simple cleanup for fallback store
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of fallbackStore.entries()) {
    if (now > value.expiresAt) {
      fallbackStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

import { problems } from '../utils/problems.js';

export const rateLimitMiddleware = async (
  c: Context<{ Variables: Variables }>,
  next: Next,
) => {
  const apiKeyInfo = c.get('apiKeyInfo');

  // ---------------------------------------------------------
  // 1. REDIS FALLBACK (SAFETY NET)
  // ---------------------------------------------------------
  // If Redis provides no protection, we must enforce a local safety net
  // to prevent total system abuse during outages.
  if (!apiKeyInfo || !redis) {
    if (!redis) {
      const ip = c.req.header('CF-Connecting-IP') || 'unknown-ip';
      const now = Date.now();
      const record = fallbackStore.get(ip) || {
        count: 0,
        expiresAt: now + 60000,
      };

      if (now > record.expiresAt) {
        record.count = 0;
        record.expiresAt = now + 60000;
      }

      record.count++;
      fallbackStore.set(ip, record);

      if (record.count > FALLBACK_LIMIT) {
        logger.warn(
          { ip, count: record.count },
          'Emergency Rate Limit Active (Redis Down)',
        );
        return problems.rateLimited(
          c,
          'Service is in emergency mode. Please slow down.',
          60,
        );
      }
    }
    return await next();
  }

  const plan = apiKeyInfo.plans;
  if (!plan) return await next();

  const limit = plan.rate_limit_per_min;
  const quota = plan.monthly_quota;

  const now = new Date();
  const monthKey = `${REDIS_KEYS.MONTHLY_USAGE_PREFIX}:${apiKeyInfo.id}:${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const minuteKey = `${REDIS_KEYS.RATELIMIT_PREFIX}:${apiKeyInfo.id}:${Math.floor(Date.now() / TIME.ONE_MINUTE_IN_MS)}`;

  try {
    const currentMonthly = (await redis.get<number>(monthKey)) || 0;
    if (currentMonthly >= quota) {
      logger.warn(
        { api_key_id: apiKeyInfo.id, monthly_usage: currentMonthly, quota },
        'Monthly quota exceeded',
      );
      return problems.quotaExceeded(
        c,
        `Monthly quota of ${quota} requests exceeded.`,
      );
    }

    const currentMinute = await redis.incr(minuteKey);

    if (currentMinute === 1) {
      await redis.expire(minuteKey, TIME.ONE_MINUTE_IN_SECONDS);
    }

    if (currentMinute > limit) {
      logger.warn(
        { api_key_id: apiKeyInfo.id, rate_limit: limit },
        'Rate limit exceeded',
      );
      return problems.rateLimited(
        c,
        `Plan limit of ${limit} req/min exceeded.`,
      );
    }

    redis
      .incr(monthKey)
      .catch((e) => logger.error({ e }, 'Failed to increment monthly usage'));

    c.header(HEADERS.RATELIMIT_LIMIT, limit.toString());
    c.header(
      HEADERS.RATELIMIT_REMAINING,
      Math.max(0, limit - currentMinute).toString(),
    );
  } catch (error: any) {
    logger.error({ error: error.message }, 'Redis Rate Limit Error');
    // If Redis fails mid-flight, we fail open but log it.
    // The next request will likely catch the !redis check above.
  }

  await next();
};

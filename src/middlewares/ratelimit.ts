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
export const rateLimitMiddleware = async (
  c: Context<{ Variables: Variables }>,
  next: Next,
) => {
  const apiKeyInfo = c.get('apiKeyInfo');
  if (!apiKeyInfo || !redis) return await next();

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
      return c.json(
        {
          error: 'Quota Exceeded',
          message: `Monthly quota of ${quota} requests exceeded.`,
        },
        429,
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
      return c.json(
        {
          error: 'Too Many Requests',
          message: `Plan limit of ${limit} req/min exceeded.`,
        },
        429,
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
  } catch (error) {
    logger.error({ error }, 'Redis Rate Limit Error');
  }

  await next();
};

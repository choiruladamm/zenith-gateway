import { Context, Next } from 'hono';
import { redis } from '../services/redis.js';
import { logger } from '../services/logger.js';
import { Variables } from '../types/index.js';
import { HEADERS, REDIS_KEYS, TIME } from '../constants/index.js';

export const rateLimitMiddleware = async (
  c: Context<{ Variables: Variables }>,
  next: Next,
) => {
  const apiKeyInfo = c.get('apiKeyInfo');
  if (!apiKeyInfo || !redis) return await next();

  const plan = apiKeyInfo.plans;
  if (!plan) return await next();

  const limit = plan.rate_limit_per_min;
  // Key format: ratelimit:<key_id>:<minute_timestamp>
  const key = `${REDIS_KEYS.RATELIMIT_PREFIX}:${apiKeyInfo.id}:${Math.floor(Date.now() / TIME.ONE_MINUTE_IN_MS)}`;

  try {
    const current = await redis.incr(key);

    if (current === 1) {
      await redis.expire(key, TIME.ONE_MINUTE_IN_SECONDS);
    }

    if (current > limit) {
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

    c.header(HEADERS.RATELIMIT_LIMIT, limit.toString());
    c.header(
      HEADERS.RATELIMIT_REMAINING,
      Math.max(0, limit - current).toString(),
    );
  } catch (error) {
    logger.error({ error }, 'Redis Rate Limit Error');
  }

  await next();
};

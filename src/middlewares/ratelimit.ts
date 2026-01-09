import { Context, Next } from 'hono';
import { redis } from '../services/redis.js';
import { logger } from '../services/logger.js';
import { Variables } from '../types/index.js';

export const rateLimitMiddleware = async (
  c: Context<{ Variables: Variables }>,
  next: Next,
) => {
  const apiKeyInfo = c.get('apiKeyInfo');
  if (!apiKeyInfo || !redis) return await next();

  const plan = apiKeyInfo.plans; // Joined in authMiddleware
  if (!plan) return await next();

  const limit = plan.rate_limit_per_min;
  const key = `ratelimit:${apiKeyInfo.id}:${Math.floor(Date.now() / 60000)}`;

  try {
    const current = await (redis as any).incr(key);

    if (current === 1) {
      await (redis as any).expire(key, 60);
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

    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, limit - current).toString());
  } catch (error) {
    logger.error({ error }, 'Redis Rate Limit Error');
  }

  await next();
};

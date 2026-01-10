import { Context, Next } from 'hono';
import { logger } from '../services/logger.js';
import { Variables } from '../types/index.js';
import { redis } from '../services/redis.js';
import { REDIS_KEYS } from '../constants/index.js';

/**
 * Middleware that tracks and logs request usage for analytics and billing.
 *
 * Performance design:
 * 1. Measures 'latency_ms' by wrapping the 'next()' call.
 * 2. Aggregates request metadata (path, method, status) after completion.
 * 3. Fire-and-Forget: Pushes log data to a Redis queue asynchronously.
 *    This ensures that database persistence doesn't block the client response.
 *    The 'worker' service will later dequeue and batch-insert these logs.
 */
export const usageMiddleware = async (
  c: Context<{ Variables: Variables }>,
  next: Next,
) => {
  const start = Date.now();

  await next();

  const duration = Date.now() - start;
  const apiKeyInfo = c.get('apiKeyInfo');

  if (!apiKeyInfo) return;

  const log_data = {
    key_id: apiKeyInfo.id,
    endpoint: c.req.path,
    method: c.req.method,
    status_code: c.res.status,
    latency_ms: duration,
  };

  if (redis) {
    (async () => {
      try {
        await redis.lpush(REDIS_KEYS.USAGE_LOG_QUEUE, JSON.stringify(log_data));
        logger.debug(
          { api_key_id: apiKeyInfo.id, latency_ms: duration },
          'Usage queued for batch processing',
        );
      } catch (err: any) {
        logger.error(
          { error: err.message, api_key_id: apiKeyInfo.id },
          'Failed to queue usage log',
        );
      }
    })();
  }
};

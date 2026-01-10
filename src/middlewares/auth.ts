import { Context, Next } from 'hono';
import { problems } from '../utils/problems.js';
import { db } from '../db/index.js';
import { apiKeys, plans } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../services/logger.js';
import { Variables } from '../types/index.js';
import { hashApiKey } from '../utils/crypto.js';
import { HEADERS, REDIS_KEYS } from '../constants/index.js';
import { redis } from '../services/redis.js';

/**
 * Middleware responsible for authenticating requests via API keys.
 *
 * Logic flow:
 * 1. Extraction: Retrieves 'X-Zenith-Key' from headers.
 * 2. Hashing: Computes SHA-256 hash of the plain-text key for secure lookup.
 * 3. Cache Check: Attempts to find hashed key metadata in Redis (cache-aside).
 * 4. DB Fallback: Queries Postgres (joining 'api_keys' and 'plans') if cache misses.
 * 5. Validation: Verifies key status (must be 'active') and existence.
 * 6. Cache Sync: Updates Redis with found metadata (5-minute TTL) for future hits.
 */
export const authMiddleware = async (
  c: Context<{ Variables: Variables }>,
  next: Next,
) => {
  const api_key = c.req.header(HEADERS.API_KEY);

  if (!api_key) {
    logger.debug('Auth failed: Missing API Key');
    return problems.unauthorized(c, 'Missing API Key');
  }

  try {
    const hashed_key = await hashApiKey(api_key);

    const cacheKey = `${REDIS_KEYS.API_KEY_CACHE_PREFIX}:${hashed_key}`;

    if (redis) {
      const cached = await redis.get<any>(cacheKey);
      if (cached) {
        logger.debug({ api_key_id: cached.id }, 'Auth successful (Cache Hit)');
        c.set('apiKeyInfo', cached);
        return await next();
      }
    }

    const [key_data] = (await db
      .select({
        id: apiKeys.id,
        org_id: apiKeys.org_id,
        key_hash: apiKeys.key_hash,
        status: apiKeys.status,
        plans: {
          id: plans.id,
          name: plans.name,
          rate_limit_per_min: plans.rate_limit_per_min,
          monthly_quota: plans.monthly_quota,
          price_per_1k_req: plans.price_per_1k_req,
          allowed_paths: plans.allowed_paths,
        },
      })
      .from(apiKeys)
      .leftJoin(plans, eq(apiKeys.plan_id, plans.id))
      .where(
        and(eq(apiKeys.key_hash, hashed_key), eq(apiKeys.status, 'active')),
      )
      .limit(1)) as any;

    if (!key_data) {
      logger.warn(
        {
          key_hint: api_key.substring(0, 4) + '...',
          hash_hint: hashed_key.substring(0, 8),
        },
        'Auth failed: Invalid or Inactive API Key',
      );
      return problems.unauthorized(c, 'Invalid or Inactive API Key');
    }

    if (redis) {
      await redis.set(cacheKey, JSON.stringify(key_data), { ex: 300 });
    }

    logger.debug({ api_key_id: key_data.id }, 'Auth successful (Cache Miss)');

    c.set('apiKeyInfo', key_data);

    await next();
  } catch (err: any) {
    logger.error({ error: err.message }, 'Internal Auth Error');
    return problems.internalError(
      c,
      'Internal Server Error during Authentication',
    );
  }
};

import { Context, Next } from 'hono';
import { db } from '../db/index.js';
import { apiKeys, plans } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../services/logger.js';
import { Variables } from '../types/index.js';
import { hashApiKey } from '../utils/crypto.js';
import { HEADERS } from '../constants/index.js';

export const authMiddleware = async (
  c: Context<{ Variables: Variables }>,
  next: Next,
) => {
  const api_key = c.req.header(HEADERS.API_KEY);

  if (!api_key) {
    logger.debug('Auth failed: Missing API Key');
    return c.json({ error: 'Unauthorized: Missing API Key' }, 401);
  }

  try {
    const hashed_key = await hashApiKey(api_key);

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
      return c.json(
        { error: 'Unauthorized: Invalid or Inactive API Key' },
        401,
      );
    }

    logger.debug({ api_key_id: key_data.id }, 'Auth successful');

    c.set('apiKeyInfo', key_data);

    await next();
  } catch (err: any) {
    logger.error({ error: err.message }, 'Internal Auth Error');
    return c.json(
      { error: 'Internal Server Error during Authentication' },
      500,
    );
  }
};

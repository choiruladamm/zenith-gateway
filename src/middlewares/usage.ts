import { Context, Next } from 'hono';
import { db } from '../db/index.js';
import { usageLogs } from '../db/schema.js';
import { logger } from '../services/logger.js';
import { Variables } from '../types/index.js';

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

  (async () => {
    try {
      await db.insert(usageLogs).values(log_data);
      logger.info(
        { api_key_id: apiKeyInfo.id, latency_ms: duration },
        'Usage logged successfully',
      );
    } catch (err: any) {
      logger.error(
        { error: err.message, api_key_id: apiKeyInfo.id },
        'Usage logging failed',
      );
    }
  })();
};

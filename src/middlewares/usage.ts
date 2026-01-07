import { Context, Next } from 'hono';
import { supabase } from '../services/supabase.js';
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

  const logData = {
    api_key_id: apiKeyInfo.id,
    endpoint: c.req.path,
    method: c.req.method,
    status_code: c.res.status,
    latency_ms: duration,
  };

  // Asynchronous logging to Supabase
  // We use the full promise chain properly to avoid lint issues with PromiseLike
  (async () => {
    try {
      const { error } = await supabase.from('usage_logs').insert(logData);
      if (error) {
        logger.error(
          { error: error.message, apiKeyId: apiKeyInfo.id },
          'Usage logging failed',
        );
      } else {
        logger.debug(
          { apiKeyId: apiKeyInfo.id, duration },
          'Usage logged successfully',
        );
      }
    } catch (err: any) {
      logger.error(
        { error: err.message, apiKeyId: apiKeyInfo.id },
        'Usage logging unhandled error',
      );
    }
  })();
};

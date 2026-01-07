import { Context, Next } from 'hono';
import { supabase } from '../services/supabase.js';
import { logger } from '../services/logger.js';
import { Variables } from '../types/index.js';
import { hashApiKey } from '../utils/crypto.js';

export const authMiddleware = async (
  c: Context<{ Variables: Variables }>,
  next: Next,
) => {
  const apiKey = c.req.header('X-Zenith-Key');

  if (!apiKey) {
    logger.debug('Auth failed: Missing API Key');
    return c.json({ error: 'Unauthorized: Missing API Key' }, 401);
  }

  try {
    const hashedKey = await hashApiKey(apiKey);

    const { data, error } = await supabase
      .from('api_keys')
      .select('*, plans(*)')
      .eq('key_hash', hashedKey)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      logger.warn(
        {
          error: error?.message,
          keyHint: apiKey.substring(0, 4) + '...',
          hashHint: hashedKey.substring(0, 8),
        },
        'Auth failed: Invalid or Inactive API Key',
      );
      return c.json(
        { error: 'Unauthorized: Invalid or Inactive API Key' },
        401,
      );
    }

    logger.debug({ apiKeyId: data.id }, 'Auth successful');

    // Attach key info to context for downstream middlewares
    c.set('apiKeyInfo', data as any);

    await next();
  } catch (err: any) {
    logger.error({ error: err.message }, 'Internal Auth Error');
    return c.json(
      { error: 'Internal Server Error during Authentication' },
      500,
    );
  }
};

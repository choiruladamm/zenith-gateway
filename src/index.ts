import { Hono } from 'hono';
import { authMiddleware } from './middlewares/auth.js';
import { usageMiddleware } from './middlewares/usage.js';
import { rateLimitMiddleware } from './middlewares/ratelimit.js';
import { forwardRequest } from './services/proxy.js';
import { logger } from './services/logger.js';
import { Variables } from './types/index.js';
import { validateConfig, config } from './services/config.js';

validateConfig();

const app = new Hono<{ Variables: Variables }>();

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.all(
  '/proxy/*',
  authMiddleware,
  rateLimitMiddleware,
  usageMiddleware,
  async (c) => {
    let url = c.req.url.replace(/.*\/proxy\//, '');

    if (url && !url.includes('://')) {
      url = 'https://' + url;
    }

    logger.info(
      {
        method: c.req.method,
        url,
        apiKeyId: c.get('apiKeyInfo')?.id,
      },
      'Incoming proxy request',
    );

    if (!url) {
      logger.warn('Proxy request missing target URL');
      return c.json({ error: 'Target URL is required' }, 400);
    }

    try {
      const response = await forwardRequest(url, c.req.raw);

      // Forward headers from upstream, but filter them too if needed
      const responseHeaders = new Headers(response.headers);

      // Merge headers from middlewares (e.g., rate-limit headers)
      c.res.headers.forEach((value, key) => {
        responseHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (error: any) {
      const status = error.message.startsWith('Forbidden') ? 403 : 502;
      logger.error({ error: error.message, url }, 'Proxy Error');
      return c.json(
        { error: 'Proxy Request Failed', details: error.message },
        status,
      );
    }
  },
);

const port = config.port;

logger.info(`Zenith Gateway running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};

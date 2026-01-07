import { Hono } from 'hono';
import { authMiddleware } from './middlewares/auth.js';
import { usageMiddleware } from './middlewares/usage.js';
import { rateLimitMiddleware } from './middlewares/ratelimit.js';
import { forwardRequest } from './services/proxy.js';
import { logger } from './services/logger.js';
import { Variables } from './types/index.js';
import { validateConfig, config } from './services/config.js';

// Validate environment on startup
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
    const url = c.req.url.replace(/.*\/proxy\//, '');

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

      // Create a new response to return to client
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    } catch (error: any) {
      logger.error({ error: error.message, url }, 'Proxy Error');
      return c.json(
        { error: 'Failed to forward request', details: error.message },
        502,
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

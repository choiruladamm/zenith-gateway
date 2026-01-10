import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { authMiddleware } from './middlewares/auth.js';
import { usageMiddleware } from './middlewares/usage.js';
import { rateLimitMiddleware } from './middlewares/ratelimit.js';
import { forwardRequest } from './services/proxy.js';
import { logger } from './services/logger.js';
import { Variables } from './types/index.js';
import { validateConfig, config } from './services/config.js';
import { startWorker } from './services/worker.js';

validateConfig();
startWorker();

const app = new Hono<{ Variables: Variables }>();

app.use('*', secureHeaders());

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Main Proxy Route Handler
 *
 * This handler orchestrates the core gateway logic:
 * 1. URL Resolution: Extracts the target upstream URL from the request path.
 * 2. Protocol Normalization: Ensures the target URL uses a protocol (defaults to 'https://').
 * 3. Middleware Execution: Auth, Rate Limiting, and Usage tracking are applied.
 * 4. Header Merging: Carefully merges headers from the upstream response with headers
 *    set by local middlewares (like security headers and ratelimit info).
 */
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

      const responseHeaders = new Headers(response.headers);

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

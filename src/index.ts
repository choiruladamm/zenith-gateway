import { Hono } from 'hono';
import { logger } from 'hono/logger';

const app = new Hono();

// Middlewares
app.use('*', logger());

// Health Check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy Route (Skeleton)
app.all('/v1/proxy', async (c) => {
  const targetUrl = c.req.query('url');
  const apiKey = c.req.header('X-Zenith-Key');

  if (!targetUrl) {
    return c.json({ error: 'Missing target url' }, 400);
  }

  if (!apiKey) {
    return c.json({ error: 'Missing API Key' }, 401);
  }

  // TODO: Implement Auth / Rate Limit / Forwarding logic
  return c.json({
    message: 'Zenith Gateway is ready!',
    target: targetUrl,
    key_hint: apiKey.substring(0, 4) + '...',
  });
});

const port = process.env.PORT || 3000;
console.log(`🚀 Zenith Gateway running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};

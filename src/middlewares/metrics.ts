import { Context, Next } from 'hono';
import { metrics } from '../services/metrics.js';

/**
 * Middleware that tracks request processing for metrics.
 * Records labeled Prometheus metrics including duration.
 */
export const metricsMiddleware = async (c: Context, next: Next) => {
  const start = performance.now();
  const method = c.req.method;

  // Extract target host for labeling
  // Example: http://localhost:3000/proxy/api.openai.com/v1/... -> api.openai.com
  let target = 'unknown';
  try {
    const urlStr = c.req.url;
    const proxyIdx = urlStr.indexOf('/proxy/');
    if (proxyIdx !== -1) {
      const remaining = urlStr.substring(proxyIdx + 7);
      const hostMatch = remaining.match(/^([^/]+)/);
      if (hostMatch) {
        target = hostMatch[1];
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }

  try {
    await next();

    const duration = performance.now() - start;
    const status = c.res.status;

    metrics.recordRequest(method, status, target, duration);
  } catch (err) {
    const duration = performance.now() - start;
    // Record hard exceptions as 500 equivalent if not already set
    metrics.recordRequest(method, 500, target, duration);
    throw err;
  }
};

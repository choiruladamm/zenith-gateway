import { expect, test, describe } from 'bun:test';
import app from './index.js';

describe('Zenith Gateway', () => {
  test('GET /health should return 200', async () => {
    const res = await app.fetch(new Request('http://localhost/health'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
  });

  test('Security headers should be present', async () => {
    const res = await app.fetch(new Request('http://localhost/health'));
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
  });

  test('GET /proxy without auth should return 401', async () => {
    const res = await app.fetch(
      new Request('http://localhost/proxy/example.com'),
    );
    expect(res.status).toBe(401);
  });

  test('GET /proxy with valid key should forward request', async () => {
    const res = await app.fetch(
      new Request(
        'http://localhost/proxy/jsonplaceholder.typicode.com/todos/1',
        {
          headers: {
            'X-Zenith-Key': 'zenith_test_key_123',
          },
        },
      ),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);

    expect(res.headers.get('X-RateLimit-Limit')).toBeDefined();
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
  });

  test('SSRF Block: Private IP should return 403', async () => {
    const res = await app.fetch(
      new Request('http://localhost/proxy/localhost:3000', {
        headers: {
          'X-Zenith-Key': 'zenith_test_key_123',
        },
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.details).toContain('blocked');
  });

  test('Usage batching: should push to Redis', async () => {
    const { redis } = await import('./services/redis.js');
    const { REDIS_KEYS } = await import('./constants/index.js');

    if (redis) await redis.del(REDIS_KEYS.USAGE_LOG_QUEUE);

    const res = await app.fetch(
      new Request(
        'http://localhost/proxy/jsonplaceholder.typicode.com/todos/2',
        {
          headers: {
            'X-Zenith-Key': 'zenith_test_key_123',
          },
        },
      ),
    );

    expect(res.status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 100));

    if (redis) {
      const queueLen = await redis.llen(REDIS_KEYS.USAGE_LOG_QUEUE);
      expect(queueLen).toBeGreaterThan(0);

      const lastItem = await redis.lindex(REDIS_KEYS.USAGE_LOG_QUEUE, 0);

      const parsed: any =
        typeof lastItem === 'string' ? JSON.parse(lastItem) : lastItem;
      expect(parsed.endpoint).toContain(
        '/proxy/jsonplaceholder.typicode.com/todos/2',
      );
    }
  });

  test('Monthly Quota Enforcement (Mock Test)', async () => {
    const { redis } = await import('./services/redis.js');
    const { REDIS_KEYS } = await import('./constants/index.js');

    if (redis) {
      const now = new Date();

      const keyId = 'c8636497-a91c-4e4d-8622-a2a82c9ea211';
      const monthKey = `${REDIS_KEYS.MONTHLY_USAGE_PREFIX}:${keyId}:${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

      await redis.set(monthKey, 1000000);

      const res = await app.fetch(
        new Request(
          'http://localhost/proxy/jsonplaceholder.typicode.com/todos/1',
          {
            headers: { 'X-Zenith-Key': 'zenith_test_key_123' },
          },
        ),
      );

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe('Quota Exceeded');

      await redis.del(monthKey);
    }
  });
});

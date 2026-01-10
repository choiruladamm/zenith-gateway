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

  describe('Tiered Access Controller', () => {
    test('Should ALLOW access to permitted exact path', async () => {
      // Note: In seed.ts, zenith_test_key_123 has allowed_paths: ['*']
      // Let's assume for this test we use the default seeded key.
      const res = await app.fetch(
        new Request(
          'http://localhost/proxy/jsonplaceholder.typicode.com/todos/1',
          {
            headers: { 'X-Zenith-Key': 'zenith_test_key_123' },
          },
        ),
      );
      expect(res.status).toBe(200);
    });

    test('Should BLOCK access for restricted paths', async () => {
      const { db } = await import('./db/index.js');
      const { plans, apiKeys, organizations } = await import('./db/schema.js');
      const { hashApiKey } = await import('./utils/crypto.js');
      const { eq } = await import('drizzle-orm');
      const { redis } = await import('./services/redis.js');

      // 1. Create a restricted plan
      const [restrictedPlan] = await db
        .insert(plans)
        .values({
          name: 'Testing Restricted',
          rate_limit_per_min: 10,
          monthly_quota: 100,
          price_per_1k_req: '1.00',
          allowed_paths: ['/allowed/endpoint/*'],
        })
        .returning();

      const [org] = await db
        .insert(organizations)
        .values({ name: 'Testing Org' })
        .returning();

      const restrictedKeyRaw = 'zenith_restricted_unit_test';
      const [key] = await db
        .insert(apiKeys)
        .values({
          org_id: org.id,
          plan_id: restrictedPlan.id,
          key_hash: await hashApiKey(restrictedKeyRaw),
          hint: 'restricted_unit',
          status: 'active',
        })
        .returning();

      if (redis) await redis.flushall(); // Clear cache

      // 2. Test forbidden path
      const resForbidden = await app.fetch(
        new Request('http://localhost/proxy/some-other-domain.com/secret', {
          headers: { 'X-Zenith-Key': restrictedKeyRaw },
        }),
      );
      expect(resForbidden.status).toBe(403);
      const bodyForbidden = await resForbidden.json();
      expect(bodyForbidden.error).toBe('Forbidden');

      // 3. Test allowed path (wildcard)
      const resAllowed = await app.fetch(
        new Request('http://localhost/proxy/allowed/endpoint/resource/1', {
          headers: { 'X-Zenith-Key': restrictedKeyRaw },
        }),
      );
      // It should pass access check. 502/Failed to fetch is okay as the target doesn't exist.
      expect(resAllowed.status).not.toBe(403);

      // Cleanup
      await db.delete(apiKeys).where(eq(apiKeys.id, key.id));
      await db.delete(plans).where(eq(plans.id, restrictedPlan.id));
    });
  });

  test('SSRF Block: Domain not in allowlist', async () => {
    const { config } = await import('./services/config.js');
    const originalAllowed = config.allowedDomains;

    // Temporarily set allowlist
    config.allowedDomains = ['trusted-api.com'];

    const res = await app.fetch(
      new Request('http://localhost/proxy/evil-domain.com/data', {
        headers: {
          'X-Zenith-Key': 'zenith_test_key_123',
        },
      }),
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.details).toContain('not in the allowlist');

    // Restore
    config.allowedDomains = originalAllowed;
  });

  test('Security: Internal headers should be stripped before forwarding', async () => {
    // We use a real-ish request and check if we can inspect what's being sent.
    // Since we use the real fetch, it's hard to inspect without a mock server.
    // However, we can test it by proxying to a service that echoes headers.
    // httpbin.org/headers is a good candidate.

    const res = await app.fetch(
      new Request('http://localhost/proxy/httpbin.org/headers', {
        headers: {
          'X-Zenith-Key': 'zenith_test_key_123',
          'User-Agent': 'Zenith-Test',
          'X-Custom-Header': 'should-persist',
        },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    const headers = body.headers;

    // These should be MISSING or different
    expect(headers['X-Zenith-Key']).toBeUndefined();

    // These should PERSIST
    expect(headers['User-Agent']).toBe('Zenith-Test');
    expect(headers['X-Custom-Header']).toBe('should-persist');
  });
});

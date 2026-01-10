import { expect, test, describe, beforeAll, afterAll } from 'bun:test';
import app from './index.js';

describe('Zenith Gateway', () => {
  test('GET /health should return 200', async () => {
    const res = await app.fetch(new Request('http://localhost/health'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
  });

  test('GET /proxy without auth should return 401', async () => {
    const res = await app.fetch(
      new Request('http://localhost/proxy/example.com'),
    );
    expect(res.status).toBe(401);
  });

  test('GET /proxy with invalid key should return 401', async () => {
    const res = await app.fetch(
      new Request('http://localhost/proxy/example.com', {
        headers: {
          'X-Zenith-Key': 'invalid_key',
        },
      }),
    );
    expect(res.status).toBe(401);
  });

  test('GET /proxy with valid key should forward request and include rate limit headers', async () => {
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

    const limit = res.headers.get('X-RateLimit-Limit');
    const remaining = res.headers.get('X-RateLimit-Remaining');

    expect(limit).toBe('60');
    expect(Number(remaining)).toBeLessThan(60);
  });

  test('GET /proxy should increment rate limit counter', async () => {
    const res1 = await app.fetch(
      new Request(
        'http://localhost/proxy/jsonplaceholder.typicode.com/todos/1',
        {
          headers: {
            'X-Zenith-Key': 'zenith_test_key_123',
          },
        },
      ),
    );
    const remaining1 = Number(res1.headers.get('X-RateLimit-Remaining'));

    const res2 = await app.fetch(
      new Request(
        'http://localhost/proxy/jsonplaceholder.typicode.com/todos/1',
        {
          headers: {
            'X-Zenith-Key': 'zenith_test_key_123',
          },
        },
      ),
    );
    const remaining2 = Number(res2.headers.get('X-RateLimit-Remaining'));

    expect(remaining2).toBe(remaining1 - 1);
  });

  test('Usage should be logged in database', async () => {
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

    await new Promise((resolve) => setTimeout(resolve, 500));

    const { db } = await import('./db/index.js');
    const { desc } = await import('drizzle-orm');
    const { usageLogs: usageLogsSchema } = await import('./db/schema.js');

    const logs = await db
      .select()
      .from(usageLogsSchema)
      .orderBy(desc(usageLogsSchema.timestamp))
      .limit(1);

    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].endpoint).toContain(
      '/proxy/jsonplaceholder.typicode.com/todos/2',
    );
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

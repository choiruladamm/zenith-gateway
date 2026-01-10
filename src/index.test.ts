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
    expect(body.detail).toContain('blocked');
    expect(body.type).toContain('forbidden');
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
    const { hashApiKey } = await import('./utils/crypto.js');
    const { db } = await import('./db/index.js');
    const { apiKeys } = await import('./db/schema.js');
    const { eq } = await import('drizzle-orm');

    if (redis) {
      const now = new Date();
      const testKey = 'zenith_test_key_123';
      const hashed = await hashApiKey(testKey);

      // Fetch dynamic ID
      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.key_hash, hashed));

      expect(keyRecord).toBeDefined();

      const keyId = keyRecord.id;
      const monthKey = `${REDIS_KEYS.MONTHLY_USAGE_PREFIX}:${keyId}:${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Set quota exhausted
      await redis.set(monthKey, 1000000000); // Massive number

      try {
        const res = await app.fetch(
          new Request(
            'http://localhost/proxy/jsonplaceholder.typicode.com/todos/1',
            {
              headers: { 'X-Zenith-Key': testKey },
            },
          ),
        );

        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.title).toBe('Quota Exceeded');
        expect(body.type).toContain('quota-exceeded');
      } finally {
        await redis.del(monthKey);
      }
    }
  });

  describe('Tiered Access Controller', () => {
    test('Should ALLOW access to permitted exact path', async () => {
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

      const planName = `Testing Restricted ${Date.now()}`;
      let planId: string | undefined;
      let keyId: string | undefined;

      try {
        /**
         * Create a restricted plan
         */
        const [restrictedPlan] = await db
          .insert(plans)
          .values({
            name: planName,
            rate_limit_per_min: 10,
            monthly_quota: 100,
            price_per_1k_req: '1.00',
            allowed_paths: ['/allowed/endpoint/*'],
          })
          .returning();
        planId = restrictedPlan.id;

        const [org] = await db
          .insert(organizations)
          .values({ name: 'Testing Org' })
          .returning();

        const restrictedKeyRaw = `zenith_restricted_${Date.now()}`;
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
        keyId = key.id;

        if (redis) await redis.flushall();

        /**
         * Test forbidden path
         */
        const resForbidden = await app.fetch(
          new Request('http://localhost/proxy/some-other-domain.com/secret', {
            headers: { 'X-Zenith-Key': restrictedKeyRaw },
          }),
        );

        const bodyForbidden = await resForbidden.json();

        expect(resForbidden.status).toBe(403);
        expect(bodyForbidden.title).toBe('Forbidden');
        expect(bodyForbidden.type).toContain('forbidden');

        /**
         * Test allowed path (wildcard)
         */
        const resAllowed = await app.fetch(
          new Request('http://localhost/proxy/allowed/endpoint/resource/1', {
            headers: { 'X-Zenith-Key': restrictedKeyRaw },
          }),
        );
        expect(resAllowed.status).not.toBe(403);
      } finally {
        // Cleanup
        if (keyId) await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
        if (planId) await db.delete(plans).where(eq(plans.id, planId));
      }
    });
  });

  test('SSRF Block: Domain not in allowlist', async () => {
    const { config } = await import('./services/config.js');
    const originalAllowed = config.allowedDomains;

    // Temporarily set allowlist
    config.allowedDomains = ['trusted-api.com'];

    try {
      const res = await app.fetch(
        new Request('http://localhost/proxy/evil-domain.com/data', {
          headers: {
            'X-Zenith-Key': 'zenith_test_key_123',
          },
        }),
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.detail).toContain('not in the allowlist');
      expect(body.type).toContain('forbidden');
    } finally {
      // Restore
      config.allowedDomains = originalAllowed;
    }
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

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
});

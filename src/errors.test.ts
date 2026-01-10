import { expect, test, describe } from 'bun:test';
import app from './index.js';

describe('RFC 7807 Error Handling', () => {
  test('Missing API Key should return RFC 7807 Unauthorized', async () => {
    const res = await app.fetch(
      new Request('http://localhost/proxy/example.com'),
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(res.headers.get('Content-Type')).toBe('application/problem+json');
    expect(json).toEqual({
      type: 'https://zenith.io/probs/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Missing API Key',
      instance: '/proxy/example.com',
    });
  });

  // Since we don't have a valid mocked Redis/DB with API keys here easily,
  // we primarily test the "Missing API Key" case which doesn't hit DB/Redis.
});

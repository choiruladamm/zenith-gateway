import { expect, test, describe, beforeEach } from 'bun:test';
import app from './index.js';
import { metrics } from './services/metrics.js';

describe('Zenith Metrics', () => {
  beforeEach(() => {
    metrics.reset();
  });
  test('GET /metrics should return Prometheus format with labels', async () => {
    const res = await app.fetch(new Request('http://localhost/metrics'));
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(text).toContain('zenith_http_requests_total');
    expect(text).toContain('zenith_worker_queue_size');
    expect(text).toContain('zenith_http_request_duration_seconds_sum');
  });

  test('Metrics should include labels after a proxy request', async () => {
    // Send a proxy request
    await app.fetch(
      new Request(
        'http://localhost/proxy/jsonplaceholder.typicode.com/todos/1',
        {
          headers: {
            'X-Zenith-Key': 'zenith_test_key_123',
          },
        },
      ),
    );

    // Get metrics
    const res = await app.fetch(new Request('http://localhost/metrics'));
    const text = await res.text();

    expect(text).toContain('method="GET"');
    expect(text).toContain('status="200"');
    expect(text).toContain('target="jsonplaceholder.typicode.com"');
    expect(text).toContain(
      'zenith_http_requests_total{method="GET",status="200",target="jsonplaceholder.typicode.com"} 1',
    );
  });
});

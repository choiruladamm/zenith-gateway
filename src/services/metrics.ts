import { redis } from './redis.js';
import { REDIS_KEYS } from '../constants/index.js';

/**
 * Service to aggregate and format Prometheus-compatible metrics.
 */
export class MetricsService {
  private static instance: MetricsService;

  // Labeled counters: Map<"method=GET,status=200,target=...", count>
  private requests = new Map<string, number>();
  private errors = new Map<string, number>();

  // Latency tracking: Map<target, { sum: number, count: number }>
  private latencies = new Map<string, { sum: number; count: number }>();

  private constructor() {}

  public static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService();
    }
    return MetricsService.instance;
  }

  /**
   * Records a request with labels.
   */
  public recordRequest(
    method: string,
    status: number,
    target: string,
    durationMs: number,
  ) {
    const isError = status >= 400;
    const labelKey = `method="${method}",status="${status}",target="${target}"`;

    // Increment request counter
    this.requests.set(labelKey, (this.requests.get(labelKey) || 0) + 1);

    if (isError) {
      this.errors.set(labelKey, (this.errors.get(labelKey) || 0) + 1);
    }

    // Track latency
    const lat = this.latencies.get(target) || { sum: 0, count: 0 };
    lat.sum += durationMs / 1000; // Store in seconds (Prometheus standard)
    lat.count++;
    this.latencies.set(target, lat);
  }

  /**
   * Generates the Prometheus text format output.
   */
  public async getMetrics(): Promise<string> {
    const queueSize = redis ? await redis.llen(REDIS_KEYS.USAGE_LOG_QUEUE) : 0;

    const lines: string[] = [
      '# HELP zenith_http_requests_total Total HTTP requests handled',
      '# TYPE zenith_http_requests_total counter',
    ];

    for (const [labels, count] of this.requests) {
      lines.push(`zenith_http_requests_total{${labels}} ${count}`);
    }

    lines.push(
      '',
      '# HELP zenith_http_errors_total Total HTTP errors (4xx/5xx)',
      '# TYPE zenith_http_errors_total counter',
    );

    for (const [labels, count] of this.errors) {
      lines.push(`zenith_http_errors_total{${labels}} ${count}`);
    }

    lines.push(
      '',
      '# HELP zenith_http_request_duration_seconds_sum Total duration of HTTP requests in seconds',
      '# TYPE zenith_http_request_duration_seconds_sum counter',
    );
    for (const [target, data] of this.latencies) {
      lines.push(
        `zenith_http_request_duration_seconds_sum{target="${target}"} ${data.sum.toFixed(4)}`,
      );
    }

    lines.push(
      '',
      '# HELP zenith_http_request_duration_seconds_count Total count of HTTP requests for duration tracking',
      '# TYPE zenith_http_request_duration_seconds_count counter',
    );
    for (const [target, data] of this.latencies) {
      lines.push(
        `zenith_http_request_duration_seconds_count{target="${target}"} ${data.count}`,
      );
    }

    lines.push(
      '',
      '# HELP zenith_worker_queue_size Current number of logs pending in Redis queue',
      '# TYPE zenith_worker_queue_size gauge',
      `zenith_worker_queue_size ${queueSize}`,
    );

    return lines.join('\n') + '\n';
  }
}

export const metrics = MetricsService.getInstance();

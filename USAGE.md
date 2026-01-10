# Zenith Gateway: Developer Guide

This guide details how to configure, run, and interact with the Zenith Gateway.

## 1. Environment Configuration

Zenith requires the following environment variables. See `.env.example` for a template.

| Variable              | Description                                 | Example                  |
| :-------------------- | :------------------------------------------ | :----------------------- |
| `DATABASE_URL`        | Postgres connection string (Neon/RDS/Local) | `postgres://...`         |
| `UPSTASH_REDIS_URL`   | Redis REST API URL                          | `https://...`            |
| `UPSTASH_REDIS_TOKEN` | Redis Access Token                          | `...`                    |
| `ALLOWED_DOMAINS`     | Comma-separated list of safe target domains | `openai.com,httpbin.org` |

> [!TIP]
> Setting `ALLOWED_DOMAINS` is critical for production safety. If empty, the gateway handles this based on your `src/services/config.ts` defaults (usually restrictive).

## 2. Database & Migrations

We use **Drizzle Kit** for a provider-agnostic database experience. Migrations are stored in `./drizzle`.

- **Push Schema**: Immediately sync schema to DB (Dev/Stage)
  ```bash
  bun run db:push
  ```
- **Seed Data**: Populates default tiers (`Basic`, `Pro`, `Enterprise`) and a test key
  ```bash
  bun run db:seed
  ```

## 3. Tiered Access Control (Path Permissioning)

Zenith allows you to restrict access based on the request path. These rules are defined in the `plans` table's `allowed_paths` column.

### Matcher Logic

- **Exact Match**: `/api/v1/users` (only permits this specific path).
- **Wildcard Match**: `/api/v1/*` (permits anything starting with `/api/v1/`).
- **Unrestricted**: `*` (permits any path for that domain).

### Use Case

You can have a **Public Plan** restricted to `['/v1/public/*']` and a **Premium Plan** allowed to access `['*']`.

## 4. Interaction (The Proxy Endpoint)

The gateway exposes a single dynamic proxy route: `/proxy/*`.

### Format

`ANY http://localhost:3000/proxy/{TARGET_URL}`

### Example Request

```bash
curl -X POST "http://localhost:3000/proxy/api.openai.com/v1/chat/completions" \
     -H "X-Zenith-Key: <YOUR_API_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"model": "gpt-4", "messages": [...]}'
```

**What happens under the hood?**

1. Auth check (Redis cache hit/miss).
2. Tiered Path check (matches `api.openai.com/v1/chat/completions` against allowed patterns).
3. Rate Limit check.
4. SSRF Check (Hostname to IP resolution).
5. Forwarding (GET/HEAD requests automatically **retry up to 2x** on failure).

## 5. Understanding Status Codes

Zenith uses standard codes to signal specific gateway failures:

- **401 Unauthorized**: Missing or invalid `X-Zenith-Key`.
- **403 Forbidden**:
  - Hostname failed `ALLOWED_DOMAINS` check.
  - Target resolved to a **private/internal IP**.
  - Request path is **not permitted** by the API Key's tier.
- **429 Too Many Requests**: Monthly quota or per-minute rate limit hit.
- **502 Bad Gateway**: Upstream service is down after all retry attempts.

## 6. Observability

Zenith provides multiple ways to monitor your gateway's health and performance.

### Prometheus Metrics

The gateway exposes a real-time metrics endpoint at `GET /metrics`. This can be scraped by Prometheus or Datadog.

**Included Metrics:**

- `zenith_http_requests_total{method, status, target}`: Total requests handled.
- `zenith_http_errors_total{method, status, target}`: Total 4xx/5xx errors.
- `zenith_http_request_duration_seconds_count{target}`: Count of requests per target.
- `zenith_http_request_duration_seconds_sum{target}`: Total time spent on requests per target (in seconds).
- `zenith_worker_queue_size`: Gauge showing how many logs are waiting in Redis to be flushed to the DB.

**Example Output:**

```text
zenith_http_requests_total{method="GET",status="200",target="api.openai.com"} 42
zenith_http_request_duration_seconds_sum{target="api.openai.com"} 12.45
```

### Database Logs

Logs are batched and stored in the `usage_logs` table. You can query this table for:

- **Latency Analysis**: `latency_ms` per endpoint.
- **Billing**: Count requests per `key_id`.
- **Error Rates**: Status codes distribution per upstream provider.

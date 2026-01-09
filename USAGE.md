# Zenith Gateway Documentation

This guide covers the technical implementation details for configuring and interacting with the Zenith Gateway.

## Environment Configuration

Configure your `.env` file with the following required variables:

```bash
# PostgreSQL Connection (compatible with Neon, RDS, or local pg)
DATABASE_URL=postgres://user:password@localhost:5432/zenith_db

# Upstash Redis for Rate Limiting
UPSTASH_REDIS_URL=your_redis_url
UPSTASH_REDIS_TOKEN=your_redis_token

# App Port
PORT=3000

# SSRF Protection: Comma-separated allowlist of target hostnames
ALLOWED_DOMAINS=openai.com,httpbin.org,jsonplaceholder.typicode.com
```

## Database Management

We use **Drizzle ORM** for schema synchronization and data seeding.

### Push Schema

To sync your local schema definitions with the database instance:

```bash
bun run db:push
```

### Initial Data & Tests

To populate default plans (`Basic`, `Pro`, `Enterprise`) and create an initial test key:

```bash
bun run db:seed
```

_Note: This creates a default key `zenith_test_key_123` for immediate testing._

### API Key Generation

Access keys are SHA-256 hashed. Do not insert keys manually. Use the CLI tool:

```bash
bun run db:generate-key "optional-label"
```

## Making Requests

Zenith acts as a pass-through proxy. It expects the target URL to be appended to the `/proxy/` path.

### Request Format

- **Endpoint**: `ANY /proxy/<TARGET_URL>`
- **Header**: `X-Zenith-Key: <PLAIN_TEXT_KEY>`

### Example Construction

```bash
curl -X GET \
  -H "X-Zenith-Key: zenith_test_key_123" \
  "http://localhost:3000/proxy/httpbin.org/get"
```

The gateway automatically handles protocol prepending (defaults to `https://`) if not specified in the target URL.

## Gateway Response Headers

Every proxied request returns rate-limit metadata injected by the `rateLimitMiddleware`:

- `X-RateLimit-Limit`: Maximum requests permitted per 1-minute window.
- `X-RateLimit-Remaining`: Remaining allowance in the current window.

## HTTP Status Codes

The gateway implements the following specific status codes:

| Code    | Status            | Logic / Trigger                                           |
| :------ | :---------------- | :-------------------------------------------------------- |
| **200** | OK                | Upstream request resolved successfully.                   |
| **401** | Unauthorized      | Invalid key or missing `X-Zenith-Key` header.             |
| **403** | Forbidden         | Hostname failed SSRF allowlist check (`ALLOWED_DOMAINS`). |
| **429** | Too Many Requests | Rate limit exceeded (managed by Redis).                   |
| **502** | Bad Gateway       | Upstream target is unreachable or timed out.              |

## Telemetry & Logging

Asynchronous usage tracking is performed on every successful request. Records are persisted to the `usage_logs` table with the following data points:

- `key_id`: Reference to the authenticating API Key.
- `latency_ms`: Round-trip time of the upstream request.
- `status_code`: HTTP status returned from the target.
- `endpoint/method`: Target request metadata.

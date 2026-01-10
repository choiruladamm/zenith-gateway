# Zenith Gateway

Zenith is a high-performance API Gateway built on **Bun** and **Hono**, designed as a security and observability facade for your upstream services. It handles the "boring" parts of API management—authentication, tiered access, rate limiting, and telemetry—so you can focus on building your core features.

## Why Zenith?

Most gateways are either too heavy (Kong, Apigee) or too simple (basic reverse proxies). Zenith hits the sweet spot: small enough to be understood in an afternoon, but robust enough for production traffic with features like SSRF protection and asynchronous logging.

## Core Features

### 1. Unified Authentication & Auth Caching

Clients authenticate using a plan-based API Key (`X-Zenith-Key`). To minimize database overhead, Zenith uses a **Redis-backed cache-aside pattern**. The system hashes keys with SHA-256 and caches the plan metadata for 5 minutes, ensuring sub-millisecond auth checks for hot traffic.

### 2. Tiered Access Controller (New 🚀)

Enforce granular path-based permissions at the plan level. You can restrict certain API keys to specific endpoints or allow full access using wildcards.

- **Example**: A "Basic" plan might only access `/v1/public/*`, while "Enterprise" gets `/v1/*`.
- **Logic**: Path matching supports exact strings and suffix wildcards.

### 3. Distributed Rate Limiting & Quotas

Zenith implements a dual-layer protection system using Redis:

- **Per-minute limits**: Sliding window rate limiting to prevent sudden spikes.
- **Monthly Quotas**: Hard enforcement of monthly usage limits based on the user's Tier.

### 4. High-Throughput Asynchronous Telemetry

Observability shouldn't slow down your requests. Zenith uses a **Fire-and-Forget + Worker** strategy:

1. The gateway calculates latency and pushes a JSON log to a Redis queue.
2. A background worker batches these logs and performs bulk inserts into PostgreSQL every 10 seconds.
   This decouples hot-path proxying from database write latency.

### 5. Production-Grade SSRF Protection

To prevent Server-Side Request Forgery, Zenith:

- Resolves hostnames to IPs and rejects requests targeting **private/internal IP ranges**.
- Validates target domains against a strict **allowlist**.
- Strips sensitive internal headers (like `X-Zenith-Key`) before forwarding to the upstream.

## Technical Stack

- **Runtime**: [Bun](https://bun.sh/) (Native fetch & high performance)
- **Framework**: [Hono](https://hono.dev/) (Web standards compliant)
- **State/Cache**: Upstash Redis
- **Database**: PostgreSQL (Neon/Local) with Drizzle ORM
- **Logging**: Pino with batch processing

## Quick Setup

```bash
# 1. Install dependencies
bun install

# 2. Setup environment (check [USAGE.md](USAGE.md) for details)
cp .env.example .env

# 3. Initialize Database (Agnostic /drizzle structure)
bun run db:push
bun run db:seed

# 4. Fire it up
bun run dev
```

## Documentation

For detailed configuration, tiered access examples, and status code explanations, please refer to the [USAGE.md](USAGE.md) file.

## Performance & Testing

The gateway is built with performance as a first-class citizen. Running `bun test` ensures that all layers—from SSRF protection to tiered access—are working correctly under load.

```bash
bun test src/index.test.ts
```

## License

MIT - Build something cool.

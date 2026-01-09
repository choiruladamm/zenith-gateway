# Zenith Gateway

Zenith is a lightweight API Gateway/Proxy implementation built on **Hono**, **Bun**, and **Drizzle ORM**. It provides a centralized layer for authentication, tiered rate limiting, and asynchronous usage tracking.

## Technical Highlights

- **SSRF Protection**: Built-in domain allowlist and header sanitization to prevent unauthorized internal requests.
- **Node-less Performance**: Leverages Bun's native `fetch` and `crypto` for high throughput and low memory footprint.
- **Full Request Streaming**: Implemented with `duplex: 'half'` to handle large payloads (e.g., file uploads or AI completions) without buffering.
- **Async Usage Logging**: Request telemetry is pushed to PostgreSQL out-of-band to minimize response latency.
- **Distributed Rate Limiting**: Uses Upstash Redis for atomic counter increments across multiple serverless or containerized instances.

## Why Redis?

We use Redis exclusively for state management in the `rateLimitMiddleware`.

- **Latency**: We need sub-millisecond lookups for every request to avoid gateway bottlenecks.
- **Persistence**: Using Redis TTL ensures that rate-limit windows are automatically purged without manual cleanup or database overhead.

## Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Hono](https://hono.dev)
- **Database**: PostgreSQL + [Drizzle ORM](https://orm.drizzle.team)
- **State Store**: [Upstash Redis](https://upstash.com)
- **Logging**: [Pino](https://getpino.io)

## Quick Start

### 1. Installation

```bash
bun install
```

### 2. Configuration

Copy `.env.example` and populate your database and Redis credentials:

```bash
cp .env.example .env
```

### 3. Database Initialization

Sync the schema and seed default plans/test keys:

```bash
bun run db:push
bun run db:seed
```

### 4. API Key Generation

Keys are stored as SHA-256 hashes. Use the CLI script to generate new secure keys:

```bash
bun run db:generate-key "client-name"
```

## Usage

Requests should be proxied through the `/proxy/` endpoint with a valid `X-Zenith-Key` header.

```bash
curl -H "X-Zenith-Key: <YOUR_KEY>" \
     "http://localhost:3000/proxy/httpbin.org/get"
```

For more details on headers, metrics, and error codes, see [USAGE.md](USAGE.md).

## Production Deployment

### 1. Build

Compile the project into a optimized Bun binary:

```bash
bun run build
```

### 2. Runtime Environment

Ensure the following are configured in your production environment:

- **`NODE_ENV`**: Set to `production`.
- **`ALLOWED_DOMAINS`**: List your production target domains (e.g., `api.myapp.com`).
- **Database**: Use a managed Postgres instance (e.g., Neon, AWS RDS).
- **Redis**: Use Upstash Redis for global rate-limiting.

### 3. Run

Start the compiled production server:

```bash
bun start # or bun run dist/index.js
```

### Docker (Recommended)

You can use the official `oven/bun` image for containerized deployment:

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY . .
RUN bun install --production
RUN bun run build
EXPOSE 3000
CMD ["bun", "dist/index.js"]
```

## Project Structure

- `src/middlewares/`: Core gateway logic (Auth, Rate Limit, Usage).
- `src/db/`: Persistence layer, schema, and migration scripts.
- `src/services/`: Client wrappers for Redis, Logger, and Proxy handlers.
- `scripts/`: Development and maintenance utilities.

## License

MIT

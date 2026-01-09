# Zenith Gateway

Zenith is a centralized API Gateway implementation built to secure and monitor downstream services. It employs a facade pattern to handle authentication, rate limiting, and observability before forwarding requests to backend systems.

## Core Architecture & Features

### Centralized Authentication

**The Problem**: Managing authentication logic across disparate microservices leads to code duplication and security fragmentation.
**The Solution**: Zenith validates requests at the edge. Clients authenticate once with a Zenith API Key, and the gateway handles the handshake.
**Implementation**: Requests are validated against SHA-256 hashed keys stored in PostgreSQL.

### Tiered Rate Limiting

**The Problem**: Protecting upstream resources (like expensive LLM APIs) from abuse requires precise quota management.
**The Solution**: A sliding-window rate limiter utilizing Redis for atomic counters.
**Implementation**: Limits are dynamically reduced based on the "Plan" attached to the API Key (e.g., 60 RPM for Basic vs. 10k RPM for Enterprise).

### Asynchronous Telemetry

**The Problem**: Synchronous logging blocks the event loop and adds latency to the user response.
**The Solution**: Usage logs are dispatched asynchronously (out-of-band) after the response is sent to the client.
**Implementation**: Captures latency, status codes, and endpoint usage for billing and analytics without impacting throughput.

### SSRF Protection

**The Problem**: Open proxies are vulnerable to Server-Side Request Forgery, exposing internal networks.
**The Solution**: Strict validation of target hostnames against a pre-defined Allowlist.
**Implementation**: Requests to non-allowed domains (like `localhost` or internal IPs) are rejected with a 403 Forbidden before DNS resolution.

## Technical Stack

- **Runtime**: Bun (for native `fetch` performance)
- **Framework**: Hono (Web Standards compliant)
- **State Store**: Upstash Redis (High-performance counters)
- **Database**: PostgreSQL + Drizzle ORM (Configuration & Logs)

## Quick Start

### 1. Installation

```bash
bun install
```

### 2. Configuration

Copy `.env.example` and set your credentials:

```bash
cp .env.example .env
```

### 3. Database Initialization

Sync the schema and seed default data:

```bash
bun run db:push
bun run db:seed
```

### 4. Generate API Key

Use the CLI to generate a cryptographically secure key:

```bash
bun run db:generate-key "client-identifier"
```

## Usage

Proxy requests by appending the target URL to the `/proxy/` path and including the `X-Zenith-Key` header.

```bash
curl -H "X-Zenith-Key: <YOUR_KEY>" \
     "http://localhost:3000/proxy/httpbin.org/get"
```

## Production Build

Compile the project into a strict Bun binary:

```bash
bun run build
bun start
```

### Docker

The project includes a multi-stage Dockerfile optimized for the `oven/bun` runtime.

```bash
docker build -t zenith-gateway .
```

## License

MIT

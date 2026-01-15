# Zenith Gateway

[![Runtime](https://img.shields.io/badge/Runtime-Bun-black?logo=bun)](https://bun.sh/)
[![Framework](https://img.shields.io/badge/Framework-Hono-E36002?logo=hono)](https://hono.dev/)
[![Security](https://img.shields.io/badge/Security-Hardened-green)](https://github.com/choiruladamm/zenith-gateway/blob/main/TEST_REPORT.md)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

Zenith is a security-first, high-performance API Gateway built on **Bun** and **Hono**. Designed for resilience and observability, Zenith handles the complex orchestration of upstream communication—authentication, tiered RBAC, distributed rate limiting, and telemetry—with sub-millisecond overhead.

---

## 🏗 Engineering Philosophy

Zenith is built for developers who need more than a simple reverse proxy but less than a bloated enterprise suite. Our architecture focuses on three pillars:

1.  **Zero-Path Latency**: Leveraging a Redis-backed **cache-aside pattern** to ensure auth and quota checks don't hit the database on every request.
2.  **Asynchronous Observability**: A "Fire-and-Forget" Redis buffer coupled with a background worker ensures that telemetry ingestion adds **0ms** to upstream response times.
3.  **L7 Hardening**: Native protection against SSRF, DNS rebinding, and automated retries for safe, idempotent requests.

---

## ⚡ Core Features

### 1. Identity & Auth (Cache-Aside)
Auth is the first line of defense and the most frequent bottleneck. Zenith optimizes this by:
-   **SHA-256 Hashing**: API keys are stored as cryptographic hashes.
-   **Hot-Key Caching**: Using Upstash Redis with a 5-minute TTL to store plan metadata.
-   **Resilience**: Authenticates against PostgreSQL automatically if Redis is unreachable (Chaos tested).

### 2. Tiered Access Controller (RBAC)
Enforce granular, path-based permissions defined at the Plan level.
-   **Wildcard Support**: Restrict keys to specific sub-paths (e.g., `/v1/public/*`) or allow full access (`*`).
-   **Validation**: Strictly enforced at the gateway late before any upstream request is initiated.

### 3. Distributed Rate Limiting & Quotas
Protect your upstream services from spikes and protect your business from over-usage:
-   **Rate Limiting**: Sliding window implementation in Redis for per-minute protection.
-   **Monthly Quotas**: Hard-blocked usage caps linked to tenant billing tiers.

### 4. Telemetry via Async Batching
High-throughput logging without the performance penalty:
1.  **Ingest**: Gateway pushes request/response metadata to a Redis queue.
2.  **Batch**: A background worker performs bulk inserts (Batch size: 100) into PostgreSQL every 10s.
3.  **Metrics**: Native Prometheus `/metrics` endpoint for real-time monitoring of security blocks and error rates. See [Observability](USAGE.md#6-observability) for details.

### 5. L7 SSRF Protection & Resiliency
Hardened for production traffic:
-   **L7 Security**: Resolves hostnames to IPs and rejects targets in private/internal CIDR ranges.
-   **Safe Retries**: Automatically retries `GET` and `HEAD` requests (up to 2 times) with exponential backoff on upstream failures.

---

## 🔬 Battle-Tested Resilience

Zenith isn't just "built"; it's verified. We maintain a detailed [TEST_REPORT.md](TEST_REPORT.md) covering:
-   **Chaos Engineering**: Verification of auth flow survival during total Redis outages.
-   **Security Audits**: Automated blocking of localhost and private LAN traversal attacks.
-   **Quota Rigidity**: Verification of immediate 429 responses once monthly caps are hit.

---

## 🛠 Technical Stack

| Component | Technology |
| :--- | :--- |
| **Runtime** | [Bun](https://bun.sh/) (Native Fetch, high-perf I/O) |
| **Framework** | [Hono](https://hono.dev/) (Web Standards, ultra-fast) |
| **Persistence** | PostgreSQL (Neon/Local) |
| **Caching** | Upstash Redis |
| **ORM** | Drizzle |
| **Observability** | Pino + Prometheus |

---

## 📦 Quick Start

```bash
# 1. Install
bun install

# 2. Setup Environment
# Check USAGE.md for critical variables like ALLOWED_DOMAINS
cp .env.example .env

# 3. Initialize & Seed
bun run db:push
bun run db:seed

# 4. Launch
bun run dev
```

## 📖 Documentation & Usage

For a deep dive into using Zenith Gateway, check out the **[Developer Guide (USAGE.md)](USAGE.md)**:
- **[Configuration](USAGE.md#1-environment-configuration)**: Domain allowlists and Redis setup.
- **[Proxy Interaction](USAGE.md#4-interaction-the-proxy-endpoint)**: How to route requests through `/proxy/*`.
- **[Status Codes](USAGE.md#5-understanding-status-codes)**: Understanding 403 (SSRF/RBAC) vs 429 (Quotas).

## 🧪 Testing

```bash
# Run the validation suite
bun test src/index.test.ts
```

---

MIT © - Hardened Gateways, Simplified.

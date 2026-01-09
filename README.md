# 🌌 Zenith Gateway

**Secure, Monetize, and Scale your APIs without the headache.**

Zenith is a lightning-fast API Proxy built with **Hono**, **Bun**, and **Drizzle ORM**. It handles the boring stuff (Auth, Rate Limiting, Usage Tracking) so you can focus on building your actual product.

---

## 🚀 Why Zenith?

- **💨 Built for Speed**: Uses Hono & Bun for near-zero overhead.
- **🛡️ Secure by Default**: SSRF protection via Allowlist and header sanitization.
- **🌊 Full Streaming**: Handles large payloads with zero-memory footprint.
- **📊 Real-time Analytics**: Usage logs sent asynchronously to PostgreSQL.
- **⏳ Tiered Rate Limiting**: Limit-ready with Upstash Redis integration.

---

## 🛠️ Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Hono](https://hono.dev)
- **Database**: PostgreSQL (via [Drizzle ORM](https://orm.drizzle.team))
- **Cache/Quota**: [Upstash Redis](https://upstash.com)
- **Logger**: [Pino](https://getpino.io)

---

## ⚡ Quick Start

### 1. Clone & Install

```bash
bun install
```

### 2. Configure

Copy `.env.example` to `.env` and plug in your credentials:

```bash
cp .env.example .env
```

### 3. Initialize Database

Create tables and seed initial data:

```bash
bun run db:push
bun run db:seed
```

### 4. Run

```bash
bun dev
```

---

## 📡 Usage

Proxy any request through Zenith. It automatically handles protocols:

```bash
curl -H "X-Zenith-Key: zenith_test_key_123" \
     "http://localhost:3000/proxy/httpbin.org/get"
```

Check out [USAGE.md](USAGE.md) for the full guide on setup and monitoring.

---

## 🏗️ Core Structure

- `/src/middlewares`: The "brain" (Auth, Rate Limit, Usage Tracker).
- `/src/db`: Schema definitions and database client.
- `/src/services`: External integrations (Redis, Logger).
- `/src/utils`: Helpers like crypto hashing.

---

## 📝 License

MIT. Go build something cool.

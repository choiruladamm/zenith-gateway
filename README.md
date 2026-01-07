# Zenith Gateway 🚀

A high-performance API Monetization Proxy built with Hono, Supabase, and Redis.

## Features

- **Edge-Ready Proxy:** Low-latency API forwarding.
- **API Key Authentication:** Secure hashing and validation via Supabase.
- **Distributed Rate Limiting:** Global usage quotas using Redis (Upstash).
- **Usage Analytics:** Automated logging of API hits for monetization.

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase Account
- Upstash Redis Account

### Installation

1. Clone the repository.
2. `bun install`
3. Rename `.env.example` to `.env` and fill in your credentials.
4. Run migrations in Supabase SQL Editor (`supabase/migrations/`).

### Development

```bash
bun run dev
```

### Build

```bash
bun run build
bun run start
```

# 📖 Zenith Gateway Usage Guide

This guide will walk you through setting up and using the Zenith Gateway to proxy, secure, and monetize your APIs.

---

## 🛠️ 1. Setup & Installation

### Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
# Database (General Postgres)
DATABASE_URL=postgres://user:password@localhost:5432/zenith_db

# Redis (Upstash)
UPSTASH_REDIS_URL=your_redis_url
UPSTASH_REDIS_TOKEN=your_redis_token

# App
PORT=3000

# Security (Allowlist)
ALLOWED_DOMAINS=openai.com,httpbin.org
```

---

## 🗄️ 2. Database Preparation

Zenith works with any PostgreSQL instance.

### Schema Setup

We use **Drizzle ORM** for schema management. Once you have your `DATABASE_URL` set up, run:

```bash
bun run db:push
```

### Automatic Seeding (Recommended)

To quickly set up default plans (Basic, Pro, Enterprise), a default organization, and a test API key, run:

```bash
bun run db:seed
```

This will create a default test key: `zenith_test_key_123`.

---

## 🚀 3. Running the Gateway

```bash
# Install dependencies
bun install

# Start development server
bun run dev
```

---

## 📡 4. Making Requests

The gateway expects a URL in the path and an `X-Zenith-Key` header.

### Endpoint Structure

`ALL /proxy/<TARGET_URL>`

### Authentication

- Header: `X-Zenith-Key`
- Value: Your generated API Key (e.g., `zenith_test_key_123`)

### Example Curl

```bash
curl -X GET \
  -H "X-Zenith-Key: zenith_test_key_123" \
  "http://localhost:3000/proxy/https://jsonplaceholder.typicode.com/posts"
```

> [!IMPORTANT]
> Use the **plain text** key in the header. The gateway handles hashing automatically before checking the database.

---

## 📊 5. Understanding Response Headers

Zenith Gateway injects rate limit information into every successful response header:

- `X-RateLimit-Limit`: Total requests allowed per minute for your plan.
- `X-RateLimit-Remaining`: Number of requests left in the current 1-minute window.

---

## ⚠️ 6. Common Status Codes

| Code    | Meaning           | Cause                                        |
| :------ | :---------------- | :------------------------------------------- |
| **200** | Success           | Request forwarded and returned successfully. |
| **401** | Unauthorized      | Missing or invalid `X-Zenith-Key`.           |
| **429** | Too Many Requests | You have exceeded your plan's rate limit.    |
| **400** | Bad Request       | Missing the target URL in the path.          |
| **403** | Forbidden         | The target domain is not in the allowlist.   |
| **502** | Bad Gateway       | The upstream `url` failed to respond.        |

---

## 📈 7. Monitoring Usage

All requests are logged in the `usage_logs` table. You can query this table to see:

- Latency of each request.
- Status codes returned by upstream APIs.
- Frequency of hits per API Key.
- Endpoint patterns.

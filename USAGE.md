# 📖 Zenith Gateway Usage Guide

This guide will walk you through setting up and using the Zenith Gateway to proxy, secure, and monetize your APIs.

---

## 🛠️ 1. Setup & Installation

### Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
# Supabase
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key

# Redis (Upstash)
UPSTASH_REDIS_URL=your_redis_url
UPSTASH_REDIS_TOKEN=your_redis_token

# App
PORT=3000
```

---

## 🗄️ 2. Database Preparation

1.  Go to your **Supabase SQL Editor**.
2.  Copy and run the contents of `supabase/migrations/20240107000000_initial_schema.sql`.
3.  **Insert an Organization & API Key**:
    Zenith Gateway now uses **SHA-256 hashing** for security. You must hash your key before inserting it.

    ```bash
    # Generate hash for 'test-key-123'
    echo -n "test-key-123" | shasum -a 256
    # Output: 625faa3fbbc3d2bd9d6ee7678d04cc5339cb33dc68d9b58451853d60046e226a
    ```

    ```sql
    -- Insert an organization
    INSERT INTO organizations (name) VALUES ('My First Org') RETURNING id;

    -- Insert the HASHED API Key
    -- Replace ORG_ID and PLAN_ID with real IDs
    INSERT INTO api_keys (org_id, key_hash, hint, status, plan_id)
    VALUES ('<ORG_ID>', '625faa3fbbc3d2bd9d6ee7678d04cc5339cb33dc68d9b58451853d60046e226a', 'test', 'active', '<PLAN_ID>');
    ```

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

The gateway expects a `url` query parameter and an `X-Zenith-Key` header.

### Endpoint Structure

`ALL /proxy/<TARGET_URL>`

### Authentication

- Header: `X-Zenith-Key`
- Value: Your generated API Key

### Example Curl

```bash
curl -X GET \
  -H "X-Zenith-Key: test-key-123" \
  "http://localhost:3000/proxy/https://jsonplaceholder.typicode.com/posts/1"
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
| **502** | Bad Gateway       | The upstream `url` failed to respond.        |

---

## 📈 7. Monitoring Usage

All requests are logged in the `usage_logs` table in Supabase. You can query this table to see:

- Latency of each request.
- Status codes returned by upstream APIs.
- Frequency of hits per API Key.

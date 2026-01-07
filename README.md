# 🌌 Zenith Gateway

**Secure, Monetize, and Scale your APIs without the headache.**

Zenith is a lightning-fast API Proxy built with **Hono**, **Bun**, and **Supabase**. It handles the boring stuff (Auth, Rate Limiting, Usage Tracking) so you can focus on building your actual product.

---

## 🚀 Why Zenith?

- **💨 Built for Speed**: Uses Hono & Bun for near-zero overhead.
- **🛡️ Secure by Default**: SHA-256 API key hashing and header sanitization.
- **📊 Real-time Analytics**: Usage logs sent asynchronously to Supabase (won't block your response).
- **⏳ Tiered Rate Limiting**: Limit-ready with Upstash Redis integration.
- **🧩 Developer First**: Clean, modular TypeScript codebase that's easy to hack on.

---

## 🛠️ Stack

- **Runtime**: [Bun](https://bun.sh)
- **Framework**: [Hono](https://hono.dev)
- **Database**: [Supabase](https://supabase.com)
- **Cache/Quota**: [Upstash Redis](https://upstash.com)
- **Logger**: [Pino](https://getpino.io)

---

## ⚡ Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/your-username/zenith-gateway.git
cd zenith-gateway
bun install
```

### 2. Configure

Copy `.env.example` to `.env` and plug in your keys.

### 3. Run

```bash
bun dev
```

---

## 📡 Usage

Proxy any request through Zenith:

```bash
curl -H "X-Zenith-Key: your-api-key" \
     "http://localhost:3000/proxy/https://api.youwanttoproxy.com/data"
```

Check out [USAGE.md](USAGE.md) for the full guide on setup and monitoring.

---

## 🏗️ Core Structure

- `/src/middlewares`: The "brain" (Auth, Rate Limit, Usage).
- `/src/services`: External integrations (Supabase, Redis).
- `/src/utils`: Helpers like crypto hashing.

---

## 📝 License

MIT. Go build something cool.

-- Zenith Gateway Initial Schema

-- 1. Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Plans
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- Basic, Pro, Enterprise
  rate_limit_per_min INTEGER NOT NULL,
  monthly_quota BIGINT NOT NULL,
  price_per_1k_req DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  hint TEXT NOT NULL, -- First 4 characters
  status TEXT NOT NULL DEFAULT 'active', -- active, revoked, expired
  plan_id UUID REFERENCES plans(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Usage Logs
CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Initial Plans
INSERT INTO plans (name, rate_limit_per_min, monthly_quota, price_per_1k_req) VALUES
('Basic', 60, 10000, 0.05),
('Pro', 600, 100000, 0.03),
('Enterprise', 6000, 999999999, 0.01);

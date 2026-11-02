-- Meta tables for API-FRRM

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT UNIQUE NOT NULL,          -- validated identifier e.g. shop_app
  api_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- APIs (each API + version within a project)
CREATE TABLE IF NOT EXISTS apis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                 -- validated identifier e.g. products
  version TEXT NOT NULL,              -- e.g. "v1"
  columns JSONB NOT NULL,             -- column definitions array
  check_url TEXT,                     -- optional health-check URL
  is_up BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, name, version)
);

-- Health-check records
CREATE TABLE IF NOT EXISTS api_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id UUID NOT NULL REFERENCES apis(id) ON DELETE CASCADE,
  status_code INT,
  latency_ms INT,
  checked_at TIMESTAMPTZ DEFAULT now()
);

-- Notification channels
CREATE TABLE IF NOT EXISTS notify_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('telegram','slack','discord','email')),
  target TEXT NOT NULL,               -- chat_id, webhook URL, or email address
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast check lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_api_checks_api_id ON api_checks(api_id);
CREATE INDEX IF NOT EXISTS idx_api_checks_checked_at ON api_checks(checked_at);


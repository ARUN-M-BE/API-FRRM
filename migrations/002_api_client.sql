-- Migration 002: API Client (Postman-like) module
-- Tables: environments, collections, folders, requests, request_history, collection_runs

-- ============================================================
-- ENVIRONMENTS  — Dev / Staging / Prod variable sets
-- ============================================================
CREATE TABLE IF NOT EXISTS environments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  variables     JSONB NOT NULL DEFAULT '[]',
  -- Each element: { "key": "base_url", "value": "https://...", "is_secret": false }
  -- Secret values will have "encrypted_value" instead of "value" when is_secret=true
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_environments_user_id ON environments(user_id);
CREATE INDEX IF NOT EXISTS idx_environments_project_id ON environments(project_id);

-- ============================================================
-- COLLECTIONS  — top-level request grouping
-- ============================================================
CREATE TABLE IF NOT EXISTS collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT DEFAULT '',
  auto_generated  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_project_id ON collections(project_id);

-- ============================================================
-- FOLDERS  — nested hierarchy inside a collection
-- ============================================================
CREATE TABLE IF NOT EXISTS folders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id     UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  parent_folder_id  UUID REFERENCES folders(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_folders_collection_id ON folders(collection_id);

-- ============================================================
-- REQUESTS  — saved HTTP requests
-- ============================================================
CREATE TABLE IF NOT EXISTS requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  folder_id     UUID REFERENCES folders(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  method        TEXT NOT NULL DEFAULT 'GET',
  url           TEXT NOT NULL DEFAULT '',
  params        JSONB NOT NULL DEFAULT '[]',
  headers       JSONB NOT NULL DEFAULT '[]',
  auth_type     TEXT NOT NULL DEFAULT 'none',
  auth_config   JSONB NOT NULL DEFAULT '{}',
  body_type     TEXT NOT NULL DEFAULT 'none',
  body_content  TEXT NOT NULL DEFAULT '',
  assertions    JSONB NOT NULL DEFAULT '[]',
  extract_rules JSONB NOT NULL DEFAULT '[]',
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_collection_id ON requests(collection_id);
CREATE INDEX IF NOT EXISTS idx_requests_folder_id ON requests(folder_id);

-- ============================================================
-- REQUEST HISTORY  — log of every executed request
-- ============================================================
CREATE TABLE IF NOT EXISTS request_history (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id          UUID REFERENCES requests(id) ON DELETE SET NULL,
  collection_id       UUID REFERENCES collections(id) ON DELETE SET NULL,
  method              TEXT NOT NULL,
  url                 TEXT NOT NULL,
  request_headers     JSONB,
  request_body        TEXT,
  response_status     INT,
  response_time_ms    INT,
  response_size_bytes INT,
  response_headers    JSONB,
  response_body       TEXT,
  assertions_result   JSONB DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_history_user_id ON request_history(user_id);
CREATE INDEX IF NOT EXISTS idx_request_history_created_at ON request_history(created_at);

-- ============================================================
-- COLLECTION RUNS  — sequential runner results
-- ============================================================
CREATE TABLE IF NOT EXISTS collection_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id   UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  environment_id  UUID REFERENCES environments(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running','passed','failed','error')),
  total_requests  INT NOT NULL DEFAULT 0,
  passed_count    INT NOT NULL DEFAULT 0,
  failed_count    INT NOT NULL DEFAULT 0,
  total_time_ms   INT NOT NULL DEFAULT 0,
  results         JSONB NOT NULL DEFAULT '[]',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_collection_runs_collection_id ON collection_runs(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_runs_user_id ON collection_runs(user_id);


CREATE TABLE IF NOT EXISTS platform_project (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  github_owner TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  github_installation_id BIGINT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_change_request (
  id UUID PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES platform_project(id),
  action TEXT NOT NULL CHECK (action IN ('install', 'update', 'switch-template')),
  component_id TEXT NOT NULL,
  target_version TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','blocked','pr_open','merged','failed')),
  branch_name TEXT,
  pull_request_url TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS platform_change_request_queue ON platform_change_request(status, available_at, created_at);

CREATE TABLE IF NOT EXISTS platform_audit_log (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT REFERENCES platform_project(id),
  change_request_id UUID REFERENCES platform_change_request(id),
  event TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


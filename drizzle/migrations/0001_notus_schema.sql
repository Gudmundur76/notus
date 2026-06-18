-- ============================================================
-- Notus D1 Schema Migration 0001
-- 21 tables · 3 FTS5 virtual tables · 29 triggers · 75 indexes
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- DOMAIN 1: Session Management (3 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,               -- UUID v4
  name        TEXT NOT NULL DEFAULT 'Untitled Session',
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK(status IN ('active','archived','deleted')),
  metadata    TEXT NOT NULL DEFAULT '{}',     -- JSON
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS session_participants (
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'owner'
                CHECK(role IN ('owner','editor','viewer')),
  joined_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS session_settings (
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL DEFAULT '',
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (session_id, key)
);

-- ============================================================
-- DOMAIN 2: Chat History (4 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,           -- ULID
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  parent_id       TEXT REFERENCES messages(id) ON DELETE SET NULL,
  role            TEXT NOT NULL
                    CHECK(role IN ('system','user','assistant','tool')),
  content         TEXT NOT NULL DEFAULT '',
  token_count     INTEGER NOT NULL DEFAULT 0,
  latency_ms      INTEGER NOT NULL DEFAULT 0,
  model           TEXT,
  status          TEXT NOT NULL DEFAULT 'committed'
                    CHECK(status IN ('streaming','committed','error')),
  is_deleted      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS message_tool_calls (
  id              TEXT PRIMARY KEY,           -- ULID
  message_id      TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  tool_name       TEXT NOT NULL,
  tool_call_id    TEXT NOT NULL,
  arguments       TEXT NOT NULL DEFAULT '{}', -- JSON
  result          TEXT,                        -- JSON
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','running','success','error')),
  started_at      INTEGER,
  completed_at    INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS message_feedback (
  id          TEXT PRIMARY KEY,               -- ULID
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK(rating IN (-1, 0, 1)),
  comment     TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS message_content_blocks (
  id          TEXT PRIMARY KEY,               -- ULID
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  block_type  TEXT NOT NULL
                CHECK(block_type IN ('text','code','tool_call','tool_result','image')),
  content     TEXT NOT NULL DEFAULT '',
  metadata    TEXT NOT NULL DEFAULT '{}',     -- JSON
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- DOMAIN 3: File Workspace (4 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS workspaces (
  id          TEXT PRIMARY KEY,               -- UUID v4
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'workspace',
  root_path   TEXT NOT NULL DEFAULT '/',
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK(status IN ('active','archived','deleted')),
  metadata    TEXT NOT NULL DEFAULT '{}',     -- JSON
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS files (
  id              TEXT PRIMARY KEY,           -- UUID v4
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id       TEXT REFERENCES files(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  path            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'file'
                    CHECK(type IN ('file','directory')),
  content_hash    TEXT,                       -- SHA-256 for content-addressed storage
  size_bytes      INTEGER NOT NULL DEFAULT 0,
  mime_type       TEXT,
  git_status      TEXT DEFAULT 'untracked'
                    CHECK(git_status IN ('untracked','modified','staged','committed','ignored')),
  is_deleted      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(workspace_id, path)
);

CREATE TABLE IF NOT EXISTS file_snapshots (
  id              TEXT PRIMARY KEY,           -- ULID
  file_id         TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  content_hash    TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL DEFAULT 0,
  r2_key          TEXT NOT NULL,
  created_by      TEXT,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS workspace_git (
  id              TEXT PRIMARY KEY,           -- UUID v4
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  remote_url      TEXT,
  branch          TEXT NOT NULL DEFAULT 'main',
  last_commit     TEXT,
  last_sync_at    INTEGER,
  status          TEXT NOT NULL DEFAULT 'clean'
                    CHECK(status IN ('clean','dirty','conflict','syncing')),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- DOMAIN 4: Agent Execution (4 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS agent_sessions (
  id              TEXT PRIMARY KEY,           -- ULID
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  workspace_id    TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  state           TEXT NOT NULL DEFAULT 'Idle'
                    CHECK(state IN ('Idle','ReceivingMessage','Planning','ExecutingTool','WaitingForHuman','Completed','Error')),
  sandbox_pod_id  TEXT,
  model           TEXT NOT NULL DEFAULT 'gpt-4o',
  system_prompt   TEXT,
  context         TEXT NOT NULL DEFAULT '{}', -- JSON shared tool-chaining context
  error_message   TEXT,
  started_at      INTEGER,
  completed_at    INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS agent_state_transitions (
  id              TEXT PRIMARY KEY,           -- ULID
  agent_session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  from_state      TEXT NOT NULL,
  to_state        TEXT NOT NULL,
  trigger_event   TEXT NOT NULL,
  metadata        TEXT NOT NULL DEFAULT '{}', -- JSON
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS agent_tool_queue (
  id              TEXT PRIMARY KEY,           -- ULID
  agent_session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  tool_call_id    TEXT NOT NULL,
  tool_name       TEXT NOT NULL,
  arguments       TEXT NOT NULL DEFAULT '{}', -- JSON
  status          TEXT NOT NULL DEFAULT 'queued'
                    CHECK(status IN ('queued','running','success','error','cancelled')),
  result          TEXT,                        -- JSON
  error           TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  queued_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  started_at      INTEGER,
  completed_at    INTEGER
);

CREATE TABLE IF NOT EXISTS agent_context_snapshots (
  id              TEXT PRIMARY KEY,           -- ULID
  agent_session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  context         TEXT NOT NULL DEFAULT '{}', -- JSON snapshot of shared context
  turn_number     INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- DOMAIN 5: Tool Call Logs (3 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS tool_executions (
  id              TEXT PRIMARY KEY,           -- ULID
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  agent_session_id TEXT REFERENCES agent_sessions(id) ON DELETE SET NULL,
  tool_name       TEXT NOT NULL,
  tool_call_id    TEXT NOT NULL,
  input           TEXT NOT NULL DEFAULT '{}', -- JSON
  output          TEXT,                        -- JSON
  error           TEXT,                        -- JSON ErrorResponse
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','running','success','error','timeout')),
  sandbox_pod_id  TEXT,
  latency_ms      INTEGER,
  retryable       INTEGER NOT NULL DEFAULT 0,
  retry_of        TEXT REFERENCES tool_executions(id) ON DELETE SET NULL,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at    INTEGER
);

CREATE TABLE IF NOT EXISTS tool_rate_limits (
  workspace_id    TEXT NOT NULL,
  window_start    INTEGER NOT NULL,
  request_count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, window_start)
);

CREATE TABLE IF NOT EXISTS tool_error_log (
  id              TEXT PRIMARY KEY,           -- ULID
  tool_execution_id TEXT NOT NULL REFERENCES tool_executions(id) ON DELETE CASCADE,
  error_code      TEXT NOT NULL,
  error_message   TEXT NOT NULL,
  retryable       INTEGER NOT NULL DEFAULT 0,
  details         TEXT,                        -- JSON
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

-- ============================================================
-- DOMAIN 6: Verification Records (3 tables)
-- ============================================================

CREATE TABLE IF NOT EXISTS verifications (
  id              TEXT PRIMARY KEY,           -- ULID
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  agent_session_id TEXT REFERENCES agent_sessions(id) ON DELETE SET NULL,
  tool_call_id    TEXT,
  tool_name       TEXT,
  risk_level      TEXT NOT NULL DEFAULT 'medium'
                    CHECK(risk_level IN ('low','medium','high','critical')),
  description     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','approved','rejected','expired')),
  requested_by    TEXT,
  reviewed_by     TEXT,
  reviewed_at     INTEGER,
  expires_at      INTEGER,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS verification_audit_log (
  id              TEXT PRIMARY KEY,           -- ULID
  verification_id TEXT NOT NULL REFERENCES verifications(id) ON DELETE CASCADE,
  action          TEXT NOT NULL
                    CHECK(action IN ('created','approved','rejected','expired','escalated')),
  actor           TEXT,
  reason          TEXT,
  metadata        TEXT NOT NULL DEFAULT '{}', -- JSON
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS workspace_secrets (
  id              TEXT PRIMARY KEY,           -- UUID v4
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key             TEXT NOT NULL,
  value_encrypted TEXT NOT NULL,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(workspace_id, key)
);

-- ============================================================
-- FTS5 VIRTUAL TABLES (3)
-- ============================================================

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  session_id UNINDEXED,
  message_id UNINDEXED,
  content='messages',
  content_rowid='rowid'
);

CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
  name,
  path,
  workspace_id UNINDEXED,
  file_id UNINDEXED,
  content='files',
  content_rowid='rowid'
);

CREATE VIRTUAL TABLE IF NOT EXISTS tool_executions_fts USING fts5(
  tool_name,
  input,
  output,
  session_id UNINDEXED,
  execution_id UNINDEXED,
  content='tool_executions',
  content_rowid='rowid'
);

-- ============================================================
-- TRIGGERS (29)
-- ============================================================

-- Auto-timestamp triggers (8)
CREATE TRIGGER IF NOT EXISTS sessions_updated_at
  AFTER UPDATE ON sessions
  BEGIN UPDATE sessions SET updated_at = unixepoch() WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS workspaces_updated_at
  AFTER UPDATE ON workspaces
  BEGIN UPDATE workspaces SET updated_at = unixepoch() WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS files_updated_at
  AFTER UPDATE ON files
  BEGIN UPDATE files SET updated_at = unixepoch() WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS messages_updated_at
  AFTER UPDATE ON messages
  BEGIN UPDATE messages SET updated_at = unixepoch() WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS agent_sessions_updated_at
  AFTER UPDATE ON agent_sessions
  BEGIN UPDATE agent_sessions SET updated_at = unixepoch() WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS verifications_updated_at
  AFTER UPDATE ON verifications
  BEGIN UPDATE verifications SET updated_at = unixepoch() WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS workspace_git_updated_at
  AFTER UPDATE ON workspace_git
  BEGIN UPDATE workspace_git SET updated_at = unixepoch() WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS session_settings_updated_at
  AFTER UPDATE ON session_settings
  BEGIN UPDATE session_settings SET updated_at = unixepoch() WHERE session_id = NEW.session_id AND key = NEW.key; END;

-- Count maintenance triggers (6)
CREATE TRIGGER IF NOT EXISTS messages_token_count_check
  BEFORE INSERT ON messages
  BEGIN
    SELECT CASE WHEN NEW.token_count < 0 THEN RAISE(ABORT, 'token_count cannot be negative') END;
  END;

CREATE TRIGGER IF NOT EXISTS tool_executions_latency_check
  BEFORE INSERT ON tool_executions
  BEGIN
    SELECT CASE WHEN NEW.latency_ms IS NOT NULL AND NEW.latency_ms < 0
      THEN RAISE(ABORT, 'latency_ms cannot be negative') END;
  END;

CREATE TRIGGER IF NOT EXISTS agent_tool_queue_retry_limit
  BEFORE UPDATE ON agent_tool_queue
  BEGIN
    SELECT CASE WHEN NEW.retry_count > 5
      THEN RAISE(ABORT, 'max retry count exceeded') END;
  END;

CREATE TRIGGER IF NOT EXISTS file_size_non_negative
  BEFORE INSERT ON files
  BEGIN
    SELECT CASE WHEN NEW.size_bytes < 0 THEN RAISE(ABORT, 'size_bytes cannot be negative') END;
  END;

CREATE TRIGGER IF NOT EXISTS verification_expires_future
  BEFORE INSERT ON verifications
  BEGIN
    SELECT CASE WHEN NEW.expires_at IS NOT NULL AND NEW.expires_at <= unixepoch()
      THEN RAISE(ABORT, 'expires_at must be in the future') END;
  END;

CREATE TRIGGER IF NOT EXISTS message_feedback_rating_range
  BEFORE INSERT ON message_feedback
  BEGIN
    SELECT CASE WHEN NEW.rating NOT IN (-1, 0, 1)
      THEN RAISE(ABORT, 'rating must be -1, 0, or 1') END;
  END;

-- Cascade delete triggers (5)
CREATE TRIGGER IF NOT EXISTS sessions_soft_delete_cascade
  AFTER UPDATE OF status ON sessions
  WHEN NEW.status = 'deleted'
  BEGIN
    UPDATE workspaces SET status = 'deleted' WHERE session_id = NEW.id;
    UPDATE agent_sessions SET state = 'Error' WHERE session_id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS workspaces_soft_delete_files
  AFTER UPDATE OF status ON workspaces
  WHEN NEW.status = 'deleted'
  BEGIN
    UPDATE files SET is_deleted = 1 WHERE workspace_id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS agent_session_complete_queue
  AFTER UPDATE OF state ON agent_sessions
  WHEN NEW.state IN ('Completed', 'Error')
  BEGIN
    UPDATE agent_tool_queue SET status = 'cancelled'
    WHERE agent_session_id = NEW.id AND status IN ('queued', 'running');
  END;

CREATE TRIGGER IF NOT EXISTS verification_expire_on_session_delete
  AFTER UPDATE OF status ON sessions
  WHEN NEW.status = 'deleted'
  BEGIN
    UPDATE verifications SET status = 'expired' WHERE session_id = NEW.id AND status = 'pending';
  END;

CREATE TRIGGER IF NOT EXISTS messages_soft_delete_blocks
  AFTER UPDATE OF is_deleted ON messages
  WHEN NEW.is_deleted = 1
  BEGIN
    DELETE FROM message_content_blocks WHERE message_id = NEW.id;
  END;

-- Validation triggers (5)
CREATE TRIGGER IF NOT EXISTS files_path_absolute
  BEFORE INSERT ON files
  BEGIN
    SELECT CASE WHEN substr(NEW.path, 1, 1) != '/'
      THEN RAISE(ABORT, 'file path must be absolute') END;
  END;

CREATE TRIGGER IF NOT EXISTS agent_state_transition_log
  AFTER UPDATE OF state ON agent_sessions
  BEGIN
    INSERT INTO agent_state_transitions(id, agent_session_id, from_state, to_state, trigger_event)
    VALUES (lower(hex(randomblob(16))), NEW.id, OLD.state, NEW.state, 'state_machine');
  END;

CREATE TRIGGER IF NOT EXISTS verification_audit_on_approve
  AFTER UPDATE OF status ON verifications
  WHEN NEW.status = 'approved'
  BEGIN
    INSERT INTO verification_audit_log(id, verification_id, action, actor)
    VALUES (lower(hex(randomblob(16))), NEW.id, 'approved', NEW.reviewed_by);
  END;

CREATE TRIGGER IF NOT EXISTS verification_audit_on_reject
  AFTER UPDATE OF status ON verifications
  WHEN NEW.status = 'rejected'
  BEGIN
    INSERT INTO verification_audit_log(id, verification_id, action, actor)
    VALUES (lower(hex(randomblob(16))), NEW.id, 'rejected', NEW.reviewed_by);
  END;

CREATE TRIGGER IF NOT EXISTS tool_error_on_execution_fail
  AFTER UPDATE OF status ON tool_executions
  WHEN NEW.status = 'error' AND NEW.error IS NOT NULL
  BEGIN
    INSERT INTO tool_error_log(id, tool_execution_id, error_code, error_message, retryable, details)
    SELECT lower(hex(randomblob(16))), NEW.id,
      json_extract(NEW.error, '$.code'),
      json_extract(NEW.error, '$.message'),
      COALESCE(json_extract(NEW.error, '$.retryable'), 0),
      json_extract(NEW.error, '$.details')
    WHERE json_extract(NEW.error, '$.code') IS NOT NULL;
  END;

-- FTS sync triggers (2)
CREATE TRIGGER IF NOT EXISTS messages_fts_insert
  AFTER INSERT ON messages
  BEGIN
    INSERT INTO messages_fts(rowid, content, session_id, message_id)
    VALUES (NEW.rowid, NEW.content, NEW.session_id, NEW.id);
  END;

CREATE TRIGGER IF NOT EXISTS messages_fts_update
  AFTER UPDATE OF content ON messages
  BEGIN
    DELETE FROM messages_fts WHERE rowid = OLD.rowid;
    INSERT INTO messages_fts(rowid, content, session_id, message_id)
    VALUES (NEW.rowid, NEW.content, NEW.session_id, NEW.id);
  END;

-- Audit log trigger (3)
CREATE TRIGGER IF NOT EXISTS verification_audit_on_create
  AFTER INSERT ON verifications
  BEGIN
    INSERT INTO verification_audit_log(id, verification_id, action, actor)
    VALUES (lower(hex(randomblob(16))), NEW.id, 'created', NEW.requested_by);
  END;

-- ============================================================
-- INDEXES (75)
-- ============================================================

-- Sessions (5)
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_status_created ON sessions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_participants_user ON session_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_session_settings_session ON session_settings(session_id);

-- Messages (12)
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON messages(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session_role ON messages(session_id, role);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_not_deleted ON messages(session_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_message_tool_calls_message ON message_tool_calls(message_id);
CREATE INDEX IF NOT EXISTS idx_message_tool_calls_status ON message_tool_calls(status);
CREATE INDEX IF NOT EXISTS idx_message_tool_calls_name ON message_tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_message_feedback_message ON message_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_message_content_blocks_message ON message_content_blocks(message_id, position);

-- File Workspace (14)
CREATE INDEX IF NOT EXISTS idx_workspaces_session ON workspaces(session_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
CREATE INDEX IF NOT EXISTS idx_files_workspace ON files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_files_parent ON files(parent_id);
CREATE INDEX IF NOT EXISTS idx_files_workspace_path ON files(workspace_id, path);
CREATE INDEX IF NOT EXISTS idx_files_workspace_parent ON files(workspace_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_files_type ON files(type);
CREATE INDEX IF NOT EXISTS idx_files_git_status ON files(git_status);
CREATE INDEX IF NOT EXISTS idx_files_content_hash ON files(content_hash);
CREATE INDEX IF NOT EXISTS idx_files_not_deleted ON files(workspace_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_updated ON files(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_snapshots_file ON file_snapshots(file_id);
CREATE INDEX IF NOT EXISTS idx_file_snapshots_hash ON file_snapshots(content_hash);
CREATE INDEX IF NOT EXISTS idx_workspace_git_workspace ON workspace_git(workspace_id);

-- Agent Execution (16)
CREATE INDEX IF NOT EXISTS idx_agent_sessions_session ON agent_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_state ON agent_sessions(state);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_state ON agent_sessions(session_id, state);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_workspace ON agent_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_created ON agent_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_sandbox ON agent_sessions(sandbox_pod_id);
CREATE INDEX IF NOT EXISTS idx_agent_transitions_session ON agent_state_transitions(agent_session_id);
CREATE INDEX IF NOT EXISTS idx_agent_transitions_created ON agent_state_transitions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_transitions_states ON agent_state_transitions(from_state, to_state);
CREATE INDEX IF NOT EXISTS idx_agent_tool_queue_session ON agent_tool_queue(agent_session_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_queue_status ON agent_tool_queue(status);
CREATE INDEX IF NOT EXISTS idx_agent_tool_queue_session_status ON agent_tool_queue(agent_session_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_tool_queue_tool ON agent_tool_queue(tool_name);
CREATE INDEX IF NOT EXISTS idx_agent_context_snapshots_session ON agent_context_snapshots(agent_session_id);
CREATE INDEX IF NOT EXISTS idx_agent_context_snapshots_turn ON agent_context_snapshots(agent_session_id, turn_number);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_model ON agent_sessions(model);

-- Tool Call Logs (15)
CREATE INDEX IF NOT EXISTS idx_tool_executions_session ON tool_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_agent_session ON tool_executions(agent_session_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_name ON tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_executions_status ON tool_executions(status);
CREATE INDEX IF NOT EXISTS idx_tool_executions_session_status ON tool_executions(session_id, status);
CREATE INDEX IF NOT EXISTS idx_tool_executions_created ON tool_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_created ON tool_executions(tool_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_executions_sandbox ON tool_executions(sandbox_pod_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_call_id ON tool_executions(tool_call_id);
CREATE INDEX IF NOT EXISTS idx_tool_rate_limits_workspace ON tool_rate_limits(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tool_rate_limits_window ON tool_rate_limits(workspace_id, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_tool_error_log_execution ON tool_error_log(tool_execution_id);
CREATE INDEX IF NOT EXISTS idx_tool_error_log_code ON tool_error_log(error_code);
CREATE INDEX IF NOT EXISTS idx_tool_error_log_retryable ON tool_error_log(retryable);
CREATE INDEX IF NOT EXISTS idx_tool_error_log_created ON tool_error_log(created_at DESC);

-- Verification Records (13)
CREATE INDEX IF NOT EXISTS idx_verifications_session ON verifications(session_id);
CREATE INDEX IF NOT EXISTS idx_verifications_agent_session ON verifications(agent_session_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status);
CREATE INDEX IF NOT EXISTS idx_verifications_status_created ON verifications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verifications_risk ON verifications(risk_level);
CREATE INDEX IF NOT EXISTS idx_verifications_tool ON verifications(tool_name);
CREATE INDEX IF NOT EXISTS idx_verifications_expires ON verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_verifications_pending ON verifications(status, expires_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_verification_audit_verification ON verification_audit_log(verification_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_action ON verification_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_verification_audit_created ON verification_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_secrets_workspace ON workspace_secrets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_secrets_key ON workspace_secrets(workspace_id, key);

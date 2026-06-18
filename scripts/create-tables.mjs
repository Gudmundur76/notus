import mysql2 from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.DATABASE_URL;
const conn = await mysql2.createConnection(url);

const tables = [
  [`session_participants`, `CREATE TABLE IF NOT EXISTS \`session_participants\` (
    \`session_id\` varchar(36) NOT NULL,
    \`user_id\` varchar(64) NOT NULL,
    \`role\` enum('owner','editor','viewer') NOT NULL DEFAULT 'owner',
    \`joined_at\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`session_participants_pk\` PRIMARY KEY(\`session_id\`,\`user_id\`)
  )`],
  [`session_settings`, `CREATE TABLE IF NOT EXISTS \`session_settings\` (
    \`session_id\` varchar(36) NOT NULL,
    \`key\` varchar(255) NOT NULL,
    \`value\` text NOT NULL DEFAULT '',
    \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`session_settings_pk\` PRIMARY KEY(\`session_id\`,\`key\`)
  )`],
  [`workspaces`, `CREATE TABLE IF NOT EXISTS \`workspaces\` (
    \`id\` varchar(36) NOT NULL,
    \`session_id\` varchar(36) NOT NULL,
    \`name\` varchar(255) NOT NULL DEFAULT 'workspace',
    \`root_path\` varchar(512) NOT NULL DEFAULT '/',
    \`status\` enum('active','archived','deleted') NOT NULL DEFAULT 'active',
    \`metadata\` json NOT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`workspaces_id\` PRIMARY KEY(\`id\`)
  )`],
  [`files`, `CREATE TABLE IF NOT EXISTS \`files\` (
    \`id\` varchar(36) NOT NULL,
    \`workspace_id\` varchar(36) NOT NULL,
    \`parent_id\` varchar(36),
    \`name\` varchar(255) NOT NULL,
    \`path\` varchar(1024) NOT NULL,
    \`type\` enum('file','directory') NOT NULL DEFAULT 'file',
    \`content_hash\` varchar(64),
    \`size_bytes\` bigint NOT NULL DEFAULT 0,
    \`mime_type\` varchar(128),
    \`git_status\` enum('untracked','modified','staged','committed','ignored') DEFAULT 'untracked',
    \`is_deleted\` boolean NOT NULL DEFAULT false,
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`files_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`uniq_files_workspace_path\` UNIQUE(\`workspace_id\`,\`path\`(255))
  )`],
  [`workspace_git`, `CREATE TABLE IF NOT EXISTS \`workspace_git\` (
    \`id\` varchar(36) NOT NULL,
    \`workspace_id\` varchar(36) NOT NULL,
    \`remote_url\` varchar(2048),
    \`branch\` varchar(255) NOT NULL DEFAULT 'main',
    \`last_commit\` varchar(64),
    \`last_sync_at\` timestamp,
    \`status\` enum('clean','dirty','conflict','syncing') NOT NULL DEFAULT 'clean',
    \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`workspace_git_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`workspace_git_workspace_id_unique\` UNIQUE(\`workspace_id\`)
  )`],
  [`messages`, `CREATE TABLE IF NOT EXISTS \`messages\` (
    \`id\` varchar(36) NOT NULL,
    \`session_id\` varchar(36) NOT NULL,
    \`parent_id\` varchar(36),
    \`role\` enum('system','user','assistant','tool') NOT NULL,
    \`content\` text NOT NULL DEFAULT '',
    \`token_count\` int NOT NULL DEFAULT 0,
    \`latency_ms\` int NOT NULL DEFAULT 0,
    \`model\` varchar(128),
    \`status\` enum('streaming','committed','error') NOT NULL DEFAULT 'committed',
    \`is_deleted\` boolean NOT NULL DEFAULT false,
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`messages_id\` PRIMARY KEY(\`id\`)
  )`],
  [`message_tool_calls`, `CREATE TABLE IF NOT EXISTS \`message_tool_calls\` (
    \`id\` varchar(36) NOT NULL,
    \`message_id\` varchar(36) NOT NULL,
    \`tool_name\` varchar(128) NOT NULL,
    \`tool_call_id\` varchar(128) NOT NULL,
    \`arguments\` json NOT NULL,
    \`result\` json,
    \`status\` enum('pending','running','success','error') NOT NULL DEFAULT 'pending',
    \`started_at\` timestamp,
    \`completed_at\` timestamp,
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`message_tool_calls_id\` PRIMARY KEY(\`id\`)
  )`],
  [`message_feedback`, `CREATE TABLE IF NOT EXISTS \`message_feedback\` (
    \`id\` varchar(36) NOT NULL,
    \`message_id\` varchar(36) NOT NULL,
    \`user_id\` varchar(64) NOT NULL,
    \`rating\` int NOT NULL,
    \`comment\` text,
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`message_feedback_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`uniq_message_feedback_user\` UNIQUE(\`message_id\`,\`user_id\`)
  )`],
  [`message_content_blocks`, `CREATE TABLE IF NOT EXISTS \`message_content_blocks\` (
    \`id\` varchar(36) NOT NULL,
    \`message_id\` varchar(36) NOT NULL,
    \`block_type\` enum('text','code','tool_call','tool_result','image') NOT NULL,
    \`content\` text NOT NULL DEFAULT '',
    \`metadata\` json NOT NULL,
    \`position\` int NOT NULL DEFAULT 0,
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`message_content_blocks_id\` PRIMARY KEY(\`id\`)
  )`],
  [`tool_executions`, `CREATE TABLE IF NOT EXISTS \`tool_executions\` (
    \`id\` varchar(36) NOT NULL,
    \`session_id\` varchar(36) NOT NULL,
    \`agent_session_id\` varchar(36),
    \`tool_name\` varchar(128) NOT NULL,
    \`tool_call_id\` varchar(128) NOT NULL,
    \`input\` json NOT NULL,
    \`output\` json,
    \`error\` json,
    \`status\` enum('pending','running','success','error','timeout') NOT NULL DEFAULT 'pending',
    \`sandbox_pod_id\` varchar(255),
    \`latency_ms\` int,
    \`retryable\` boolean NOT NULL DEFAULT false,
    \`retry_of\` varchar(36),
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    \`completed_at\` timestamp,
    CONSTRAINT \`tool_executions_id\` PRIMARY KEY(\`id\`)
  )`],
  [`tool_rate_limits`, `CREATE TABLE IF NOT EXISTS \`tool_rate_limits\` (
    \`workspace_id\` varchar(36) NOT NULL,
    \`window_start\` bigint NOT NULL,
    \`request_count\` int NOT NULL DEFAULT 0,
    CONSTRAINT \`tool_rate_limits_pk\` PRIMARY KEY(\`workspace_id\`,\`window_start\`)
  )`],
  [`tool_error_log`, `CREATE TABLE IF NOT EXISTS \`tool_error_log\` (
    \`id\` varchar(36) NOT NULL,
    \`tool_execution_id\` varchar(36) NOT NULL,
    \`error_code\` varchar(128) NOT NULL,
    \`error_message\` text NOT NULL,
    \`retryable\` boolean NOT NULL DEFAULT false,
    \`details\` json,
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`tool_error_log_id\` PRIMARY KEY(\`id\`)
  )`],
  [`verifications`, `CREATE TABLE IF NOT EXISTS \`verifications\` (
    \`id\` varchar(36) NOT NULL,
    \`session_id\` varchar(36) NOT NULL,
    \`agent_session_id\` varchar(36),
    \`tool_call_id\` varchar(128),
    \`tool_name\` varchar(128),
    \`risk_level\` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    \`description\` text NOT NULL DEFAULT '',
    \`status\` enum('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
    \`requested_by\` varchar(64),
    \`reviewed_by\` varchar(64),
    \`reviewed_at\` timestamp,
    \`expires_at\` timestamp,
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`verifications_id\` PRIMARY KEY(\`id\`)
  )`],
  [`verification_audit_log`, `CREATE TABLE IF NOT EXISTS \`verification_audit_log\` (
    \`id\` varchar(36) NOT NULL,
    \`verification_id\` varchar(36) NOT NULL,
    \`action\` enum('created','approved','rejected','expired','escalated') NOT NULL,
    \`actor\` varchar(64),
    \`reason\` text,
    \`metadata\` json NOT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`verification_audit_log_id\` PRIMARY KEY(\`id\`)
  )`],
  [`workspace_secrets`, `CREATE TABLE IF NOT EXISTS \`workspace_secrets\` (
    \`id\` varchar(36) NOT NULL,
    \`workspace_id\` varchar(36) NOT NULL,
    \`key\` varchar(255) NOT NULL,
    \`value_encrypted\` text NOT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT (now()),
    \`updated_at\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`workspace_secrets_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`uniq_workspace_secrets_key\` UNIQUE(\`workspace_id\`,\`key\`)
  )`],
];

for (const [name, sql] of tables) {
  try {
    await conn.query(sql);
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`);
  }
}

await conn.end();
console.log('Done.');

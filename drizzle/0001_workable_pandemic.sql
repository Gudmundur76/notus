CREATE TABLE `agent_context_snapshots` (
	`id` varchar(36) NOT NULL,
	`agent_session_id` varchar(36) NOT NULL,
	`context` json NOT NULL,
	`turn_number` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_context_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_sessions` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`workspace_id` varchar(36),
	`state` enum('Idle','ReceivingMessage','Planning','ExecutingTool','WaitingForHuman','Completed','Error') NOT NULL DEFAULT 'Idle',
	`sandbox_pod_id` varchar(255),
	`model` varchar(128) NOT NULL DEFAULT 'gpt-4o',
	`system_prompt` text,
	`context` json NOT NULL,
	`error_message` text,
	`started_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_state_transitions` (
	`id` varchar(36) NOT NULL,
	`agent_session_id` varchar(36) NOT NULL,
	`from_state` varchar(64) NOT NULL,
	`to_state` varchar(64) NOT NULL,
	`trigger_event` varchar(255) NOT NULL,
	`metadata` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_state_transitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_tool_queue` (
	`id` varchar(36) NOT NULL,
	`agent_session_id` varchar(36) NOT NULL,
	`tool_call_id` varchar(128) NOT NULL,
	`tool_name` varchar(128) NOT NULL,
	`arguments` json NOT NULL,
	`status` enum('queued','running','success','error','cancelled') NOT NULL DEFAULT 'queued',
	`result` json,
	`error` text,
	`retry_count` int NOT NULL DEFAULT 0,
	`queued_at` timestamp NOT NULL DEFAULT (now()),
	`started_at` timestamp,
	`completed_at` timestamp,
	CONSTRAINT `agent_tool_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `file_snapshots` (
	`id` varchar(36) NOT NULL,
	`file_id` varchar(36) NOT NULL,
	`content_hash` varchar(64) NOT NULL,
	`size_bytes` bigint NOT NULL DEFAULT 0,
	`r2_key` varchar(1024) NOT NULL,
	`created_by` varchar(64),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `file_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` varchar(36) NOT NULL,
	`workspace_id` varchar(36) NOT NULL,
	`parent_id` varchar(36),
	`name` varchar(255) NOT NULL,
	`path` varchar(4096) NOT NULL,
	`type` enum('file','directory') NOT NULL DEFAULT 'file',
	`content_hash` varchar(64),
	`size_bytes` bigint NOT NULL DEFAULT 0,
	`mime_type` varchar(128),
	`git_status` enum('untracked','modified','staged','committed','ignored') DEFAULT 'untracked',
	`is_deleted` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `files_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_files_workspace_path` UNIQUE(`workspace_id`,`path`)
);
--> statement-breakpoint
CREATE TABLE `message_content_blocks` (
	`id` varchar(36) NOT NULL,
	`message_id` varchar(36) NOT NULL,
	`block_type` enum('text','code','tool_call','tool_result','image') NOT NULL,
	`content` text NOT NULL DEFAULT (''),
	`metadata` json NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_content_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `message_feedback` (
	`id` varchar(36) NOT NULL,
	`message_id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_feedback_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_message_feedback_user` UNIQUE(`message_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `message_tool_calls` (
	`id` varchar(36) NOT NULL,
	`message_id` varchar(36) NOT NULL,
	`tool_name` varchar(128) NOT NULL,
	`tool_call_id` varchar(128) NOT NULL,
	`arguments` json NOT NULL,
	`result` json,
	`status` enum('pending','running','success','error') NOT NULL DEFAULT 'pending',
	`started_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_tool_calls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`parent_id` varchar(36),
	`role` enum('system','user','assistant','tool') NOT NULL,
	`content` text NOT NULL DEFAULT (''),
	`token_count` int NOT NULL DEFAULT 0,
	`latency_ms` int NOT NULL DEFAULT 0,
	`model` varchar(128),
	`status` enum('streaming','committed','error') NOT NULL DEFAULT 'committed',
	`is_deleted` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session_participants` (
	`session_id` varchar(36) NOT NULL,
	`user_id` varchar(64) NOT NULL,
	`role` enum('owner','editor','viewer') NOT NULL DEFAULT 'owner',
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `session_participants_session_id_user_id_pk` PRIMARY KEY(`session_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `session_settings` (
	`session_id` varchar(36) NOT NULL,
	`key` varchar(255) NOT NULL,
	`value` text NOT NULL DEFAULT (''),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `session_settings_session_id_key_pk` PRIMARY KEY(`session_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL DEFAULT 'Untitled Session',
	`status` enum('active','archived','deleted') NOT NULL DEFAULT 'active',
	`metadata` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tool_error_log` (
	`id` varchar(36) NOT NULL,
	`tool_execution_id` varchar(36) NOT NULL,
	`error_code` varchar(128) NOT NULL,
	`error_message` text NOT NULL,
	`retryable` boolean NOT NULL DEFAULT false,
	`details` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tool_error_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tool_executions` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`agent_session_id` varchar(36),
	`tool_name` varchar(128) NOT NULL,
	`tool_call_id` varchar(128) NOT NULL,
	`input` json NOT NULL,
	`output` json,
	`error` json,
	`status` enum('pending','running','success','error','timeout') NOT NULL DEFAULT 'pending',
	`sandbox_pod_id` varchar(255),
	`latency_ms` int,
	`retryable` boolean NOT NULL DEFAULT false,
	`retry_of` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `tool_executions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tool_rate_limits` (
	`workspace_id` varchar(36) NOT NULL,
	`window_start` bigint NOT NULL,
	`request_count` int NOT NULL DEFAULT 0,
	CONSTRAINT `tool_rate_limits_workspace_id_window_start_pk` PRIMARY KEY(`workspace_id`,`window_start`)
);
--> statement-breakpoint
CREATE TABLE `verification_audit_log` (
	`id` varchar(36) NOT NULL,
	`verification_id` varchar(36) NOT NULL,
	`action` enum('created','approved','rejected','expired','escalated') NOT NULL,
	`actor` varchar(64),
	`reason` text,
	`metadata` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verification_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`agent_session_id` varchar(36),
	`tool_call_id` varchar(128),
	`tool_name` varchar(128),
	`risk_level` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`description` text NOT NULL DEFAULT (''),
	`status` enum('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
	`requested_by` varchar(64),
	`reviewed_by` varchar(64),
	`reviewed_at` timestamp,
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspace_git` (
	`id` varchar(36) NOT NULL,
	`workspace_id` varchar(36) NOT NULL,
	`remote_url` varchar(2048),
	`branch` varchar(255) NOT NULL DEFAULT 'main',
	`last_commit` varchar(64),
	`last_sync_at` timestamp,
	`status` enum('clean','dirty','conflict','syncing') NOT NULL DEFAULT 'clean',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspace_git_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspace_git_workspace_id_unique` UNIQUE(`workspace_id`)
);
--> statement-breakpoint
CREATE TABLE `workspace_secrets` (
	`id` varchar(36) NOT NULL,
	`workspace_id` varchar(36) NOT NULL,
	`key` varchar(255) NOT NULL,
	`value_encrypted` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspace_secrets_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_workspace_secrets_key` UNIQUE(`workspace_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL DEFAULT 'workspace',
	`root_path` varchar(1024) NOT NULL DEFAULT '/',
	`status` enum('active','archived','deleted') NOT NULL DEFAULT 'active',
	`metadata` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_agent_context_snapshots_session` ON `agent_context_snapshots` (`agent_session_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_context_snapshots_turn` ON `agent_context_snapshots` (`agent_session_id`,`turn_number`);--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_session` ON `agent_sessions` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_state` ON `agent_sessions` (`state`);--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_session_state` ON `agent_sessions` (`session_id`,`state`);--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_workspace` ON `agent_sessions` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_created` ON `agent_sessions` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_sandbox` ON `agent_sessions` (`sandbox_pod_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_sessions_model` ON `agent_sessions` (`model`);--> statement-breakpoint
CREATE INDEX `idx_agent_transitions_session` ON `agent_state_transitions` (`agent_session_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_transitions_created` ON `agent_state_transitions` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_transitions_states` ON `agent_state_transitions` (`from_state`,`to_state`);--> statement-breakpoint
CREATE INDEX `idx_agent_tool_queue_session` ON `agent_tool_queue` (`agent_session_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_tool_queue_status` ON `agent_tool_queue` (`status`);--> statement-breakpoint
CREATE INDEX `idx_agent_tool_queue_session_status` ON `agent_tool_queue` (`agent_session_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_agent_tool_queue_tool` ON `agent_tool_queue` (`tool_name`);--> statement-breakpoint
CREATE INDEX `idx_file_snapshots_file` ON `file_snapshots` (`file_id`);--> statement-breakpoint
CREATE INDEX `idx_file_snapshots_hash` ON `file_snapshots` (`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_files_workspace` ON `files` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_files_parent` ON `files` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_files_workspace_parent` ON `files` (`workspace_id`,`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_files_type` ON `files` (`type`);--> statement-breakpoint
CREATE INDEX `idx_files_git_status` ON `files` (`git_status`);--> statement-breakpoint
CREATE INDEX `idx_files_content_hash` ON `files` (`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_files_updated` ON `files` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_message_content_blocks_message` ON `message_content_blocks` (`message_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_message_feedback_message` ON `message_feedback` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_message_tool_calls_message` ON `message_tool_calls` (`message_id`);--> statement-breakpoint
CREATE INDEX `idx_message_tool_calls_status` ON `message_tool_calls` (`status`);--> statement-breakpoint
CREATE INDEX `idx_message_tool_calls_name` ON `message_tool_calls` (`tool_name`);--> statement-breakpoint
CREATE INDEX `idx_messages_session` ON `messages` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_session_created` ON `messages` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_messages_session_role` ON `messages` (`session_id`,`role`);--> statement-breakpoint
CREATE INDEX `idx_messages_parent` ON `messages` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_status` ON `messages` (`status`);--> statement-breakpoint
CREATE INDEX `idx_messages_created` ON `messages` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_session_participants_user` ON `session_participants` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_session_settings_session` ON `session_settings` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_status` ON `sessions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sessions_status_created` ON `sessions` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sessions_updated` ON `sessions` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_tool_error_log_execution` ON `tool_error_log` (`tool_execution_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_error_log_code` ON `tool_error_log` (`error_code`);--> statement-breakpoint
CREATE INDEX `idx_tool_error_log_retryable` ON `tool_error_log` (`retryable`);--> statement-breakpoint
CREATE INDEX `idx_tool_error_log_created` ON `tool_error_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tool_executions_session` ON `tool_executions` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_executions_agent_session` ON `tool_executions` (`agent_session_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_executions_tool_name` ON `tool_executions` (`tool_name`);--> statement-breakpoint
CREATE INDEX `idx_tool_executions_status` ON `tool_executions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tool_executions_session_status` ON `tool_executions` (`session_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_tool_executions_created` ON `tool_executions` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tool_executions_tool_created` ON `tool_executions` (`tool_name`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tool_executions_sandbox` ON `tool_executions` (`sandbox_pod_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_executions_call_id` ON `tool_executions` (`tool_call_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_rate_limits_workspace` ON `tool_rate_limits` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_tool_rate_limits_window` ON `tool_rate_limits` (`workspace_id`,`window_start`);--> statement-breakpoint
CREATE INDEX `idx_verification_audit_verification` ON `verification_audit_log` (`verification_id`);--> statement-breakpoint
CREATE INDEX `idx_verification_audit_action` ON `verification_audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `idx_verification_audit_created` ON `verification_audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_verifications_session` ON `verifications` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_verifications_agent_session` ON `verifications` (`agent_session_id`);--> statement-breakpoint
CREATE INDEX `idx_verifications_status` ON `verifications` (`status`);--> statement-breakpoint
CREATE INDEX `idx_verifications_status_created` ON `verifications` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_verifications_risk` ON `verifications` (`risk_level`);--> statement-breakpoint
CREATE INDEX `idx_verifications_tool` ON `verifications` (`tool_name`);--> statement-breakpoint
CREATE INDEX `idx_verifications_expires` ON `verifications` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_workspace_git_workspace` ON `workspace_git` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_workspace_secrets_workspace` ON `workspace_secrets` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `idx_workspaces_session` ON `workspaces` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_workspaces_status` ON `workspaces` (`status`);
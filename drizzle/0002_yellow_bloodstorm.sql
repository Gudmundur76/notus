ALTER TABLE `agent_context_snapshots` MODIFY COLUMN `context` json NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_sessions` MODIFY COLUMN `context` json NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_state_transitions` MODIFY COLUMN `metadata` json NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_tool_queue` MODIFY COLUMN `arguments` json NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_tool_queue` MODIFY COLUMN `result` json NOT NULL;--> statement-breakpoint
ALTER TABLE `message_content_blocks` MODIFY COLUMN `metadata` json NOT NULL;--> statement-breakpoint
ALTER TABLE `message_tool_calls` MODIFY COLUMN `arguments` json NOT NULL;--> statement-breakpoint
ALTER TABLE `message_tool_calls` MODIFY COLUMN `result` json NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` MODIFY COLUMN `metadata` json NOT NULL;--> statement-breakpoint
ALTER TABLE `tool_error_log` MODIFY COLUMN `details` json NOT NULL;--> statement-breakpoint
ALTER TABLE `tool_executions` MODIFY COLUMN `input` json NOT NULL;--> statement-breakpoint
ALTER TABLE `tool_executions` MODIFY COLUMN `output` json NOT NULL;--> statement-breakpoint
ALTER TABLE `verification_audit_log` MODIFY COLUMN `metadata` json NOT NULL;--> statement-breakpoint
ALTER TABLE `workspaces` MODIFY COLUMN `metadata` json NOT NULL;
import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  bigint,
  boolean,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// ============================================================
// DOMAIN 1: Session Management (3 tables)
// ============================================================

export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull().default("Untitled Session"),
    status: mysqlEnum("status", ["active", "archived", "deleted"]).notNull().default("active"),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    statusIdx: index("idx_sessions_status").on(t.status),
    statusCreatedIdx: index("idx_sessions_status_created").on(t.status, t.createdAt),
    updatedIdx: index("idx_sessions_updated").on(t.updatedAt),
  })
);

export const sessionParticipants = mysqlTable(
  "session_participants",
  {
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    role: mysqlEnum("role", ["owner", "editor", "viewer"]).notNull().default("owner"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.sessionId, t.userId] }),
    userIdx: index("idx_session_participants_user").on(t.userId),
  })
);

export const sessionSettings = mysqlTable(
  "session_settings",
  {
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    key: varchar("key", { length: 255 }).notNull(),
    value: text("value").notNull().default(""),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.sessionId, t.key] }),
    sessionIdx: index("idx_session_settings_session").on(t.sessionId),
  })
);

// ============================================================
// DOMAIN 2: Chat History (4 tables)
// ============================================================

export const messages = mysqlTable(
  "messages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    parentId: varchar("parent_id", { length: 36 }),
    role: mysqlEnum("role", ["system", "user", "assistant", "tool"]).notNull(),
    content: text("content").notNull().default(""),
    tokenCount: int("token_count").notNull().default(0),
    latencyMs: int("latency_ms").notNull().default(0),
    model: varchar("model", { length: 128 }),
    status: mysqlEnum("status", ["streaming", "committed", "error"]).notNull().default("committed"),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("idx_messages_session").on(t.sessionId),
    sessionCreatedIdx: index("idx_messages_session_created").on(t.sessionId, t.createdAt),
    sessionRoleIdx: index("idx_messages_session_role").on(t.sessionId, t.role),
    parentIdx: index("idx_messages_parent").on(t.parentId),
    statusIdx: index("idx_messages_status").on(t.status),
    createdIdx: index("idx_messages_created").on(t.createdAt),
  })
);

export const messageToolCalls = mysqlTable(
  "message_tool_calls",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    messageId: varchar("message_id", { length: 36 }).notNull(),
    toolName: varchar("tool_name", { length: 128 }).notNull(),
    toolCallId: varchar("tool_call_id", { length: 128 }).notNull(),
    arguments: json("arguments").$type<Record<string, unknown>>().notNull(),
    result: json("result").$type<Record<string, unknown>>().notNull(),
    status: mysqlEnum("status", ["pending", "running", "success", "error"]).notNull().default("pending"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    messageIdx: index("idx_message_tool_calls_message").on(t.messageId),
    statusIdx: index("idx_message_tool_calls_status").on(t.status),
    nameIdx: index("idx_message_tool_calls_name").on(t.toolName),
  })
);

export const messageFeedback = mysqlTable(
  "message_feedback",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    messageId: varchar("message_id", { length: 36 }).notNull(),
    userId: varchar("user_id", { length: 64 }).notNull(),
    rating: int("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    messageIdx: index("idx_message_feedback_message").on(t.messageId),
    uniqueUserMessage: uniqueIndex("uniq_message_feedback_user").on(t.messageId, t.userId),
  })
);

export const messageContentBlocks = mysqlTable(
  "message_content_blocks",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    messageId: varchar("message_id", { length: 36 }).notNull(),
    blockType: mysqlEnum("block_type", ["text", "code", "tool_call", "tool_result", "image"]).notNull(),
    content: text("content").notNull().default(""),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    position: int("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    messagePositionIdx: index("idx_message_content_blocks_message").on(t.messageId, t.position),
  })
);

// ============================================================
// DOMAIN 3: File Workspace (4 tables)
// ============================================================

export const workspaces = mysqlTable(
  "workspaces",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 255 }).notNull().default("workspace"),
    rootPath: varchar("root_path", { length: 512 }).notNull().default("/"),
    status: mysqlEnum("status", ["active", "archived", "deleted"]).notNull().default("active"),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("idx_workspaces_session").on(t.sessionId),
    statusIdx: index("idx_workspaces_status").on(t.status),
  })
);

export const files = mysqlTable(
  "files",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
    parentId: varchar("parent_id", { length: 36 }),
    name: varchar("name", { length: 255 }).notNull(),
    path: varchar("path", { length: 1024 }).notNull(),
    type: mysqlEnum("type", ["file", "directory"]).notNull().default("file"),
    contentHash: varchar("content_hash", { length: 64 }),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
    mimeType: varchar("mime_type", { length: 128 }),
    gitStatus: mysqlEnum("git_status", ["untracked", "modified", "staged", "committed", "ignored"]).default("untracked"),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index("idx_files_workspace").on(t.workspaceId),
    parentIdx: index("idx_files_parent").on(t.parentId),
    workspaceParentIdx: index("idx_files_workspace_parent").on(t.workspaceId, t.parentId),
    typeIdx: index("idx_files_type").on(t.type),
    gitStatusIdx: index("idx_files_git_status").on(t.gitStatus),
    contentHashIdx: index("idx_files_content_hash").on(t.contentHash),
    updatedIdx: index("idx_files_updated").on(t.updatedAt),
    workspacePathUniq: uniqueIndex("uniq_files_workspace_path").on(t.workspaceId, t.path),
  })
);

export const fileSnapshots = mysqlTable(
  "file_snapshots",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    fileId: varchar("file_id", { length: 36 }).notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
    r2Key: varchar("r2_key", { length: 512 }).notNull(),
    createdBy: varchar("created_by", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    fileIdx: index("idx_file_snapshots_file").on(t.fileId),
    hashIdx: index("idx_file_snapshots_hash").on(t.contentHash),
  })
);

export const workspaceGit = mysqlTable(
  "workspace_git",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 }).notNull().unique(),
    remoteUrl: varchar("remote_url", { length: 2048 }),
    branch: varchar("branch", { length: 255 }).notNull().default("main"),
    lastCommit: varchar("last_commit", { length: 64 }),
    lastSyncAt: timestamp("last_sync_at"),
    status: mysqlEnum("status", ["clean", "dirty", "conflict", "syncing"]).notNull().default("clean"),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index("idx_workspace_git_workspace").on(t.workspaceId),
  })
);

// ============================================================
// DOMAIN 4: Agent Execution (4 tables)
// ============================================================

export const agentSessions = mysqlTable(
  "agent_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    workspaceId: varchar("workspace_id", { length: 36 }),
    state: mysqlEnum("state", [
      "Idle",
      "ReceivingMessage",
      "Planning",
      "ExecutingTool",
      "WaitingForHuman",
      "Completed",
      "Error",
    ])
      .notNull()
      .default("Idle"),
    sandboxPodId: varchar("sandbox_pod_id", { length: 255 }),
    model: varchar("model", { length: 128 }).notNull().default("gpt-4o"),
    systemPrompt: text("system_prompt"),
    context: json("context").$type<Record<string, unknown>>().notNull(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("idx_agent_sessions_session").on(t.sessionId),
    stateIdx: index("idx_agent_sessions_state").on(t.state),
    sessionStateIdx: index("idx_agent_sessions_session_state").on(t.sessionId, t.state),
    workspaceIdx: index("idx_agent_sessions_workspace").on(t.workspaceId),
    createdIdx: index("idx_agent_sessions_created").on(t.createdAt),
    sandboxIdx: index("idx_agent_sessions_sandbox").on(t.sandboxPodId),
    modelIdx: index("idx_agent_sessions_model").on(t.model),
  })
);

export const agentStateTransitions = mysqlTable(
  "agent_state_transitions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    agentSessionId: varchar("agent_session_id", { length: 36 }).notNull(),
    fromState: varchar("from_state", { length: 64 }).notNull(),
    toState: varchar("to_state", { length: 64 }).notNull(),
    triggerEvent: varchar("trigger_event", { length: 255 }).notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("idx_agent_transitions_session").on(t.agentSessionId),
    createdIdx: index("idx_agent_transitions_created").on(t.createdAt),
    statesIdx: index("idx_agent_transitions_states").on(t.fromState, t.toState),
  })
);

export const agentToolQueue = mysqlTable(
  "agent_tool_queue",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    agentSessionId: varchar("agent_session_id", { length: 36 }).notNull(),
    toolCallId: varchar("tool_call_id", { length: 128 }).notNull(),
    toolName: varchar("tool_name", { length: 128 }).notNull(),
    arguments: json("arguments").$type<Record<string, unknown>>().notNull(),
    status: mysqlEnum("status", ["queued", "running", "success", "error", "cancelled"]).notNull().default("queued"),
    result: json("result").$type<Record<string, unknown>>().notNull(),
    error: text("error"),
    retryCount: int("retry_count").notNull().default(0),
    queuedAt: timestamp("queued_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (t) => ({
    sessionIdx: index("idx_agent_tool_queue_session").on(t.agentSessionId),
    statusIdx: index("idx_agent_tool_queue_status").on(t.status),
    sessionStatusIdx: index("idx_agent_tool_queue_session_status").on(t.agentSessionId, t.status),
    toolIdx: index("idx_agent_tool_queue_tool").on(t.toolName),
  })
);

export const agentContextSnapshots = mysqlTable(
  "agent_context_snapshots",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    agentSessionId: varchar("agent_session_id", { length: 36 }).notNull(),
    context: json("context").$type<Record<string, unknown>>().notNull(),
    turnNumber: int("turn_number").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("idx_agent_context_snapshots_session").on(t.agentSessionId),
    turnIdx: index("idx_agent_context_snapshots_turn").on(t.agentSessionId, t.turnNumber),
  })
);

// ============================================================
// DOMAIN 5: Tool Call Logs (3 tables)
// ============================================================

export const toolExecutions = mysqlTable(
  "tool_executions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    agentSessionId: varchar("agent_session_id", { length: 36 }),
    toolName: varchar("tool_name", { length: 128 }).notNull(),
    toolCallId: varchar("tool_call_id", { length: 128 }).notNull(),
    input: json("input").$type<Record<string, unknown>>().notNull(),
    output: json("output").$type<Record<string, unknown>>().notNull(),
    error: json("error").$type<{ code: string; message: string; retryable: boolean; details?: unknown }>(),
    status: mysqlEnum("status", ["pending", "running", "success", "error", "timeout"]).notNull().default("pending"),
    sandboxPodId: varchar("sandbox_pod_id", { length: 255 }),
    latencyMs: int("latency_ms"),
    retryable: boolean("retryable").notNull().default(false),
    retryOf: varchar("retry_of", { length: 36 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (t) => ({
    sessionIdx: index("idx_tool_executions_session").on(t.sessionId),
    agentSessionIdx: index("idx_tool_executions_agent_session").on(t.agentSessionId),
    toolNameIdx: index("idx_tool_executions_tool_name").on(t.toolName),
    statusIdx: index("idx_tool_executions_status").on(t.status),
    sessionStatusIdx: index("idx_tool_executions_session_status").on(t.sessionId, t.status),
    createdIdx: index("idx_tool_executions_created").on(t.createdAt),
    toolCreatedIdx: index("idx_tool_executions_tool_created").on(t.toolName, t.createdAt),
    sandboxIdx: index("idx_tool_executions_sandbox").on(t.sandboxPodId),
    callIdIdx: index("idx_tool_executions_call_id").on(t.toolCallId),
  })
);

export const toolRateLimits = mysqlTable(
  "tool_rate_limits",
  {
    workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
    windowStart: bigint("window_start", { mode: "number" }).notNull(),
    requestCount: int("request_count").notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.workspaceId, t.windowStart] }),
    workspaceIdx: index("idx_tool_rate_limits_workspace").on(t.workspaceId),
    windowIdx: index("idx_tool_rate_limits_window").on(t.workspaceId, t.windowStart),
  })
);

export const toolErrorLog = mysqlTable(
  "tool_error_log",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    toolExecutionId: varchar("tool_execution_id", { length: 36 }).notNull(),
    errorCode: varchar("error_code", { length: 128 }).notNull(),
    errorMessage: text("error_message").notNull(),
    retryable: boolean("retryable").notNull().default(false),
    details: json("details").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    executionIdx: index("idx_tool_error_log_execution").on(t.toolExecutionId),
    codeIdx: index("idx_tool_error_log_code").on(t.errorCode),
    retryableIdx: index("idx_tool_error_log_retryable").on(t.retryable),
    createdIdx: index("idx_tool_error_log_created").on(t.createdAt),
  })
);

// ============================================================
// DOMAIN 6: Verification Records (3 tables)
// ============================================================

export const verifications = mysqlTable(
  "verifications",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    sessionId: varchar("session_id", { length: 36 }).notNull(),
    agentSessionId: varchar("agent_session_id", { length: 36 }),
    toolCallId: varchar("tool_call_id", { length: 128 }),
    toolName: varchar("tool_name", { length: 128 }),
    riskLevel: mysqlEnum("risk_level", ["low", "medium", "high", "critical"]).notNull().default("medium"),
    description: text("description").notNull().default(""),
    status: mysqlEnum("status", ["pending", "approved", "rejected", "expired"]).notNull().default("pending"),
    requestedBy: varchar("requested_by", { length: 64 }),
    reviewedBy: varchar("reviewed_by", { length: 64 }),
    reviewedAt: timestamp("reviewed_at"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    sessionIdx: index("idx_verifications_session").on(t.sessionId),
    agentSessionIdx: index("idx_verifications_agent_session").on(t.agentSessionId),
    statusIdx: index("idx_verifications_status").on(t.status),
    statusCreatedIdx: index("idx_verifications_status_created").on(t.status, t.createdAt),
    riskIdx: index("idx_verifications_risk").on(t.riskLevel),
    toolIdx: index("idx_verifications_tool").on(t.toolName),
    expiresIdx: index("idx_verifications_expires").on(t.expiresAt),
  })
);

export const verificationAuditLog = mysqlTable(
  "verification_audit_log",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    verificationId: varchar("verification_id", { length: 36 }).notNull(),
    action: mysqlEnum("action", ["created", "approved", "rejected", "expired", "escalated"]).notNull(),
    actor: varchar("actor", { length: 64 }),
    reason: text("reason"),
    metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    verificationIdx: index("idx_verification_audit_verification").on(t.verificationId),
    actionIdx: index("idx_verification_audit_action").on(t.action),
    createdIdx: index("idx_verification_audit_created").on(t.createdAt),
  })
);

export const workspaceSecrets = mysqlTable(
  "workspace_secrets",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
    key: varchar("key", { length: 255 }).notNull(),
    valueEncrypted: text("value_encrypted").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index("idx_workspace_secrets_workspace").on(t.workspaceId),
    keyIdx: uniqueIndex("uniq_workspace_secrets_key").on(t.workspaceId, t.key),
  })
);

// ============================================================
// Users table (from template)
// ============================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

// ============================================================
// Type exports
// ============================================================

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = typeof workspaces.$inferInsert;

export type File = typeof files.$inferSelect;
export type InsertFile = typeof files.$inferInsert;

export type AgentSession = typeof agentSessions.$inferSelect;
export type InsertAgentSession = typeof agentSessions.$inferInsert;

export type ToolExecution = typeof toolExecutions.$inferSelect;
export type InsertToolExecution = typeof toolExecutions.$inferInsert;

export type Verification = typeof verifications.$inferSelect;
export type InsertVerification = typeof verifications.$inferInsert;

export type MessageToolCall = typeof messageToolCalls.$inferSelect;
export type AgentStateTransition = typeof agentStateTransitions.$inferSelect;
export type AgentToolQueueItem = typeof agentToolQueue.$inferSelect;

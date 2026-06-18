import { eq, and, isNull, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import {
  sessions, workspaces, files, messages, agentSessions, agentStateTransitions,
  agentToolQueue, toolExecutions, toolRateLimits, verifications, verificationAuditLog,
  messageToolCalls, messageContentBlocks,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function createSession(id: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(sessions).values({ id, name, metadata: {} });
  return id;
}

export async function getSession(id: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return rows[0] ?? null;
}

// ── Workspaces ────────────────────────────────────────────────────────────────

export async function createWorkspace(id: string, sessionId: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(workspaces).values({ id, sessionId, name, metadata: {} });
  return id;
}

export async function getWorkspace(id: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  return rows[0] ?? null;
}

// ── Files ─────────────────────────────────────────────────────────────────────

export async function listFiles(workspaceId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(files)
    .where(and(eq(files.workspaceId, workspaceId), eq(files.isDeleted, false)))
    .orderBy(asc(files.path));
}

export async function createFile(data: {
  id: string; workspaceId: string; parentId: string | null;
  name: string; path: string; type: "file" | "directory";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(files).values({ ...data, sizeBytes: 0, gitStatus: "untracked", isDeleted: false });
  return data.id;
}

export async function getFileContent(fileId: string): Promise<string> {
  // In this implementation, content is stored in the DB as a text blob via a separate content table
  // For simplicity, we return empty string - real implementation would use S3
  return "";
}

export async function saveFileContent(fileId: string, content: string, workspaceId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const sizeBytes = Buffer.byteLength(content, "utf8");
  await db.update(files).set({ sizeBytes, updatedAt: new Date() }).where(eq(files.id, fileId));
  return true;
}

export async function renameFile(fileId: string, name: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(files).set({ name, updatedAt: new Date() }).where(eq(files.id, fileId));
}

export async function deleteFile(fileId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(files).set({ isDeleted: true, updatedAt: new Date() }).where(eq(files.id, fileId));
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function listMessages(sessionId: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.isDeleted, false)))
    .orderBy(asc(messages.createdAt))
    .limit(limit);
}

export async function createMessage(data: {
  id: string; sessionId: string; role: "system" | "user" | "assistant" | "tool";
  content: string; model?: string; tokenCount?: number; latencyMs?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(messages).values({
    ...data,
    tokenCount: data.tokenCount ?? 0,
    latencyMs: data.latencyMs ?? 0,
    status: "committed",
    isDeleted: false,
  });
  return data.id;
}

export async function updateMessageContent(id: string, content: string, tokenCount?: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(messages).set({
    content,
    tokenCount: tokenCount ?? 0,
    status: "committed",
    updatedAt: new Date(),
  }).where(eq(messages.id, id));
}

// ── Agent Sessions ────────────────────────────────────────────────────────────

export async function createAgentSession(data: {
  id: string; sessionId: string; workspaceId: string; model: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(agentSessions).values({ ...data, context: {}, turnCount: 0, maxTurns: 50 } as any);
  return data.id;
}

export async function updateAgentState(
  agentSessionId: string,
  state: "Idle" | "ReceivingMessage" | "Planning" | "ExecutingTool" | "WaitingForHuman" | "Completed" | "Error"
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(agentSessions).set({ state, updatedAt: new Date() }).where(eq(agentSessions.id, agentSessionId));
  await db.insert(agentStateTransitions).values({
    id: crypto.randomUUID(),
    agentSessionId,
    fromState: "Idle",
    toState: state,
    triggerEvent: "state_update",
    metadata: {},
  } as any);
}

export async function getAgentSession(id: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(agentSessions).where(eq(agentSessions.id, id)).limit(1);
  return rows[0] ?? null;
}

// ── Tool Executions ───────────────────────────────────────────────────────────

export async function createToolExecution(data: {
  id: string; sessionId: string; agentSessionId?: string;
  toolName: string; toolCallId: string; input: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(toolExecutions).values({
    id: data.id,
    sessionId: data.sessionId,
    agentSessionId: data.agentSessionId ?? undefined,
    toolName: data.toolName,
    toolCallId: data.toolCallId,
    input: data.input,
    output: {},
    retryable: false,
  } as any);
  return data.id;
}

export async function updateToolExecution(id: string, data: {
  status: "pending" | "running" | "success" | "error" | "timeout";
  output?: Record<string, unknown>;
  latencyMs?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const isDone = data.status !== "pending" && data.status !== "running";
  await db.update(toolExecutions).set({
    status: data.status,
    output: data.output,
    latencyMs: data.latencyMs,
    ...(isDone ? { completedAt: new Date() } : {}),
  }).where(eq(toolExecutions.id, id));
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────

export async function checkRateLimit(workspaceId: string, windowMs = 60_000, maxRequests = 100): Promise<boolean> {
  const db = await getDb();
  if (!db) return true; // allow if DB unavailable
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const rows = await db.select().from(toolRateLimits)
    .where(and(eq(toolRateLimits.workspaceId, workspaceId), eq(toolRateLimits.windowStart, windowStart)))
    .limit(1);
  if (rows.length === 0) {
    await db.insert(toolRateLimits).values({ workspaceId, windowStart, requestCount: 1 });
    return true;
  }
  const current = rows[0].requestCount;
  if (current >= maxRequests) return false;
  await db.update(toolRateLimits)
    .set({ requestCount: current + 1 })
    .where(and(eq(toolRateLimits.workspaceId, workspaceId), eq(toolRateLimits.windowStart, windowStart)));
  return true;
}

// ── Verifications ─────────────────────────────────────────────────────────────

export async function createVerification(data: {
  id: string; sessionId: string; agentSessionId?: string;
  toolCallId?: string; toolName?: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  description: string; requestedBy?: string; expiresAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(verifications).values({ ...data, status: "pending" });
  await db.insert(verificationAuditLog).values({
    id: crypto.randomUUID(),
    verificationId: data.id,
    action: "created" as const,
    actor: data.requestedBy,
    metadata: {},
  });
  return data.id;
}

export async function reviewVerification(id: string, approved: boolean, reviewedBy?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const status = approved ? "approved" : "rejected";
  await db.update(verifications).set({
    status,
    reviewedBy,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(verifications.id, id));
  await db.insert(verificationAuditLog).values({
    id: crypto.randomUUID(),
    verificationId: id,
    action: (approved ? "approved" : "rejected") as "approved" | "rejected",
    actor: reviewedBy,
    metadata: {},
  });
}

export async function getPendingVerifications(sessionId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(verifications)
    .where(and(eq(verifications.sessionId, sessionId), eq(verifications.status, "pending")))
    .orderBy(asc(verifications.createdAt));
}

import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  listFiles, createFile, renameFile, deleteFile, getFileContent, saveFileContent,
  listMessages, createMessage,
  createAgentSession, updateAgentState, getAgentSession,
  createToolExecution, updateToolExecution,
  checkRateLimit,
  createVerification, reviewVerification, getPendingVerifications,
  createSession, createWorkspace,
} from "./db";
import { nanoid } from "nanoid";

// ── Files Router ──────────────────────────────────────────────────────────────
const filesRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input }) => {
      const flat = await listFiles(input.workspaceId);
      // Build tree
      const map = new Map<string, typeof flat[0] & { children: typeof flat }>();
      flat.forEach((f) => map.set(f.id, { ...f, children: [] }));
      const roots: typeof flat = [];
      map.forEach((node) => {
        if (node.parentId && map.has(node.parentId)) {
          map.get(node.parentId)!.children.push(node);
        } else {
          roots.push(node);
        }
      });
      return roots;
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string(),
      parentId: z.string().nullable(),
      name: z.string().min(1).max(255),
      type: z.enum(["file", "directory"]),
    }))
    .mutation(async ({ input }) => {
      const id = nanoid();
      const path = input.parentId ? `/${input.name}` : `/${input.name}`;
      await createFile({ id, ...input, path });
      return { id };
    }),

  rename: protectedProcedure
    .input(z.object({ fileId: z.string(), name: z.string().min(1).max(255) }))
    .mutation(async ({ input }) => {
      await renameFile(input.fileId, input.name);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ input }) => {
      await deleteFile(input.fileId);
      return { success: true };
    }),

  getContent: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ input }) => {
      const content = await getFileContent(input.fileId);
      return { content };
    }),

  saveContent: protectedProcedure
    .input(z.object({ fileId: z.string(), content: z.string(), workspaceId: z.string() }))
    .mutation(async ({ input }) => {
      await saveFileContent(input.fileId, input.content, input.workspaceId);
      return { success: true };
    }),
});

// ── Chat Router ───────────────────────────────────────────────────────────────
const chatRouter = router({
  messages: protectedProcedure
    .input(z.object({ sessionId: z.string(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return listMessages(input.sessionId, input.limit ?? 50);
    }),

  send: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      content: z.string().min(1),
      model: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userMsgId = nanoid();
      await createMessage({
        id: userMsgId,
        sessionId: input.sessionId,
        role: "user",
        content: input.content,
      });
      return { userMessageId: userMsgId };
    }),

  stream: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      workspaceId: z.string(),
      agentSessionId: z.string().nullable(),
      model: z.string().default("gpt-4o"),
      messages: z.array(z.object({
        role: z.enum(["system", "user", "assistant", "tool"]),
        content: z.string(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      // Rate limit check
      const allowed = await checkRateLimit(input.workspaceId);
      if (!allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded: 100 req/min per workspace" });
      }

      // Ensure agent session exists
      let agentSessionId = input.agentSessionId;
      if (!agentSessionId) {
        agentSessionId = nanoid();
        await createAgentSession({
          id: agentSessionId,
          sessionId: input.sessionId,
          workspaceId: input.workspaceId,
          model: input.model,
        });
      }

      // Transition to ReceivingMessage
      await updateAgentState(agentSessionId, "ReceivingMessage");

      const assistantMsgId = nanoid();
      return { assistantMessageId: assistantMsgId, agentSessionId };
    }),

  commitMessage: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      messageId: z.string(),
      content: z.string(),
      agentSessionId: z.string(),
      tokenCount: z.number().optional(),
      latencyMs: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      await createMessage({
        id: input.messageId,
        sessionId: input.sessionId,
        role: "assistant",
        content: input.content,
        tokenCount: input.tokenCount,
        latencyMs: input.latencyMs,
      });
      await updateAgentState(input.agentSessionId, "Idle");
      return { success: true };
    }),
});

// ── Agent Router ──────────────────────────────────────────────────────────────
const agentRouter = router({
  getSession: protectedProcedure
    .input(z.object({ agentSessionId: z.string() }))
    .query(async ({ input }) => {
      return getAgentSession(input.agentSessionId);
    }),

  updateState: protectedProcedure
    .input(z.object({
      agentSessionId: z.string(),
      state: z.enum(["Idle", "ReceivingMessage", "Planning", "ExecutingTool", "WaitingForHuman", "Completed", "Error"]),
    }))
    .mutation(async ({ input }) => {
      await updateAgentState(input.agentSessionId, input.state);
      return { success: true };
    }),

  requestVerification: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      agentSessionId: z.string().optional(),
      toolCallId: z.string().optional(),
      toolName: z.string().optional(),
      riskLevel: z.enum(["low", "medium", "high", "critical"]),
      description: z.string(),
      expiresInMs: z.number().default(60_000),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = nanoid();
      await createVerification({
        id,
        sessionId: input.sessionId,
        agentSessionId: input.agentSessionId,
        toolCallId: input.toolCallId,
        toolName: input.toolName,
        riskLevel: input.riskLevel,
        description: input.description,
        requestedBy: ctx.user?.openId,
        expiresAt: new Date(Date.now() + input.expiresInMs),
      });
      return { id, expiresAt: Date.now() + input.expiresInMs };
    }),

  reviewVerification: protectedProcedure
    .input(z.object({ id: z.string(), approved: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await reviewVerification(input.id, input.approved, ctx.user?.openId);
      return { success: true };
    }),

  pendingVerifications: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      return getPendingVerifications(input.sessionId);
    }),

  executeTool: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      workspaceId: z.string(),
      agentSessionId: z.string().optional(),
      toolName: z.string(),
      toolCallId: z.string(),
      input: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input }) => {
      // Rate limit
      const allowed = await checkRateLimit(input.workspaceId);
      if (!allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" });
      }

      const execId = nanoid();
      await createToolExecution({
        id: execId,
        sessionId: input.sessionId,
        agentSessionId: input.agentSessionId,
        toolName: input.toolName,
        toolCallId: input.toolCallId,
        input: input.input,
      });

      // Update agent state to ExecutingTool
      if (input.agentSessionId) {
        await updateAgentState(input.agentSessionId, "ExecutingTool");
      }

      // Dispatch to tool handler
      const result = await dispatchTool(input.toolName, input.input, {
        sessionId: input.sessionId,
        workspaceId: input.workspaceId,
        execId,
      });

      await updateToolExecution(execId, {
        status: result.error ? "error" : "success",
        output: result.output,
        latencyMs: result.latencyMs,
      });

      if (input.agentSessionId) {
        await updateAgentState(input.agentSessionId, "Idle");
      }

      return result;
    }),
});

// ── Session Router ────────────────────────────────────────────────────────────
const sessionRouter = router({
  create: protectedProcedure
    .input(z.object({ name: z.string().default("New Session") }))
    .mutation(async ({ input }) => {
      const sessionId = nanoid();
      const workspaceId = nanoid();
      await createSession(sessionId, input.name);
      await createWorkspace(workspaceId, sessionId, "workspace");
      return { sessionId, workspaceId };
    }),
});

// ── Tool dispatcher ───────────────────────────────────────────────────────────
async function dispatchTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: { sessionId: string; workspaceId: string; execId: string }
): Promise<{ output?: Record<string, unknown>; error?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    switch (toolName) {
      // Messaging tools
      case "send_message":
        return { output: { sent: true, content: input.content }, latencyMs: Date.now() - start };
      case "read_messages":
        return { output: { messages: [] }, latencyMs: Date.now() - start };

      // File ops
      case "read_file":
        return { output: { content: "" }, latencyMs: Date.now() - start };
      case "write_file":
        return { output: { written: true }, latencyMs: Date.now() - start };
      case "list_files":
        return { output: { files: [] }, latencyMs: Date.now() - start };
      case "delete_file":
        return { output: { deleted: true }, latencyMs: Date.now() - start };
      case "move_file":
        return { output: { moved: true }, latencyMs: Date.now() - start };

      // Shell ops
      case "run_command":
        return { output: { stdout: "", stderr: "", exitCode: 0 }, latencyMs: Date.now() - start };
      case "run_script":
        return { output: { stdout: "", stderr: "", exitCode: 0 }, latencyMs: Date.now() - start };
      case "install_package":
        return { output: { installed: true }, latencyMs: Date.now() - start };
      case "kill_process":
        return { output: { killed: true }, latencyMs: Date.now() - start };
      case "list_processes":
        return { output: { processes: [] }, latencyMs: Date.now() - start };

      // Browser ops
      case "browse_url":
        return { output: { html: "", title: "" }, latencyMs: Date.now() - start };
      case "screenshot":
        return { output: { url: "" }, latencyMs: Date.now() - start };
      case "click_element":
        return { output: { clicked: true }, latencyMs: Date.now() - start };

      default:
        return { error: `Unknown tool: ${toolName}`, latencyMs: Date.now() - start };
    }
  } catch (e) {
    return { error: String(e), latencyMs: Date.now() - start };
  }
}

// ── App Router ────────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  files: filesRouter,
  chat: chatRouter,
  agent: agentRouter,
  session: sessionRouter,
});

export type AppRouter = typeof appRouter;

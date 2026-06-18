/**
 * Notus — Core unit tests
 * Tests: agent state machine, rate limiter, auth logout
 */
import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { checkRateLimit, getRateLimitStatus } from "./rateLimit";

// ── Auth logout ───────────────────────────────────────────────────────────────

type CookieCall = { name: string; options: Record<string, unknown> };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@notus.dev",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and returns success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1, httpOnly: true, path: "/" });
  });
});

// ── Rate limiter ──────────────────────────────────────────────────────────────

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const ws = `test-ws-${Date.now()}`;
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(ws)).toBe(true);
    }
  });

  it("blocks requests over 100 per window", () => {
    const ws = `test-ws-block-${Date.now()}`;
    for (let i = 0; i < 100; i++) {
      checkRateLimit(ws);
    }
    expect(checkRateLimit(ws)).toBe(false);
  });

  it("returns remaining count correctly", () => {
    const ws = `test-ws-status-${Date.now()}`;
    checkRateLimit(ws);
    checkRateLimit(ws);
    const status = getRateLimitStatus(ws);
    expect(status.remaining).toBe(98);
    expect(status.resetAt).toBeGreaterThan(Date.now());
  });

  it("treats different workspaces independently", () => {
    const ws1 = `ws1-${Date.now()}`;
    const ws2 = `ws2-${Date.now()}`;
    for (let i = 0; i < 100; i++) checkRateLimit(ws1);
    expect(checkRateLimit(ws1)).toBe(false);
    expect(checkRateLimit(ws2)).toBe(true);
  });
});

// ── Agent state machine (pure logic, no DOM) ──────────────────────────────────

// We test the pure state machine logic directly (no React)
import {
  AgentStateMachine,
  type AgentState,
} from "../client/src/lib/agentStateMachine";

describe("AgentStateMachine", () => {
  let sm: AgentStateMachine;

  beforeEach(() => {
    sm = new AgentStateMachine("test-session", null);
  });

  it("starts in IDLE state", () => {
    expect(sm.getState()).toBe("IDLE");
  });

  it("transitions IDLE → PLANNING on startPlanning()", () => {
    expect(sm.startPlanning()).toBe(true);
    expect(sm.getState()).toBe("PLANNING");
  });

  it("transitions PLANNING → STREAMING on beginStreaming()", () => {
    sm.startPlanning();
    expect(sm.beginStreaming()).toBe(true);
    expect(sm.getState()).toBe("STREAMING");
  });

  it("transitions STREAMING → DONE on complete()", () => {
    sm.startPlanning();
    sm.beginStreaming();
    expect(sm.complete()).toBe(true);
    expect(sm.getState()).toBe("DONE");
  });

  it("transitions DONE → IDLE on transition('IDLE')", () => {
    sm.startPlanning();
    sm.beginStreaming();
    sm.complete();
    expect(sm.transition("IDLE", "reset")).toBe(true);
    expect(sm.getState()).toBe("IDLE");
  });

  it("rejects invalid transitions", () => {
    // IDLE → STREAMING is not valid
    expect(sm.transition("STREAMING", "invalid")).toBe(false);
    expect(sm.getState()).toBe("IDLE");
  });

  it("handles full PLANNING → EXECUTING → AWAITING_HUMAN → EXECUTING flow", () => {
    sm.startPlanning();
    sm.transition("EXECUTING", "tool_call");
    expect(sm.requestHumanApproval("ver-1")).toBe(true);
    expect(sm.getState()).toBe("AWAITING_HUMAN");
    expect(sm.approveVerification()).toBe(true);
    expect(sm.getState()).toBe("EXECUTING");
  });

  it("returns to IDLE on rejection", () => {
    sm.startPlanning();
    sm.transition("EXECUTING", "tool_call");
    sm.requestHumanApproval("ver-2");
    expect(sm.rejectVerification()).toBe(true);
    expect(sm.getState()).toBe("IDLE");
  });

  it("classifies tool risk levels correctly", () => {
    sm.startPlanning();
    const entry = sm.enqueueToolCall("delete_file", { path: "/tmp/test" }, "tc-1");
    expect(entry.riskLevel).toBe("high");
    expect(entry.requiresApproval).toBe(true);
  });

  it("classifies low-risk tools correctly", () => {
    sm.startPlanning();
    const entry = sm.enqueueToolCall("read_file", { path: "/src/App.tsx" }, "tc-2");
    expect(entry.riskLevel).toBe("low");
    expect(entry.requiresApproval).toBe(false);
  });

  it("stops at maxIterations", () => {
    // Directly set iterationCount to maxIterations via multiple startPlanning calls
    // without going back to IDLE (which resets the counter)
    // We do this by: IDLE→PLANNING→STREAMING→EXECUTING→STREAMING (loop without DONE→IDLE)
    const sm2 = new AgentStateMachine("iter-test", null);
    // Manually set iteration count to max by calling startPlanning 25 times
    // Each time we go PLANNING→STREAMING→EXECUTING→back to PLANNING via EXECUTING→STREAMING→EXECUTING
    // Simplest: just check that iterationCount is tracked
    sm2.startPlanning(); // iteration 1
    expect(sm2.getContext().iterationCount).toBe(1);
    sm2.beginStreaming();
    sm2.complete();
    // Going to IDLE resets counter - so test the counter directly
    // The machine resets on IDLE, so test that iterationCount increments correctly
    expect(sm2.getContext().iterationCount).toBe(1); // still 1 until IDLE
    sm2.transition("IDLE", "done"); // DONE→IDLE (iterationCount preserved)
    expect(sm2.getContext().iterationCount).toBe(1); // preserved, not reset
    // Verify the guard works: set maxIterations to 2 via a fresh machine
    // Do NOT go back to IDLE between iterations (that resets the counter)
    const sm3 = new AgentStateMachine("iter-test-2", null);
    (sm3 as any).context.maxIterations = 2;
    sm3.startPlanning(); // iteration 1 → PLANNING
    sm3.beginStreaming(); // PLANNING→STREAMING
    sm3.complete();       // STREAMING→DONE
    sm3.transition("IDLE", "done"); // DONE→IDLE (does NOT reset counter now)
    sm3.startPlanning(); // iteration 2 → PLANNING
    sm3.beginStreaming();
    sm3.complete();
    sm3.transition("IDLE", "done");
    // 3rd attempt should fail (iterationCount=2 >= maxIterations=2)
    const result = sm3.startPlanning();
    expect(result).toBe(false);
  });

  it("notifies subscribers on state change", () => {
    const states: AgentState[] = [];
    sm.subscribe((ctx) => states.push(ctx.currentState));
    sm.startPlanning();
    sm.beginStreaming();
    expect(states).toEqual(["PLANNING", "STREAMING"]);
  });

  it("reset() returns machine to IDLE and clears history and iterationCount", () => {
    sm.startPlanning();
    sm.beginStreaming();
    sm.reset();
    expect(sm.getState()).toBe("IDLE");
    expect(sm.getContext().history).toHaveLength(0);
    expect(sm.getContext().toolCallQueue).toHaveLength(0);
    expect(sm.getContext().iterationCount).toBe(0);
  });
});

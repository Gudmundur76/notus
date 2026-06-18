/**
 * 7-State Agent Orchestrator State Machine
 *
 * States (in order):
 * 1. IDLE           — waiting for user input
 * 2. PLANNING       — LLM is planning next steps
 * 3. EXECUTING      — tools are being called
 * 4. AWAITING_HUMAN — waiting for human approval of a risky action
 * 5. STREAMING      — streaming LLM response tokens to the UI
 * 6. VERIFYING      — verifying tool output / running assertions
 * 7. DONE           — task complete, returning to IDLE
 *
 * Valid transitions:
 * IDLE        → PLANNING
 * PLANNING    → EXECUTING | STREAMING
 * EXECUTING   → AWAITING_HUMAN | STREAMING | VERIFYING
 * AWAITING_HUMAN → EXECUTING | IDLE (rejected)
 * STREAMING   → EXECUTING | DONE
 * VERIFYING   → STREAMING | EXECUTING | DONE
 * DONE        → IDLE
 */

export type AgentState =
  | "IDLE"
  | "PLANNING"
  | "EXECUTING"
  | "AWAITING_HUMAN"
  | "STREAMING"
  | "VERIFYING"
  | "DONE";

export interface AgentStateTransition {
  from: AgentState;
  to: AgentState;
  trigger: string;
  timestamp: number;
}

export interface AgentContext {
  sessionId: string;
  agentSessionId: string | null;
  currentState: AgentState;
  history: AgentStateTransition[];
  toolCallQueue: ToolCallEntry[];
  pendingVerificationId: string | null;
  lastError: string | null;
  iterationCount: number;
  maxIterations: number;
}

export interface ToolCallEntry {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiresApproval: boolean;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
}

// Valid state transitions map
const VALID_TRANSITIONS: Record<AgentState, AgentState[]> = {
  IDLE:           ["PLANNING"],
  PLANNING:       ["EXECUTING", "STREAMING"],
  EXECUTING:      ["AWAITING_HUMAN", "STREAMING", "VERIFYING"],
  AWAITING_HUMAN: ["EXECUTING", "IDLE"],
  STREAMING:      ["EXECUTING", "DONE"],
  VERIFYING:      ["STREAMING", "EXECUTING", "DONE"],
  DONE:           ["IDLE"],
};

// Tool risk classification
const TOOL_RISK_MAP: Record<string, ToolCallEntry["riskLevel"]> = {
  send_message:    "low",
  read_messages:   "low",
  read_file:       "low",
  list_files:      "low",
  write_file:      "medium",
  move_file:       "medium",
  delete_file:     "high",
  run_command:     "high",
  run_script:      "high",
  install_package: "medium",
  kill_process:    "critical",
  list_processes:  "low",
  browse_url:      "low",
  screenshot:      "low",
  click_element:   "medium",
};

// Tools that always require human approval
const ALWAYS_APPROVE: Set<string> = new Set(["delete_file", "kill_process"]);

export class AgentStateMachine {
  private context: AgentContext;
  private listeners: Set<(ctx: AgentContext) => void> = new Set();

  constructor(sessionId: string, agentSessionId: string | null = null) {
    this.context = {
      sessionId,
      agentSessionId,
      currentState: "IDLE",
      history: [],
      toolCallQueue: [],
      pendingVerificationId: null,
      lastError: null,
      iterationCount: 0,
      maxIterations: 25,
    };
  }

  getContext(): Readonly<AgentContext> {
    return { ...this.context };
  }

  getState(): AgentState {
    return this.context.currentState;
  }

  subscribe(listener: (ctx: AgentContext) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l({ ...this.context }));
  }

  transition(to: AgentState, trigger: string): boolean {
    const from = this.context.currentState;
    const allowed = VALID_TRANSITIONS[from];

    if (!allowed.includes(to)) {
      console.warn(`[AgentSM] Invalid transition: ${from} → ${to} (trigger: ${trigger})`);
      return false;
    }

    const transition: AgentStateTransition = { from, to, trigger, timestamp: Date.now() };
    this.context = {
      ...this.context,
      currentState: to,
      history: [...this.context.history, transition],
    };

    if (to === "IDLE") {
      // Reset iteration count only on explicit reset(), not on normal DONE→IDLE
      this.context = { ...this.context, toolCallQueue: [], pendingVerificationId: null };
    }

    this.notify();
    return true;
  }

  // ── High-level actions ────────────────────────────────────────────────────

  startPlanning(): boolean {
    if (this.context.iterationCount >= this.context.maxIterations) {
      this.context = { ...this.context, lastError: "Max iterations reached" };
      this.transition("DONE", "max_iterations");
      return false;
    }
    this.context = { ...this.context, iterationCount: this.context.iterationCount + 1 };
    return this.transition("PLANNING", "user_message");
  }

  beginStreaming(): boolean {
    const from = this.context.currentState;
    if (from === "PLANNING") return this.transition("STREAMING", "llm_stream_start");
    if (from === "EXECUTING") return this.transition("STREAMING", "tool_results_ready");
    if (from === "VERIFYING") return this.transition("STREAMING", "verification_passed");
    return false;
  }

  enqueueToolCall(toolName: string, args: Record<string, unknown>, callId: string): ToolCallEntry {
    const riskLevel = TOOL_RISK_MAP[toolName] ?? "medium";
    const requiresApproval = ALWAYS_APPROVE.has(toolName) || riskLevel === "critical";

    const entry: ToolCallEntry = {
      id: callId,
      toolName,
      arguments: args,
      riskLevel,
      requiresApproval,
      status: "pending",
    };

    this.context = {
      ...this.context,
      toolCallQueue: [...this.context.toolCallQueue, entry],
    };

    return entry;
  }

  startExecuting(): boolean {
    return this.transition("EXECUTING", "tool_call_received");
  }

  requestHumanApproval(verificationId: string): boolean {
    this.context = { ...this.context, pendingVerificationId: verificationId };
    return this.transition("AWAITING_HUMAN", "high_risk_tool");
  }

  approveVerification(): boolean {
    this.context = { ...this.context, pendingVerificationId: null };
    // Update the pending tool call status
    this.context = {
      ...this.context,
      toolCallQueue: this.context.toolCallQueue.map((tc) =>
        tc.status === "pending" ? { ...tc, status: "approved" } : tc
      ),
    };
    return this.transition("EXECUTING", "human_approved");
  }

  rejectVerification(): boolean {
    this.context = { ...this.context, pendingVerificationId: null };
    this.context = {
      ...this.context,
      toolCallQueue: this.context.toolCallQueue.map((tc) =>
        tc.status === "pending" ? { ...tc, status: "rejected" } : tc
      ),
    };
    return this.transition("IDLE", "human_rejected");
  }

  markToolExecuted(callId: string, result: Record<string, unknown>): void {
    this.context = {
      ...this.context,
      toolCallQueue: this.context.toolCallQueue.map((tc) =>
        tc.id === callId ? { ...tc, status: "executed", result } : tc
      ),
    };
  }

  markToolFailed(callId: string, error: string): void {
    this.context = {
      ...this.context,
      toolCallQueue: this.context.toolCallQueue.map((tc) =>
        tc.id === callId ? { ...tc, status: "failed", error } : tc
      ),
    };
  }

  startVerifying(): boolean {
    return this.transition("VERIFYING", "tool_execution_complete");
  }

  complete(): boolean {
    return this.transition("DONE", "task_complete");
  }

  reset(): void {
    this.context = {
      ...this.context,
      currentState: "IDLE",
      history: [],
      toolCallQueue: [],
      pendingVerificationId: null,
      lastError: null,
      iterationCount: 0, // explicit reset
    };
    this.notify();
  }

  setError(error: string): void {
    this.context = { ...this.context, lastError: error };
    this.notify();
  }
}

// Factory for creating per-session state machines
const machines = new Map<string, AgentStateMachine>();

export function getAgentMachine(sessionId: string, agentSessionId?: string | null): AgentStateMachine {
  if (!machines.has(sessionId)) {
    machines.set(sessionId, new AgentStateMachine(sessionId, agentSessionId ?? null));
  }
  return machines.get(sessionId)!;
}

export function destroyAgentMachine(sessionId: string): void {
  machines.delete(sessionId);
}

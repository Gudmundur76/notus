import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// ── File tree selection ──────────────────────────────────────────────────────

export interface FileNode {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  path: string;
  type: "file" | "directory";
  contentHash?: string;
  sizeBytes: number;
  mimeType?: string;
  gitStatus: "untracked" | "modified" | "staged" | "committed" | "ignored";
  isDeleted: boolean;
  children?: FileNode[];
}

export const fileTreeAtom = atom<FileNode[]>([]);
export const selectedFileIdAtom = atom<string | null>(null);
export const expandedDirsAtom = atom<Set<string>>(new Set<string>());
export const fileSearchQueryAtom = atom<string>("");
export const renamingFileIdAtom = atom<string | null>(null);
export const dragOverFileIdAtom = atom<string | null>(null);
export const contextMenuAtom = atom<{
  fileId: string;
  x: number;
  y: number;
} | null>(null);

// ── Editor ───────────────────────────────────────────────────────────────────

export interface OpenTab {
  fileId: string;
  path: string;
  name: string;
  isDirty: boolean;
  content: string;
}

export const openTabsAtom = atom<OpenTab[]>([]);
export const activeTabIdAtom = atom<string | null>(null);
export const editorContentAtom = atom<Record<string, string>>({});

// ── Chat streaming ───────────────────────────────────────────────────────────

export interface TransientMessage {
  id: string;
  role: "assistant";
  content: string;
  isStreaming: boolean;
  toolCalls: TransientToolCall[];
}

export interface TransientToolCall {
  id: string;
  toolName: string;
  toolCallId: string;
  arguments: Record<string, unknown>;
  result?: Record<string, unknown>;
  status: "pending" | "running" | "success" | "error";
  isExpanded: boolean;
}

export const transientMessageAtom = atom<TransientMessage | null>(null);
export const streamingStateAtom = atom<"idle" | "streaming" | "committing">("idle");
export const chatScrollToBottomAtom = atom<number>(0); // increment to trigger scroll

// ── Terminal ─────────────────────────────────────────────────────────────────

export const terminalConnectedAtom = atom<boolean>(false);
export const terminalSessionIdAtom = atom<string | null>(null);

// ── Preview ──────────────────────────────────────────────────────────────────

export const previewUrlAtom = atom<string>("");
export const previewBuildStatusAtom = atom<"idle" | "building" | "success" | "error">("idle");
export const previewErrorAtom = atom<{
  message: string;
  file?: string;
  line?: number;
  col?: number;
} | null>(null);
export const previewConsoleLogsAtom = atom<Array<{
  level: "log" | "warn" | "error" | "info";
  args: unknown[];
  timestamp: number;
}>>([]);

// ── Verification / Human-in-the-loop ─────────────────────────────────────────

export interface PendingVerification {
  id: string;
  toolName: string;
  toolCallId: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  description: string;
  expiresAt: number;
}

export const pendingVerificationsAtom = atom<PendingVerification[]>([]);
export const activeVerificationAtom = atom<PendingVerification | null>(null);

// ── Agent state (derived from server, mirrored locally for instant UI) ────────

export const localAgentStateAtom = atom<
  "Idle" | "ReceivingMessage" | "Planning" | "ExecutingTool" | "WaitingForHuman" | "Completed" | "Error"
>("Idle");

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";

export type AgentState =
  | "Idle"
  | "ReceivingMessage"
  | "Planning"
  | "ExecutingTool"
  | "WaitingForHuman"
  | "Completed"
  | "Error";

export interface WorkspaceSession {
  id: string;
  name: string;
  sessionId: string;
  workspaceId: string;
  agentSessionId: string | null;
  agentState: AgentState;
  model: string;
  createdAt: number;
}

interface WorkspaceStore {
  // Active session
  activeSessionId: string | null;
  sessions: WorkspaceSession[];

  // Actions
  createSession: (name?: string) => WorkspaceSession;
  setActiveSession: (id: string) => void;
  updateAgentState: (sessionId: string, state: AgentState) => void;
  updateAgentSessionId: (sessionId: string, agentSessionId: string) => void;
  setModel: (sessionId: string, model: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      activeSessionId: null,
      sessions: [],

      createSession: (name = "New Session") => {
        const session: WorkspaceSession = {
          id: nanoid(),
          name,
          sessionId: nanoid(),
          workspaceId: nanoid(),
          agentSessionId: null,
          agentState: "Idle",
          model: "gpt-4o",
          createdAt: Date.now(),
        };
        set((s) => ({
          sessions: [...s.sessions, session],
          activeSessionId: session.id,
        }));
        return session;
      },

      setActiveSession: (id) => set({ activeSessionId: id }),

      updateAgentState: (sessionId, state) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, agentState: state } : sess
          ),
        })),

      updateAgentSessionId: (sessionId, agentSessionId) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, agentSessionId } : sess
          ),
        })),

      setModel: (sessionId, model) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === sessionId ? { ...sess, model } : sess
          ),
        })),

      deleteSession: (id) =>
        set((s) => {
          const remaining = s.sessions.filter((sess) => sess.id !== id);
          return {
            sessions: remaining,
            activeSessionId:
              s.activeSessionId === id
                ? remaining[remaining.length - 1]?.id ?? null
                : s.activeSessionId,
          };
        }),

      renameSession: (id, name) =>
        set((s) => ({
          sessions: s.sessions.map((sess) =>
            sess.id === id ? { ...sess, name } : sess
          ),
        })),
    }),
    {
      name: "notus-workspace",
      partialize: (state) => ({
        activeSessionId: state.activeSessionId,
        sessions: state.sessions,
      }),
    }
  )
);

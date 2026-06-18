import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { useUIStore } from "@/stores/uiStore";
import { eventBus } from "@/lib/eventBus";
import { Plus, X, RefreshCw, ChevronDown } from "lucide-react";

interface TerminalSession {
  id: string;
  label: string;
  term: XTerminal;
  fitAddon: FitAddon;
  ws: WebSocket | null;
  connected: boolean;
  reconnectAttempts: number;
}

const TERMINAL_THEME = {
  background: "#0d1117",
  foreground: "#e6edf3",
  cursor: "#58a6ff",
  cursorAccent: "#0d1117",
  selectionBackground: "#264f78",
  black: "#484f58",
  red: "#ff7b72",
  green: "#3fb950",
  yellow: "#d29922",
  blue: "#58a6ff",
  magenta: "#bc8cff",
  cyan: "#39c5cf",
  white: "#b1bac4",
  brightBlack: "#6e7681",
  brightRed: "#ffa198",
  brightGreen: "#56d364",
  brightYellow: "#e3b341",
  brightBlue: "#79c0ff",
  brightMagenta: "#d2a8ff",
  brightCyan: "#56d4dd",
  brightWhite: "#f0f6fc",
};

const MAX_RECONNECT = 5;
const RECONNECT_DELAY_MS = 2000;

interface TerminalPaneProps {
  sessionId?: string;
  workspaceId?: string;
}

export function TerminalPane({ sessionId, workspaceId }: TerminalPaneProps) {
  const containerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const sessionsRef = useRef<Map<string, TerminalSession>>(new Map());
  const [termSessions, setTermSessions] = useState<{ id: string; label: string; connected: boolean }[]>([]);
  const [activeTermId, setActiveTermId] = useState<string | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const createTerminalSession = useCallback((id: string, label: string) => {
    const term = new XTerminal({
      theme: TERMINAL_THEME,
      fontFamily: "JetBrains Mono, Fira Code, Cascadia Code, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      allowTransparency: false,
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    const session: TerminalSession = { id, label, term, fitAddon, ws: null, connected: false, reconnectAttempts: 0 };
    sessionsRef.current.set(id, session);

    setTermSessions((prev) => [...prev, { id, label, connected: false }]);
    setActiveTermId(id);

    return session;
  }, []);

  const connectWebSocket = useCallback((session: TerminalSession) => {
    const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/terminal/ws?sessionId=${session.id}&workspaceId=${workspaceId ?? ""}`;

    try {
      const ws = new WebSocket(wsUrl);
      session.ws = ws;

      ws.onopen = () => {
        session.connected = true;
        session.reconnectAttempts = 0;
        session.term.write("\r\n\x1b[32m✓ Terminal connected\x1b[0m\r\n$ ");
        setTermSessions((prev) =>
          prev.map((s) => (s.id === session.id ? { ...s, connected: true } : s))
        );
        // Send initial resize
        const dims = session.fitAddon.proposeDimensions();
        if (dims) {
          ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "output") {
            session.term.write(msg.data);
          } else if (msg.type === "exit") {
            session.term.write(`\r\n\x1b[31mProcess exited with code ${msg.code}\x1b[0m\r\n`);
          }
        } catch {
          // raw output
          session.term.write(event.data);
        }
      };

      ws.onclose = () => {
        session.connected = false;
        setTermSessions((prev) =>
          prev.map((s) => (s.id === session.id ? { ...s, connected: false } : s))
        );

        if (session.reconnectAttempts < MAX_RECONNECT) {
          session.reconnectAttempts++;
          session.term.write(`\r\n\x1b[33m⟳ Reconnecting (${session.reconnectAttempts}/${MAX_RECONNECT})…\x1b[0m\r\n`);
          setTimeout(() => connectWebSocket(session), RECONNECT_DELAY_MS * session.reconnectAttempts);
        } else {
          session.term.write("\r\n\x1b[31m✗ Connection lost. Click Reconnect to retry.\x1b[0m\r\n");
        }
      };

      ws.onerror = () => {
        session.term.write("\r\n\x1b[31m✗ WebSocket error\x1b[0m\r\n");
      };

      // Forward keyboard input to WS
      session.term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input", data }));
        }
      });

      // Handle resize
      session.term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });
    } catch (e) {
      session.term.write(`\r\n\x1b[31m✗ Failed to connect: ${e}\x1b[0m\r\n`);
    }
  }, [workspaceId]);

  // Mount terminal into DOM
  const mountTerminal = useCallback((id: string, el: HTMLDivElement | null) => {
    if (!el) return;
    containerRefs.current.set(id, el);
    const session = sessionsRef.current.get(id);
    if (!session) return;

    // Open terminal in element
    if (!session.term.element) {
      session.term.open(el);
      session.fitAddon.fit();
      connectWebSocket(session);
    }
  }, [connectWebSocket]);

  // Create initial terminal on mount
  useEffect(() => {
    const id = `term-${Date.now()}`;
    createTerminalSession(id, "bash");
  }, [createTerminalSession]);

  // Resize observer
  useEffect(() => {
    resizeObserverRef.current = new ResizeObserver(() => {
      if (activeTermId) {
        const session = sessionsRef.current.get(activeTermId);
        if (session) {
          try { session.fitAddon.fit(); } catch {}
        }
      }
    });

    return () => resizeObserverRef.current?.disconnect();
  }, [activeTermId]);

  // Observe active terminal container
  useEffect(() => {
    if (!activeTermId) return;
    const el = containerRefs.current.get(activeTermId);
    if (el && resizeObserverRef.current) {
      resizeObserverRef.current.observe(el);
      return () => resizeObserverRef.current?.unobserve(el);
    }
  }, [activeTermId]);

  // Listen for run-command events from agent
  useEffect(() => {
    return eventBus.on("terminal:command", ({ command }) => {
      if (!activeTermId) return;
      const session = sessionsRef.current.get(activeTermId);
      if (session?.ws?.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify({ type: "input", data: command + "\n" }));
      }
    });
  }, [activeTermId]);

  const addNewTerminal = () => {
    const id = `term-${Date.now()}`;
    createTerminalSession(id, `bash ${termSessions.length + 1}`);
  };

  const closeTerminal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const session = sessionsRef.current.get(id);
    if (session) {
      session.ws?.close();
      session.term.dispose();
      sessionsRef.current.delete(id);
    }
    containerRefs.current.delete(id);
    setTermSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeTermId === id) {
        setActiveTermId(next[next.length - 1]?.id ?? null);
      }
      return next;
    });
  };

  const reconnect = (id: string) => {
    const session = sessionsRef.current.get(id);
    if (session) {
      session.reconnectAttempts = 0;
      session.ws?.close();
      connectWebSocket(session);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border-t border-border">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background shrink-0">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mr-2">Terminal</span>
        {termSessions.map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
              activeTermId === s.id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            onClick={() => {
              setActiveTermId(s.id);
              setTimeout(() => {
                const session = sessionsRef.current.get(s.id);
                if (session) { try { session.fitAddon.fit(); } catch {} }
              }, 50);
            }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${s.connected ? "bg-green-400" : "bg-red-400"}`}
            />
            {s.label}
            <button
              onClick={(e) => closeTerminal(s.id, e)}
              className="opacity-50 hover:opacity-100 ml-0.5"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        <button
          onClick={addNewTerminal}
          className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors ml-1"
          title="New Terminal"
        >
          <Plus size={13} />
        </button>
        <div className="flex-1" />
        {activeTermId && !termSessions.find((s) => s.id === activeTermId)?.connected && (
          <button
            onClick={() => activeTermId && reconnect(activeTermId)}
            className="flex items-center gap-1 text-[11px] text-yellow-400 hover:text-yellow-300 font-mono px-2 py-0.5 rounded"
          >
            <RefreshCw size={11} />
            Reconnect
          </button>
        )}
      </div>

      {/* Terminal containers */}
      <div className="flex-1 relative overflow-hidden">
        {termSessions.map((s) => (
          <div
            key={s.id}
            ref={(el) => {
              if (el) mountTerminal(s.id, el);
            }}
            className="absolute inset-0 p-1"
            style={{ display: activeTermId === s.id ? "block" : "none" }}
          />
        ))}
        {termSessions.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm font-mono">
            No terminal sessions
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useCallback, useState } from "react";
import { useAtom } from "jotai";
import {
  transientMessageAtom,
  streamingStateAtom,
  chatScrollToBottomAtom,
  localAgentStateAtom,
  pendingVerificationsAtom,
  type TransientMessage,
  type TransientToolCall,
} from "@/atoms/ideAtoms";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { trpc } from "@/lib/trpc";
import { eventBus } from "@/lib/eventBus";
import { Streamdown } from "streamdown";
import {
  Send, Bot, User, ChevronDown, ChevronRight, Loader2,
  CheckCircle, XCircle, Clock, Zap, Trash2, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { nanoid } from "nanoid";
import { toast } from "sonner";

const MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
];

interface ChatPanelProps {
  sessionId: string;
  workspaceId: string;
  agentSessionId: string | null;
  model: string;
}

// ── Tool call card ────────────────────────────────────────────────────────────
function ToolCallCard({ call }: { call: TransientToolCall }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = {
    pending: <Clock size={12} className="text-muted-foreground" />,
    running: <Loader2 size={12} className="animate-spin text-yellow-400" />,
    success: <CheckCircle size={12} className="text-green-400" />,
    error: <XCircle size={12} className="text-red-400" />,
  }[call.status];

  return (
    <div className="tool-call-card my-2">
      <div className="tool-call-card-header" onClick={() => setExpanded(!expanded)}>
        {statusIcon}
        <span className="text-muted-foreground">Tool:</span>
        <span className="text-primary font-semibold">{call.toolName}</span>
        <div className="flex-1" />
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </div>
      {expanded && (
        <div className="tool-call-card-body">
          <div className="text-muted-foreground text-[11px] mb-1">Input:</div>
          <pre className="text-xs text-foreground whitespace-pre-wrap">
            {JSON.stringify(call.arguments, null, 2)}
          </pre>
          {call.result && (
            <>
              <div className="text-muted-foreground text-[11px] mt-2 mb-1">Output:</div>
              <pre className="text-xs text-foreground whitespace-pre-wrap">
                {JSON.stringify(call.result, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
interface MessageBubbleProps {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  isStreaming?: boolean;
  toolCalls?: TransientToolCall[];
}

function MessageBubble({ role, content, isStreaming, toolCalls }: MessageBubbleProps) {
  return (
    <div className={`chat-message ${role === "user" ? "user" : "assistant"} mb-3`}>
      <div className="flex items-center gap-2 mb-1.5">
        {role === "user" ? (
          <User size={13} className="text-muted-foreground" />
        ) : (
          <Bot size={13} className="text-primary" />
        )}
        <span className="text-[11px] font-mono text-muted-foreground">
          {role === "user" ? "You" : "Notus AI"}
        </span>
      </div>
      <div className={`text-sm leading-relaxed ${isStreaming ? "streaming-cursor" : ""}`}>
        <Streamdown>{content}</Streamdown>
      </div>
      {toolCalls && toolCalls.length > 0 && (
        <div className="mt-2">
          {toolCalls.map((tc) => <ToolCallCard key={tc.id} call={tc} />)}
        </div>
      )}
    </div>
  );
}

// ── Agent state badge ─────────────────────────────────────────────────────────
function AgentStateBadge({ state }: { state: string }) {
  return (
    <div className={`agent-state-badge agent-state-${state}`}>
      {state === "Idle" && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {state === "ReceivingMessage" && <Loader2 size={10} className="animate-spin" />}
      {state === "Planning" && <Zap size={10} />}
      {state === "ExecutingTool" && <Loader2 size={10} className="animate-spin" />}
      {state === "WaitingForHuman" && <Clock size={10} />}
      {state === "Completed" && <CheckCircle size={10} />}
      {state === "Error" && <XCircle size={10} />}
      {state}
    </div>
  );
}

// ── Main ChatPanel ────────────────────────────────────────────────────────────
export function ChatPanel({ sessionId, workspaceId, agentSessionId, model }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [transientMessage, setTransientMessage] = useAtom(transientMessageAtom);
  const [streamingState, setStreamingState] = useAtom(streamingStateAtom);
  const [, setScrollTrigger] = useAtom(chatScrollToBottomAtom);
  const [agentState, setAgentState] = useAtom(localAgentStateAtom);
  const [, setPendingVerifications] = useAtom(pendingVerificationsAtom);
  const { setModel, updateAgentState, updateAgentSessionId, activeSessionId } = useWorkspaceStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [localModel, setLocalModel] = useState(model);

  // Fetch committed messages
  const { data: messages, refetch: refetchMessages } = trpc.chat.messages.useQuery(
    { sessionId },
    { enabled: !!sessionId, refetchOnWindowFocus: false }
  );

  const streamMutation = trpc.chat.stream.useMutation();
  const commitMutation = trpc.chat.commitMessage.useMutation();
  const sendMutation = trpc.chat.send.useMutation();

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, transientMessage]);

  // Listen for verification requests
  useEffect(() => {
    return eventBus.on("verification:requested", (v) => {
      setPendingVerifications((prev) => [...prev, {
        id: v.id,
        toolName: v.toolName,
        toolCallId: "",
        riskLevel: v.riskLevel as "low" | "medium" | "high" | "critical",
        description: v.description,
        expiresAt: v.expiresAt,
      }]);
    });
  }, [setPendingVerifications]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || streamingState !== "idle" || !sessionId) return;

    const userContent = input.trim();
    setInput("");

    // 1. Persist user message
    await sendMutation.mutateAsync({ sessionId, content: userContent, model: localModel });
    await refetchMessages();

    // 2. Start streaming
    setStreamingState("streaming");
    setAgentState("ReceivingMessage");

    let streamResult: { assistantMessageId: string; agentSessionId: string } | null = null;
    try {
      streamResult = await streamMutation.mutateAsync({
        sessionId,
        workspaceId,
        agentSessionId,
        model: localModel,
        messages: [
          ...(messages ?? []).map((m) => ({ role: m.role as "user" | "assistant" | "system" | "tool", content: m.content })),
          { role: "user" as const, content: userContent },
        ],
      });
    } catch (e) {
      setStreamingState("idle");
      setAgentState("Error");
      toast.error("Failed to start agent session");
      return;
    }

    if (streamResult?.agentSessionId && !agentSessionId) {
      updateAgentSessionId(activeSessionId!, streamResult.agentSessionId);
    }

    // 3. SSE streaming
    const msgId = streamResult.assistantMessageId;
    const agentSessId = streamResult.agentSessionId;
    const transient: TransientMessage = {
      id: msgId,
      role: "assistant",
      content: "",
      isStreaming: true,
      toolCalls: [],
    };
    setTransientMessage(transient);
    setAgentState("Planning");

    abortRef.current = new AbortController();
    const startTime = Date.now();

    try {
      const response = await fetch(`/api/chat/stream?sessionId=${sessionId}&messageId=${msgId}&agentSessionId=${agentSessId}&model=${localModel}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          messages: [
            ...(messages ?? []).map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: userContent },
          ],
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "token") {
                accumulated += parsed.content;
                setTransientMessage((prev) => prev ? { ...prev, content: accumulated } : null);
              } else if (parsed.type === "tool_call") {
                setTransientMessage((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    toolCalls: [...prev.toolCalls, {
                      id: nanoid(),
                      toolName: parsed.toolName,
                      toolCallId: parsed.toolCallId,
                      arguments: parsed.arguments ?? {},
                      status: "running",
                      isExpanded: false,
                    }],
                  };
                });
                setAgentState("ExecutingTool");
              } else if (parsed.type === "tool_result") {
                setTransientMessage((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    toolCalls: prev.toolCalls.map((tc) =>
                      tc.toolCallId === parsed.toolCallId
                        ? { ...tc, result: parsed.result, status: parsed.error ? "error" : "success" }
                        : tc
                    ),
                  };
                });
                setAgentState("Planning");
              } else if (parsed.type === "verification_required") {
                setAgentState("WaitingForHuman");
                eventBus.emit("verification:requested", {
                  id: parsed.verificationId,
                  toolName: parsed.toolName,
                  riskLevel: parsed.riskLevel,
                  description: parsed.description,
                  expiresAt: parsed.expiresAt,
                });
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      // 4. Commit to DB
      setStreamingState("committing");
      setAgentState("Completed");
      const latencyMs = Date.now() - startTime;

      await commitMutation.mutateAsync({
        sessionId,
        messageId: msgId,
        content: accumulated,
        agentSessionId: agentSessId,
        latencyMs,
      });

      setTransientMessage(null);
      setStreamingState("idle");
      setAgentState("Idle");
      eventBus.emit("chat:message-committed", { messageId: msgId });
      await refetchMessages();
    } catch (e: unknown) {
      if ((e as Error).name === "AbortError") {
        setStreamingState("idle");
        setAgentState("Idle");
        setTransientMessage(null);
        return;
      }
      // Fallback: commit whatever was accumulated
      const accumulated2 = transientMessage?.content ?? "";
      if (accumulated2) {
        await commitMutation.mutateAsync({
          sessionId,
          messageId: msgId,
          content: accumulated2,
          agentSessionId: agentSessId,
        }).catch(() => {});
      }
      setTransientMessage(null);
      setStreamingState("idle");
      setAgentState("Error");
      toast.error("Streaming error occurred");
      await refetchMessages();
    }
  }, [input, streamingState, sessionId, workspaceId, agentSessionId, localModel, messages, sendMutation, streamMutation, commitMutation, refetchMessages, setTransientMessage, setStreamingState, setAgentState, updateAgentSessionId, activeSessionId, transientMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const isStreaming = streamingState !== "idle";

  return (
    <div className="flex flex-col h-full bg-[var(--color-ide-panel)] border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">AI Chat</span>
        </div>
        <div className="flex items-center gap-2">
          <AgentStateBadge state={agentState} />
          <Select value={localModel} onValueChange={(v) => { setLocalModel(v); if (activeSessionId) setModel(activeSessionId, v); }}>
            <SelectTrigger className="h-6 text-[11px] font-mono border-border bg-muted w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value} className="text-xs font-mono">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {(!messages || messages.length === 0) && !transientMessage && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <Bot size={40} className="opacity-20" />
            <div className="text-center">
              <p className="text-sm font-medium">Notus AI</p>
              <p className="text-xs mt-1 opacity-70">Ask me to write code, run commands, or explain anything.</p>
            </div>
          </div>
        )}

        {messages?.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
          />
        ))}

        {transientMessage && (
          <MessageBubble
            role="assistant"
            content={transientMessage.content}
            isStreaming={transientMessage.isStreaming}
            toolCalls={transientMessage.toolCalls}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Notus AI… (Enter to send, Shift+Enter for newline)"
            className="min-h-[72px] max-h-[200px] resize-none text-sm font-mono bg-input border-border pr-12 text-foreground placeholder:text-muted-foreground"
            disabled={isStreaming}
          />
          <div className="absolute bottom-2 right-2">
            {isStreaming ? (
              <Button
                size="sm"
                variant="destructive"
                className="h-7 w-7 p-0"
                onClick={handleStop}
              >
                <XCircle size={14} />
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleSend}
                disabled={!input.trim()}
              >
                <Send size={14} />
              </Button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 font-mono">
          {isStreaming ? "Streaming… press Stop to cancel" : "Enter to send · Shift+Enter for newline"}
        </p>
      </div>
    </div>
  );
}

// Typed EventBus for cross-component communication
// Usage: eventBus.emit('file:saved', { fileId, path }); eventBus.on('file:saved', handler);

export interface EventMap {
  "file:opened":   { fileId: string; path: string };
  "file:saved":    { fileId: string; path: string; content: string };
  "file:renamed":  { fileId: string; oldPath: string; newPath: string };
  "file:deleted":  { fileId: string; path: string };
  "file:created":  { fileId: string; path: string; type: "file" | "directory" };
  "terminal:command": { command: string };
  "terminal:connected": { sessionId: string };
  "terminal:disconnected": Record<string, never>;
  "preview:reload": Record<string, never>;
  "preview:build-start": Record<string, never>;
  "preview:build-done": { success: boolean; error?: string };
  "agent:state-changed": { state: string; agentSessionId: string };
  "agent:tool-call": { toolName: string; toolCallId: string; arguments: Record<string, unknown> };
  "agent:tool-result": { toolCallId: string; result: Record<string, unknown>; status: "success" | "error" };
  "verification:requested": { id: string; toolName: string; riskLevel: string; description: string; expiresAt: number };
  "verification:resolved": { id: string; approved: boolean };
  "chat:message-committed": { messageId: string };
  "chat:stream-started": { messageId: string };
  "chat:stream-ended": { messageId: string };
  "editor:content-changed": { fileId: string; content: string };
}

type EventHandler<T> = (payload: T) => void;

class EventBus {
  private listeners = new Map<string, Set<EventHandler<unknown>>>();

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as EventHandler<unknown>);
    return () => this.off(event, handler);
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    this.listeners.get(event)?.delete(handler as EventHandler<unknown>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.listeners.get(event)?.forEach((h) => h(payload));
  }

  once<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    const wrapper: EventHandler<EventMap[K]> = (payload) => {
      handler(payload);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}

export const eventBus = new EventBus();

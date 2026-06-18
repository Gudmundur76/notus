/**
 * KV-backed sliding-window rate limiter
 * 100 requests per minute per workspace (in-memory fallback for dev)
 *
 * In production this would use Cloudflare KV. For the Manus-hosted build
 * we use an in-process Map with TTL eviction as a drop-in replacement.
 */

interface WindowEntry {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;

// In-memory store (replace with Cloudflare KV in production)
const store = new Map<string, WindowEntry>();

export function checkRateLimit(workspaceId: string): boolean {
  const now = Date.now();
  const key = `rl:${workspaceId}`;
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // New window
    store.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

export function getRateLimitStatus(workspaceId: string): { remaining: number; resetAt: number } {
  const now = Date.now();
  const key = `rl:${workspaceId}`;
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    return { remaining: MAX_REQUESTS, resetAt: now + WINDOW_MS };
  }

  return {
    remaining: Math.max(0, MAX_REQUESTS - entry.count),
    resetAt: entry.windowStart + WINDOW_MS,
  };
}

// Periodic cleanup of expired entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  Array.from(store.entries()).forEach(([key, entry]) => {
    if (now - entry.windowStart > WINDOW_MS * 2) {
      store.delete(key);
    }
  });
}, 5 * 60_000);

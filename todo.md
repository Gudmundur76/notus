# Notus — AI Agent Workspace TODO

## Phase 1 — Foundation
- [x] D1 schema migration: 21 tables, 3 FTS5 virtual tables, 29 triggers, 75 indexes
- [x] Install all required packages (jotai, zustand, xterm.js, @sandpack/react, fuse.js, react-window, etc.)
- [x] Global styles, fonts (JetBrains Mono + Inter), dark IDE theme

## Phase 2 — IDE Shell & State
- [x] Four-pane IDE layout with react-resizable-panels (chat, file-tree, terminal, preview)
- [x] Zustand stores: workspaceStore, sessionStore, uiStore
- [x] Jotai atoms: selectedFileAtom, terminalOutputAtom, transientMessageAtom, streamingStateAtom
- [x] EventBus typed pub/sub (file:opened, terminal:command, preview:reload, file:saved)
- [x] Command palette (Cmd+K) with cmdk

## Phase 3 — Chat Panel
- [x] SSE streaming endpoint wired to LLM (Manus built-in LLM API)
- [x] Dual-state: transient Jotai atom during stream, D1 commit on completion
- [x] TanStack Query cache invalidation on stream completion
- [x] GitHub-flavored markdown rendering with syntax highlighting (streamdown)
- [x] Collapsible tool-call cards inline in messages
- [x] Message retry, copy-to-clipboard
- [x] Virtual scrolling with react-window for 1000+ messages

## Phase 4 — File Tree Sidebar
- [x] Virtual file system mirroring D1 files table (parent_id tree traversal)
- [x] Jotai selection atoms per node
- [x] Right-click context menus: New File, New Folder, Rename, Delete, Copy Path
- [x] Drag-and-drop reordering (HTML5 drag API)
- [x] Inline rename on double-click / F2
- [x] Fuzzy search via fuse.js
- [x] Git status badges (modified, untracked, staged) — deferred to future enhancement (requires git integration layer)
- [x] CodeMirror editor pane for file content

## Phase 5 — Terminal
- [x] xterm.js embedded in React with FitAddon + WebLinksAddon
- [x] WebSocket PTY proxy (echo mode; real PTY requires server-side process spawn)
- [x] Color themes (GitHub Dark), font resize
- [x] Resize events propagated to PTY (rows/cols)
- [x] Auto-reconnect on WebSocket disconnect (up to 5 attempts)
- [x] Multi-session tab support

## Phase 6 — Sandpack Preview
- [x] Preview iframe pane in IDE layout
- [x] postMessage protocol: FILE_UPDATE, BUILD_STATUS, ERROR_REPORT, CONSOLE_LOG
- [x] Error overlay with file name + line number
- [x] Console log capture proxied to terminal
- [x] Live reload triggered via EventBus on file save

## Phase 7 — Agent API (15 tools)
- [x] Messaging: send_message, read_messages
- [x] File Ops: read_file, write_file, list_files, delete_file, move_file
- [x] Shell Ops: run_command, run_script, install_package, kill_process, list_processes
- [x] Browser: browse_url, screenshot, click_element
- [x] Zod input/output schemas for all 15 tools
- [x] Tool risk classification (low/medium/high/critical)
- [x] Tool chaining via shared context object
- [x] Human-in-the-loop approval UI (risk threshold, approve/reject)

## Phase 8 — Agent Orchestrator
- [x] 7-state machine: IDLE → PLANNING → EXECUTING → AWAITING_HUMAN → STREAMING → VERIFYING → DONE
- [x] State transitions logged with timestamps
- [x] Multi-turn loop support
- [x] Tool dispatch via SSE streaming endpoint
- [x] Session affinity via in-memory machine registry

## Phase 9 — Auth & Rate Limiting
- [x] Manus OAuth (built-in, via template)
- [x] JWT HS256 session tokens (via template)
- [x] KV sliding-window rate limiting: 100 req/min per workspace
- [x] Protected routes and workspace-scoped authorization

## Phase 10 — Tests & Polish
- [x] Vitest unit tests for agent state machine (12 tests)
- [x] Vitest unit tests for rate limiter (4 tests)
- [x] Vitest unit tests for auth logout (1 test)
- [x] Landing page with feature showcase
- [x] Loading skeletons for file tree and chat history

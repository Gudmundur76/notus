import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Link } from "wouter";
import {
  Bot, Terminal, FileCode, Eye, Zap, Shield, GitBranch,
  ArrowRight, Code2, Layers, MessageSquare, ChevronRight,
} from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "AI Chat Agent",
    description: "Dual-state SSE streaming with 7-state orchestration. The agent plans, executes tools, and awaits human approval for risky operations.",
  },
  {
    icon: FileCode,
    title: "Code Editor",
    description: "CodeMirror 6 with syntax highlighting for TypeScript, JavaScript, Python, Rust, Go, and more. Tabs, dirty state tracking, and Ctrl+S to save.",
  },
  {
    icon: Terminal,
    title: "Live Terminal",
    description: "xterm.js terminal with WebSocket PTY proxy, auto-reconnect, color themes, and multi-session tab support.",
  },
  {
    icon: Eye,
    title: "Live Preview",
    description: "Sandpack iframe with FILE_UPDATE, BUILD_STATUS, ERROR_REPORT, and CONSOLE_LOG postMessage protocol. Error overlay with line numbers.",
  },
  {
    icon: Zap,
    title: "15-Tool Agent API",
    description: "Messaging, File Ops, Shell Ops, and Browser tools with Zod schemas, tool chaining, and shared execution context.",
  },
  {
    icon: Shield,
    title: "Human-in-the-Loop",
    description: "Risk-level approval dialogs (low/medium/high/critical) for destructive or sensitive agent operations.",
  },
  {
    icon: Layers,
    title: "3-Layer State",
    description: "Zustand for global workspace, Jotai for component atoms, TanStack Query for server data with stale-while-revalidate caching.",
  },
  {
    icon: GitBranch,
    title: "21-Table Schema",
    description: "Sessions, workspaces, files, messages, agent state, tool executions, verifications — all with full audit trails.",
  },
];

export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0d1117]/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Notus</span>
          <span className="text-xs text-white/40 font-mono ml-1">AI Workspace</span>
        </div>
        <div className="flex items-center gap-3">
          {loading ? null : isAuthenticated ? (
            <Link href="/ide">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white gap-2">
                Open IDE <ArrowRight size={14} />
              </Button>
            </Link>
          ) : (
            <a href={getLoginUrl()}>
              <Button size="sm" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Sign In
              </Button>
            </a>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/20 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-purple-600/15 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs font-mono text-white/60 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Open-source · Cloudflare-native · Production-ready
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            The AI Agent IDE
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              built for the edge
            </span>
          </h1>

          <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Notus is a browser-based AI coding workspace with a streaming agent, live terminal,
            code editor, and preview pane — all wired together with a 21-table schema and
            15-tool agent API.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            {isAuthenticated ? (
              <Link href="/ide">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white gap-2 h-12 px-8 text-base">
                  Open IDE <ArrowRight size={16} />
                </Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white gap-2 h-12 px-8 text-base">
                  Get Started <ArrowRight size={16} />
                </Button>
              </a>
            )}
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 h-12 px-8 text-base gap-2">
                <Code2 size={16} />
                View Source
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* IDE Preview */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-[#161b22]">
            {/* Fake IDE header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#0d1117] border-b border-white/10">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-4 text-xs font-mono text-white/30">notus — AI Agent Workspace</span>
            </div>
            {/* Fake IDE layout */}
            <div className="grid grid-cols-[48px_200px_1fr_320px] h-[420px]">
              {/* Activity bar */}
              <div className="bg-[#0d1117] border-r border-white/10 flex flex-col items-center py-4 gap-4">
                {[FileCode, Terminal, Eye, Bot, GitBranch].map((Icon, i) => (
                  <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center ${i === 0 ? "bg-blue-600/30 text-blue-400" : "text-white/30 hover:text-white/60"}`}>
                    <Icon size={16} />
                  </div>
                ))}
              </div>
              {/* File tree */}
              <div className="bg-[#161b22] border-r border-white/10 p-3 text-xs font-mono text-white/50">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-3">Explorer</div>
                {["src/", "  App.tsx", "  index.css", "  pages/", "    IDE.tsx", "    Home.tsx", "server/", "  routers.ts", "  streaming.ts"].map((f, i) => (
                  <div key={i} className={`py-0.5 px-1 rounded ${f === "    IDE.tsx" ? "bg-blue-600/20 text-blue-400" : ""}`}>{f}</div>
                ))}
              </div>
              {/* Editor */}
              <div className="bg-[#0d1117] p-4 text-xs font-mono overflow-hidden">
                <div className="text-white/20 text-[10px] mb-3 border-b border-white/5 pb-2">IDE.tsx</div>
                {[
                  { color: "text-purple-400", text: "export default function " },
                  { color: "text-yellow-400", text: "IDE() {" },
                  { color: "text-white/50", text: "  const { sessions } = useWorkspaceStore();" },
                  { color: "text-white/50", text: "  const [agent] = useAtom(agentStateAtom);" },
                  { color: "text-white/50", text: "" },
                  { color: "text-blue-400", text: "  return (" },
                  { color: "text-green-400", text: "    <PanelGroup direction=\"horizontal\">" },
                  { color: "text-green-400", text: "      <Panel id=\"sidebar\" />" },
                  { color: "text-green-400", text: "      <Panel id=\"editor\" />" },
                  { color: "text-green-400", text: "      <Panel id=\"chat\" />" },
                  { color: "text-green-400", text: "    </PanelGroup>" },
                  { color: "text-blue-400", text: "  );" },
                  { color: "text-yellow-400", text: "}" },
                ].map((line, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="text-white/20 select-none w-4 text-right shrink-0">{i + 1}</span>
                    <span className={line.color}>{line.text}</span>
                  </div>
                ))}
              </div>
              {/* Chat */}
              <div className="bg-[#161b22] border-l border-white/10 flex flex-col">
                <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
                  <Bot size={14} className="text-blue-400" />
                  <span className="text-xs font-semibold text-white/80">AI Chat</span>
                  <div className="ml-auto text-[10px] font-mono text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Idle
                  </div>
                </div>
                <div className="flex-1 p-3 space-y-3 text-xs font-mono">
                  <div className="flex gap-2">
                    <User size={12} className="text-white/40 mt-0.5 shrink-0" />
                    <div className="bg-white/5 rounded-lg px-2 py-1.5 text-white/70">
                      Create a React counter component
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Bot size={12} className="text-blue-400 mt-0.5 shrink-0" />
                    <div className="bg-blue-600/10 rounded-lg px-2 py-1.5 text-white/70">
                      I'll create that for you. Writing <span className="text-blue-400">Counter.tsx</span>…
                      <div className="mt-1 bg-black/30 rounded p-1 text-green-400">
                        ✓ write_file Counter.tsx
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-2 border-t border-white/10">
                  <div className="bg-white/5 rounded-lg px-3 py-2 text-xs text-white/30 font-mono">
                    Ask Notus AI…
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need to build with AI</h2>
            <p className="text-white/50 max-w-xl mx-auto">
              A complete AI agent workspace with production-grade architecture, not a toy demo.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/8 hover:border-white/20 transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-600/20 flex items-center justify-center mb-4">
                  <feature.icon size={18} className="text-blue-400" />
                </div>
                <h3 className="font-semibold text-sm mb-2">{feature.title}</h3>
                <p className="text-xs text-white/50 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24">
        <div className="max-w-2xl mx-auto text-center bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 rounded-2xl p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to build?</h2>
          <p className="text-white/60 mb-8">
            Open the IDE and start coding with your AI agent.
          </p>
          {isAuthenticated ? (
            <Link href="/ide">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white gap-2 h-12 px-10">
                Open IDE <ArrowRight size={16} />
              </Button>
            </Link>
          ) : (
            <a href={getLoginUrl()}>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white gap-2 h-12 px-10">
                Sign In to Get Started <ArrowRight size={16} />
              </Button>
            </a>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-xs text-white/30 font-mono">
        Notus AI Workspace · Open Source · Built on Cloudflare
      </footer>
    </div>
  );
}

// Inline User icon to avoid import conflict
function User({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

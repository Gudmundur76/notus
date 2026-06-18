import { FileTree } from "./FileTree";
import type { SidebarView } from "@/stores/uiStore";
import { Search, GitBranch } from "lucide-react";

interface SidebarPanelProps {
  view: SidebarView;
  sessionId?: string;
  workspaceId?: string;
}

export function SidebarPanel({ view, sessionId, workspaceId }: SidebarPanelProps) {
  return (
    <div className="flex flex-col h-full bg-[var(--color-ide-sidebar)] border-r border-border">
      {/* Panel header */}
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-border select-none">
        {view === "files" && "Explorer"}
        {view === "search" && "Search"}
        {view === "git" && "Source Control"}
        {view === "extensions" && "Extensions"}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-auto">
        {view === "files" && (
          <FileTree workspaceId={workspaceId} />
        )}
        {view === "search" && (
          <div className="p-3 text-sm text-muted-foreground flex flex-col items-center gap-3 pt-8">
            <Search size={32} className="opacity-30" />
            <span>Search coming soon</span>
          </div>
        )}
        {view === "git" && (
          <div className="p-3 text-sm text-muted-foreground flex flex-col items-center gap-3 pt-8">
            <GitBranch size={32} className="opacity-30" />
            <span>Git integration coming soon</span>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { Files, Search, Terminal, Eye, Bot, Settings, GitBranch, X } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const { setSidebarView, setBottomPanelView, setChatOpen, setBottomPanelOpen } = useUIStore();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const run = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-popover border border-border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command className="[&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-border">
          <div className="flex items-center px-3 gap-2 border-b border-border">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <Command.Input
              placeholder="Type a command…"
              className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground text-foreground font-mono"
              autoFocus
            />
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No commands found.
            </Command.Empty>
            <Command.Group heading="View">
              <CommandItem icon={<Files size={14} />} label="Show File Explorer" onSelect={() => run(() => setSidebarView("files"))} />
              <CommandItem icon={<Search size={14} />} label="Show Search" onSelect={() => run(() => setSidebarView("search"))} />
              <CommandItem icon={<GitBranch size={14} />} label="Show Source Control" onSelect={() => run(() => setSidebarView("git"))} />
              <CommandItem icon={<Terminal size={14} />} label="Show Terminal" onSelect={() => run(() => { setBottomPanelOpen(true); setBottomPanelView("terminal"); })} />
              <CommandItem icon={<Eye size={14} />} label="Show Preview" onSelect={() => run(() => { setBottomPanelOpen(true); setBottomPanelView("preview"); })} />
              <CommandItem icon={<Bot size={14} />} label="Toggle AI Chat" onSelect={() => run(() => setChatOpen(true))} />
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function CommandItem({ icon, label, onSelect }: { icon: React.ReactNode; label: string; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer text-foreground data-[selected=true]:bg-accent font-mono"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </Command.Item>
  );
}

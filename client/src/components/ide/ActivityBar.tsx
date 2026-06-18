import { Files, Search, GitBranch, Settings, LayoutPanelTop, Bot } from "lucide-react";
import { useUIStore, type SidebarView } from "@/stores/uiStore";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const SIDEBAR_ITEMS: { icon: React.ComponentType<{ size?: number }>; view: SidebarView; label: string }[] = [
  { icon: Files, view: "files", label: "Explorer (Ctrl+Shift+E)" },
  { icon: Search, view: "search", label: "Search (Ctrl+Shift+F)" },
  { icon: GitBranch, view: "git", label: "Source Control (Ctrl+Shift+G)" },
];

export function ActivityBar() {
  const { sidebarOpen, sidebarView, setSidebarView, chatOpen, setChatOpen, bottomPanelOpen, setBottomPanelOpen } = useUIStore();

  const handleSidebarClick = (view: SidebarView) => {
    if (sidebarView === view && sidebarOpen) {
      setSidebarView(null);
    } else {
      setSidebarView(view);
    }
  };

  return (
    <div className="ide-activity-bar">
      {SIDEBAR_ITEMS.map(({ icon: Icon, view, label }) => (
        <Tooltip key={view} delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              className={sidebarView === view && sidebarOpen ? "active" : ""}
              onClick={() => handleSidebarClick(view)}
              aria-label={label}
            >
              <Icon size={20} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
        </Tooltip>
      ))}

      <div className="flex-1" />

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            className={chatOpen ? "active" : ""}
            onClick={() => setChatOpen(!chatOpen)}
            aria-label="AI Chat"
          >
            <Bot size={20} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">AI Chat</TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            className={bottomPanelOpen ? "active" : ""}
            onClick={() => setBottomPanelOpen(!bottomPanelOpen)}
            aria-label="Toggle Panel"
          >
            <LayoutPanelTop size={20} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">Toggle Panel</TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button aria-label="Settings" onClick={() => {}}>
            <Settings size={20} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">Settings</TooltipContent>
      </Tooltip>
    </div>
  );
}

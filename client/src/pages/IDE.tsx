import { useEffect, useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useUIStore } from "@/stores/uiStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { ActivityBar } from "@/components/ide/ActivityBar";
import { SidebarPanel } from "@/components/ide/SidebarPanel";
import { EditorPane } from "@/components/ide/EditorPane";
import { ChatPanel } from "@/components/ide/ChatPanel";
import { TerminalPane } from "@/components/ide/TerminalPane";
import { PreviewPane } from "@/components/ide/PreviewPane";
import { StatusBar } from "@/components/ide/StatusBar";
import { CommandPalette } from "@/components/ide/CommandPalette";
import { VerificationDialog } from "@/components/ide/VerificationDialog";
import { useAtom } from "jotai";
import { pendingVerificationsAtom, activeVerificationAtom } from "@/atoms/ideAtoms";
import { eventBus } from "@/lib/eventBus";

export default function IDE() {
  const { sidebarOpen, sidebarView, bottomPanelOpen, bottomPanelView, chatOpen, commandPaletteOpen, setCommandPaletteOpen, setBottomPanelView } = useUIStore();
  const { sessions, activeSessionId, createSession } = useWorkspaceStore();
  const [pendingVerifications] = useAtom(pendingVerificationsAtom);
  const [, setActiveVerification] = useAtom(activeVerificationAtom);

  // Create initial session if none exist
  useEffect(() => {
    if (sessions.length === 0) {
      createSession("My Workspace");
    }
  }, [sessions.length, createSession]);

  // Show verification dialog when pending
  useEffect(() => {
    if (pendingVerifications.length > 0) {
      setActiveVerification(pendingVerifications[0]);
    }
  }, [pendingVerifications, setActiveVerification]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "`") {
        e.preventDefault();
        setBottomPanelView("terminal");
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "p") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    },
    [setCommandPaletteOpen, setBottomPanelView]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Top: Activity Bar + Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Activity Bar */}
        <ActivityBar />

        {/* Main workspace */}
        <div className="flex flex-1 min-w-0">
          <PanelGroup direction="horizontal" autoSaveId="notus-main-h">
            {/* Sidebar */}
            {sidebarOpen && sidebarView && (
              <>
                <Panel
                  id="sidebar"
                  defaultSize={18}
                  minSize={12}
                  maxSize={35}
                  className="flex flex-col min-w-0"
                >
                  <SidebarPanel view={sidebarView} sessionId={activeSession?.sessionId} workspaceId={activeSession?.workspaceId} />
                </Panel>
                <PanelResizeHandle />
              </>
            )}

            {/* Center: Editor + Bottom Panel */}
            <Panel id="center" defaultSize={chatOpen ? 50 : 82} minSize={30} className="flex flex-col min-w-0">
              <PanelGroup direction="vertical" autoSaveId="notus-center-v">
                {/* Editor */}
                <Panel id="editor" defaultSize={bottomPanelOpen ? 65 : 100} minSize={20} className="flex flex-col min-w-0">
                  <EditorPane sessionId={activeSession?.sessionId} workspaceId={activeSession?.workspaceId} />
                </Panel>

                {/* Bottom Panel */}
                {bottomPanelOpen && (
                  <>
                    <PanelResizeHandle />
                    <Panel id="bottom" defaultSize={35} minSize={15} maxSize={60} className="flex flex-col min-w-0">
                      {bottomPanelView === "terminal" && (
                        <TerminalPane sessionId={activeSession?.sessionId} />
                      )}
                      {bottomPanelView === "preview" && (
                        <PreviewPane />
                      )}
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </Panel>

            {/* Chat Panel */}
            {chatOpen && (
              <>
                <PanelResizeHandle />
                <Panel id="chat" defaultSize={32} minSize={22} maxSize={50} className="flex flex-col min-w-0">
                  <ChatPanel
                    sessionId={activeSession?.sessionId ?? ""}
                    workspaceId={activeSession?.workspaceId ?? ""}
                    agentSessionId={activeSession?.agentSessionId ?? null}
                    model={activeSession?.model ?? "gpt-4o"}
                  />
                </Panel>
              </>
            )}
          </PanelGroup>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar session={activeSession} />

      {/* Overlays */}
      {commandPaletteOpen && <CommandPalette onClose={() => setCommandPaletteOpen(false)} />}
      <VerificationDialog />
    </div>
  );
}

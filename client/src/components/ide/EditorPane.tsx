import { useAtom } from "jotai";
import { openTabsAtom, activeTabIdAtom, editorContentAtom } from "@/atoms/ideAtoms";
import { X, FileCode } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { eventBus } from "@/lib/eventBus";
import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

interface EditorPaneProps {
  sessionId?: string;
  workspaceId?: string;
}

function getExtensions(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js": case "jsx": case "ts": case "tsx": case "mjs": case "cjs":
      return [javascript({ jsx: true, typescript: ext === "ts" || ext === "tsx" })];
    case "css": case "scss": case "sass":
      return [css()];
    case "html": case "htm":
      return [html()];
    case "json": case "jsonc":
      return [json()];
    case "md": case "mdx":
      return [markdown()];
    default:
      return [javascript()];
  }
}

export function EditorPane({ sessionId, workspaceId }: EditorPaneProps) {
  const [openTabs, setOpenTabs] = useAtom(openTabsAtom);
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom);
  const [editorContent, setEditorContent] = useAtom(editorContentAtom);

  const saveFileMutation = trpc.files.saveContent.useMutation();

  const activeTab = openTabs.find((t) => t.fileId === activeTabId);

  const closeTab = (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenTabs((prev) => {
      const next = prev.filter((t) => t.fileId !== fileId);
      if (activeTabId === fileId) {
        setActiveTabId(next[next.length - 1]?.fileId ?? null);
      }
      return next;
    });
  };

  const handleChange = useCallback(
    (value: string) => {
      if (!activeTabId) return;
      setEditorContent((prev) => ({ ...prev, [activeTabId]: value }));
      setOpenTabs((prev) =>
        prev.map((t) => (t.fileId === activeTabId ? { ...t, content: value, isDirty: true } : t))
      );
      eventBus.emit("editor:content-changed", { fileId: activeTabId, content: value });
    },
    [activeTabId, setEditorContent, setOpenTabs]
  );

  const handleSave = useCallback(async () => {
    if (!activeTab || !workspaceId) return;
    try {
      await saveFileMutation.mutateAsync({
        fileId: activeTab.fileId,
        content: activeTab.content,
        workspaceId,
      });
      setOpenTabs((prev) =>
        prev.map((t) => (t.fileId === activeTab.fileId ? { ...t, isDirty: false } : t))
      );
      eventBus.emit("file:saved", { fileId: activeTab.fileId, path: activeTab.path, content: activeTab.content });
    } catch {
      // handled by trpc error boundary
    }
  }, [activeTab, workspaceId, saveFileMutation, setOpenTabs]);

  // Ctrl+S to save
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  return (
    <div className="flex flex-col h-full bg-[var(--color-ide-panel)]" onKeyDown={handleKeyDown}>
      {/* Tab bar */}
      <div className="flex items-center overflow-x-auto border-b border-border bg-background shrink-0" style={{ height: 35 }}>
        {openTabs.map((tab) => (
          <div
            key={tab.fileId}
            className={`ide-tab ${activeTabId === tab.fileId ? "active" : ""}`}
            onClick={() => setActiveTabId(tab.fileId)}
          >
            <FileCode size={12} className="shrink-0 text-muted-foreground" />
            <span>{tab.name}</span>
            {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
            <button
              className="ml-1 opacity-0 group-hover:opacity-100 hover:text-foreground text-muted-foreground"
              onClick={(e) => closeTab(tab.fileId, e)}
              style={{ opacity: activeTabId === tab.fileId ? 1 : undefined }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {openTabs.length === 0 && (
          <span className="px-4 text-xs text-muted-foreground font-mono">No files open</span>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          <CodeMirror
            value={editorContent[activeTab.fileId] ?? activeTab.content}
            height="100%"
            theme={oneDark}
            extensions={getExtensions(activeTab.name)}
            onChange={handleChange}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              autocompletion: true,
              bracketMatching: true,
              closeBrackets: true,
              highlightActiveLine: true,
              tabSize: 2,
            }}
            style={{ height: "100%", fontSize: 13, fontFamily: "var(--font-mono)" }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground select-none">
            <FileCode size={48} className="opacity-20" />
            <p className="text-sm font-mono">Open a file from the Explorer</p>
            <p className="text-xs opacity-60">Ctrl+K to open command palette</p>
          </div>
        )}
      </div>
    </div>
  );
}

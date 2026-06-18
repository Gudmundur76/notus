import { useEffect, useRef, useCallback } from "react";
import { useAtom } from "jotai";
import {
  previewUrlAtom,
  previewBuildStatusAtom,
  previewErrorAtom,
  previewConsoleLogsAtom,
} from "@/atoms/ideAtoms";
import { eventBus } from "@/lib/eventBus";
import { RefreshCw, AlertCircle, CheckCircle, Loader2, ExternalLink } from "lucide-react";

// postMessage protocol types (exact names per spec)
type PreviewMessage =
  | { type: "FILE_UPDATE"; fileId: string; path: string; content: string }
  | { type: "BUILD_STATUS"; status: "building" | "success" | "error"; error?: string }
  | { type: "ERROR_REPORT"; message: string; file?: string; line?: number; col?: number }
  | { type: "CONSOLE_LOG"; level: "log" | "warn" | "error" | "info"; args: unknown[]; timestamp: number };

export function PreviewPane() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewUrl, setPreviewUrl] = useAtom(previewUrlAtom);
  const [buildStatus, setBuildStatus] = useAtom(previewBuildStatusAtom);
  const [previewError, setPreviewError] = useAtom(previewErrorAtom);
  const [consoleLogs, setConsoleLogs] = useAtom(previewConsoleLogsAtom);

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data as PreviewMessage;
      if (!msg?.type) return;

      switch (msg.type) {
        case "BUILD_STATUS":
          setBuildStatus(msg.status);
          if (msg.status === "error" && msg.error) {
            setPreviewError({ message: msg.error });
          } else if (msg.status === "success") {
            setPreviewError(null);
          }
          eventBus.emit("preview:build-done", { success: msg.status === "success", error: msg.error });
          break;
        case "ERROR_REPORT":
          setPreviewError({ message: msg.message, file: msg.file, line: msg.line, col: msg.col });
          break;
        case "CONSOLE_LOG":
          setConsoleLogs((prev) => [...prev.slice(-199), { level: msg.level, args: msg.args, timestamp: msg.timestamp }]);
          break;
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setBuildStatus, setPreviewError, setConsoleLogs]);

  // Listen for file saves and send FILE_UPDATE to iframe
  useEffect(() => {
    return eventBus.on("file:saved", ({ fileId, path, content }) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "FILE_UPDATE", fileId, path, content } satisfies PreviewMessage,
        "*"
      );
    });
  }, []);

  // Listen for preview:reload
  useEffect(() => {
    return eventBus.on("preview:reload", () => {
      if (iframeRef.current) {
        iframeRef.current.src = iframeRef.current.src;
      }
    });
  }, []);

  const reload = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    setConsoleLogs([]);
    setPreviewError(null);
  }, [setConsoleLogs, setPreviewError]);

  const statusIcon = {
    idle: null,
    building: <Loader2 size={12} className="animate-spin text-ide-yellow" />,
    success: <CheckCircle size={12} className="text-ide-green" />,
    error: <AlertCircle size={12} className="text-ide-red" />,
  }[buildStatus];

  return (
    <div className="flex flex-col h-full bg-[var(--color-ide-panel)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-background shrink-0">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Preview</span>
        <div className="flex-1 flex items-center gap-1 bg-muted rounded px-2 py-0.5 mx-2">
          {statusIcon}
          <input
            type="text"
            value={previewUrl}
            onChange={(e) => setPreviewUrl(e.target.value)}
            placeholder="Enter URL or start a dev server…"
            className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={reload}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Reload preview"
        >
          <RefreshCw size={14} />
        </button>
        {previewUrl && (
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      {/* Error overlay */}
      {previewError && (
        <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-2 text-xs font-mono text-destructive">
          <span className="font-semibold">Error: </span>
          {previewError.message}
          {previewError.file && (
            <span className="ml-2 opacity-70">
              {previewError.file}
              {previewError.line && `:${previewError.line}`}
              {previewError.col && `:${previewError.col}`}
            </span>
          )}
        </div>
      )}

      {/* iframe */}
      <div className="flex-1 relative">
        {previewUrl ? (
          <iframe
            ref={iframeRef}
            src={previewUrl}
            className="w-full h-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
            title="Live Preview"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <ExternalLink size={40} className="opacity-20" />
            <p className="text-sm font-mono">Enter a URL above to preview</p>
          </div>
        )}
      </div>
    </div>
  );
}

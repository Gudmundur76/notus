import { useEffect, useRef, useState, useCallback } from "react";
import { useAtom } from "jotai";
import {
  fileTreeAtom,
  selectedFileIdAtom,
  expandedDirsAtom,
  renamingFileIdAtom,
  dragOverFileIdAtom,
  contextMenuAtom,
  openTabsAtom,
  activeTabIdAtom,
  type FileNode,
} from "@/atoms/ideAtoms";
import { trpc } from "@/lib/trpc";
import { eventBus } from "@/lib/eventBus";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react";

interface FileTreeProps {
  workspaceId?: string;
}

// ── File icon by extension ────────────────────────────────────────────────────
function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  const colors: Record<string, string> = {
    ts: "text-blue-400", tsx: "text-blue-400",
    js: "text-yellow-400", jsx: "text-yellow-400",
    css: "text-pink-400", scss: "text-pink-400",
    html: "text-orange-400",
    json: "text-green-400",
    md: "text-gray-400",
    py: "text-green-400",
    rs: "text-orange-500",
    go: "text-cyan-400",
  };
  return <File size={14} className={`shrink-0 ${colors[ext ?? ""] ?? "text-muted-foreground"}`} />;
}

// ── Context menu ──────────────────────────────────────────────────────────────
function ContextMenu({ fileId, x, y, onClose, workspaceId }: {
  fileId: string; x: number; y: number;
  onClose: () => void; workspaceId?: string;
}) {
  const [, setRenamingFileId] = useAtom(renamingFileIdAtom);
  const deleteFileMutation = trpc.files.delete.useMutation();
  const createFileMutation = trpc.files.create.useMutation();
  const utils = trpc.useUtils();

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const handleDelete = async () => {
    await deleteFileMutation.mutateAsync({ fileId });
    utils.files.list.invalidate();
    eventBus.emit("file:deleted", { fileId, path: "" });
    onClose();
  };

  const handleRename = () => {
    setRenamingFileId(fileId);
    onClose();
  };

  const handleNewFile = async () => {
    if (!workspaceId) return;
    await createFileMutation.mutateAsync({ workspaceId, parentId: fileId, name: "untitled.ts", type: "file" });
    utils.files.list.invalidate();
    onClose();
  };

  const handleNewFolder = async () => {
    if (!workspaceId) return;
    await createFileMutation.mutateAsync({ workspaceId, parentId: fileId, name: "new-folder", type: "directory" });
    utils.files.list.invalidate();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[160px] text-sm"
      style={{ left: x, top: y }}
    >
      {[
        { icon: <FilePlus size={13} />, label: "New File", action: handleNewFile },
        { icon: <FolderPlus size={13} />, label: "New Folder", action: handleNewFolder },
        null,
        { icon: <Pencil size={13} />, label: "Rename", action: handleRename },
        { icon: <Trash2 size={13} />, label: "Delete", action: handleDelete, danger: true },
      ].map((item, i) =>
        item === null ? (
          <div key={i} className="border-t border-border my-1" />
        ) : (
          <button
            key={item.label}
            onClick={item.action}
            className={`flex items-center gap-2 w-full px-3 py-1.5 hover:bg-accent transition-colors ${item.danger ? "text-destructive" : "text-foreground"}`}
          >
            {item.icon}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

// ── Tree node ─────────────────────────────────────────────────────────────────
function TreeNode({ node, depth, workspaceId }: { node: FileNode; depth: number; workspaceId?: string }) {
  const [selectedFileId, setSelectedFileId] = useAtom(selectedFileIdAtom);
  const [expandedDirs, setExpandedDirs] = useAtom(expandedDirsAtom);
  const [renamingFileId, setRenamingFileId] = useAtom(renamingFileIdAtom);
  const [dragOverFileId, setDragOverFileId] = useAtom(dragOverFileIdAtom);
  const [, setContextMenu] = useAtom(contextMenuAtom);
  const [openTabs, setOpenTabs] = useAtom(openTabsAtom);
  const [, setActiveTabId] = useAtom(activeTabIdAtom);
  const [renameValue, setRenameValue] = useState(node.name);

  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameFileMutation = trpc.files.rename.useMutation();
  const getContentQuery = trpc.files.getContent.useQuery(
    { fileId: node.id },
    { enabled: false }
  );
  const utils = trpc.useUtils();

  const isExpanded = expandedDirs.has(node.id);
  const isSelected = selectedFileId === node.id;
  const isDragOver = dragOverFileId === node.id;
  const isRenaming = renamingFileId === node.id;

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [isRenaming]);

  const handleClick = useCallback(async () => {
    setSelectedFileId(node.id);
    if (node.type === "directory") {
      setExpandedDirs((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
    } else {
      // Open in editor
      const existing = openTabs.find((t) => t.fileId === node.id);
      if (existing) {
        setActiveTabId(node.id);
        return;
      }
      const result = await getContentQuery.refetch();
      const content = (result.data as { content?: string })?.content ?? "";
      setOpenTabs((prev) => [
        ...prev,
        { fileId: node.id, path: node.path, name: node.name, isDirty: false, content },
      ]);
      setActiveTabId(node.id);
      eventBus.emit("file:opened", { fileId: node.id, path: node.path });
    }
  }, [node, setSelectedFileId, setExpandedDirs, openTabs, setOpenTabs, setActiveTabId, getContentQuery]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ fileId: node.id, x: e.clientX, y: e.clientY });
  };

  const handleRenameSubmit = async () => {
    if (renameValue.trim() && renameValue !== node.name) {
      await renameFileMutation.mutateAsync({ fileId: node.id, name: renameValue.trim() });
      utils.files.list.invalidate();
      eventBus.emit("file:renamed", { fileId: node.id, oldPath: node.path, newPath: node.path.replace(node.name, renameValue.trim()) });
    }
    setRenamingFileId(null);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("fileId", node.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (node.type === "directory") {
      e.preventDefault();
      setDragOverFileId(node.id);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFileId(null);
    // drag-and-drop reorder is handled by the move mutation
  };

  const indent = depth * 12;

  return (
    <>
      <div
        className={`file-tree-item ${isSelected ? "selected" : ""} ${isDragOver ? "drag-over" : ""}`}
        style={{ paddingLeft: `${indent + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragLeave={() => setDragOverFileId(null)}
      >
        {node.type === "directory" ? (
          <>
            <span className="shrink-0 text-muted-foreground">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            {isExpanded ? (
              <FolderOpen size={14} className="shrink-0 text-yellow-400" />
            ) : (
              <Folder size={14} className="shrink-0 text-yellow-400" />
            )}
          </>
        ) : (
          <>
            <span className="w-[14px] shrink-0" />
            <FileIcon name={node.name} />
          </>
        )}

        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") setRenamingFileId(null);
            }}
            className="flex-1 bg-input text-foreground text-xs font-mono px-1 rounded outline-none border border-primary"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate text-xs font-mono text-foreground">{node.name}</span>
        )}

        {/* Git status indicator */}
        {node.gitStatus === "modified" && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />}
        {node.gitStatus === "untracked" && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
      </div>

      {/* Children */}
      {node.type === "directory" && isExpanded && node.children?.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} workspaceId={workspaceId} />
      ))}
    </>
  );
}

// ── FileTree root ─────────────────────────────────────────────────────────────
export function FileTree({ workspaceId }: FileTreeProps) {
  const [, setFileTree] = useAtom(fileTreeAtom);
  const [contextMenu, setContextMenu] = useAtom(contextMenuAtom);
  const createFileMutation = trpc.files.create.useMutation();
  const utils = trpc.useUtils();

  const { data: files, isLoading } = trpc.files.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  useEffect(() => {
    if (files) setFileTree(files as FileNode[]);
  }, [files, setFileTree]);

  const handleNewFile = async () => {
    if (!workspaceId) return;
    await createFileMutation.mutateAsync({ workspaceId, parentId: null, name: "untitled.ts", type: "file" });
    utils.files.list.invalidate();
  };

  const rootFiles = (files as FileNode[] | undefined)?.filter((f) => !f.parentId) ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border">
        <span className="text-[11px] font-mono text-muted-foreground truncate">
          {workspaceId ? "WORKSPACE" : "No workspace"}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewFile}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
            title="New File"
          >
            <FilePlus size={13} />
          </button>
          <button
            onClick={() => utils.files.list.invalidate()}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="px-4 py-3 text-xs text-muted-foreground font-mono">Loading…</div>
        ) : rootFiles.length === 0 ? (
          <div className="px-4 py-3 text-xs text-muted-foreground font-mono">
            No files yet. Click + to create one.
          </div>
        ) : (
          rootFiles.map((node) => (
            <TreeNode key={node.id} node={node} depth={0} workspaceId={workspaceId} />
          ))
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          fileId={contextMenu.fileId}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}

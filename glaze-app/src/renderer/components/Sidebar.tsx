import { useState, useRef, useCallback } from "react";
import { useSidebarStore } from "../stores/sidebarStore";

interface WorkspaceRow {
  id: string;
  name: string;
  panelCount: number;
}

interface SidebarProps {
  workspaces: WorkspaceRow[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onNewWorkspace: () => void;
  onRemoveWorkspace: (id: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onReorderWorkspaces: (fromIndex: number, toIndex: number) => void;
}

export function Sidebar({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onNewWorkspace,
  onRemoveWorkspace,
  onRenameWorkspace,
  onReorderWorkspaces,
}: SidebarProps) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback((id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
    setTimeout(() => inputRef.current?.focus(), 10);
  }, []);

  const commitRename = useCallback(
    (id: string) => {
      if (editName.trim()) {
        onRenameWorkspace(id, editName.trim());
      }
      setEditingId(null);
      setEditName("");
    },
    [editName, onRenameWorkspace],
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverIndex(index);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      setDragIndex(null);
      setDragOverIndex(null);
      if (dragIndex !== null && dragIndex !== toIndex) {
        onReorderWorkspaces(dragIndex, toIndex);
      }
    },
    [dragIndex, onReorderWorkspaces],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  return (
    <aside
      className="h-full flex flex-col shrink-0 transition-all duration-200"
      style={{
        width: collapsed ? 40 : 220,
        backgroundColor: "var(--color-sidebar)",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center shrink-0 px-3"
        style={{
          height: 28,
          justifyContent: collapsed ? "center" : "space-between",
        }}
      >
        {!collapsed && (
          <span
            className="text-xs font-semibold tracking-wide select-none"
            style={{ color: "var(--color-text-dim)", fontSize: 10 }}
          >
            WORKSPACES
          </span>
        )}
        <button
          onClick={toggle}
          className="text-xs hover:opacity-70 transition-opacity select-none leading-none"
          style={{ color: "var(--color-text-dim)", fontSize: 10 }}
          title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
        >
          {collapsed ? "+" : "‹"}
        </button>
      </div>

      {/* Workspace rows */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ paddingTop: 2 }}>
        {workspaces.map((ws, index) => {
          const isActive = ws.id === activeWorkspaceId;
          const isHovered = ws.id === hoveredId;
          const isEditing = ws.id === editingId;
          const isDragOver = index === dragOverIndex;

          return (
            <div
              key={ws.id}
              role="button"
              tabIndex={0}
              draggable={!collapsed && !isEditing}
              onClick={() => {
                if (!isEditing) onSelectWorkspace(ws.id);
              }}
              onDoubleClick={() => {
                if (!collapsed) startRename(ws.id, ws.name);
              }}
              onMouseEnter={() => setHoveredId(ws.id)}
              onMouseLeave={() => setHoveredId(null)}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className="cursor-pointer select-none transition-colors mx-1 rounded"
              style={{
                backgroundColor: isActive
                  ? "var(--color-selected)"
                  : isHovered
                    ? "var(--color-hover)"
                    : "transparent",
                borderLeft: isActive
                  ? "2px solid var(--color-accent)"
                  : "2px solid transparent",
                borderTop: isDragOver
                  ? "2px solid var(--color-accent)"
                  : "2px solid transparent",
                padding: collapsed ? "8px 0" : "6px 10px",
                marginBottom: 1,
                textAlign: collapsed ? "center" : "left",
                opacity: dragIndex === index ? 0.4 : 1,
              }}
            >
              {collapsed ? (
                <span
                  className="text-xs block"
                  title={ws.name}
                  style={{
                    color: isActive ? "var(--color-accent)" : "var(--color-text-dim)",
                  }}
                >
                  {ws.name.charAt(0)}
                </span>
              ) : isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(ws.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(ws.id);
                    if (e.key === "Escape") {
                      setEditingId(null);
                      setEditName("");
                    }
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-transparent outline-none text-xs font-medium"
                  style={{
                    color: "var(--color-text)",
                    borderBottom: "1px solid var(--color-accent)",
                    fontSize: 12,
                  }}
                  maxLength={32}
                />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-xs font-medium truncate"
                      style={{ color: "var(--color-text)", fontSize: 12 }}
                    >
                      {ws.name}
                    </div>
                    {ws.panelCount > 0 && (
                      <div
                        className="text-xs truncate"
                        style={{ color: "var(--color-text-dim)", fontSize: 10 }}
                      >
                        {ws.panelCount} terminal{ws.panelCount !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                  {isHovered && workspaces.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveWorkspace(ws.id);
                      }}
                      className="shrink-0 ml-1 text-xs rounded-full w-4 h-4 flex items-center justify-center"
                      style={{ color: "var(--color-text-dim)" }}
                      title="关闭工作区"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* New workspace */}
        <div
          role="button"
          tabIndex={0}
          onClick={onNewWorkspace}
          className="cursor-pointer select-none transition-colors mx-1 rounded"
          style={{
            padding: collapsed ? "8px 0" : "6px 10px",
            textAlign: collapsed ? "center" : "left",
            color: "var(--color-text-dim)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              "var(--color-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              "transparent";
          }}
        >
          <span className="text-xs" style={{ fontSize: 11 }}>
            {collapsed ? "+" : "+ New Workspace"}
          </span>
        </div>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div
          className="shrink-0 px-3 py-2 text-xs"
          style={{
            borderTop: "1px solid var(--color-border)",
            color: "var(--color-text-dim)",
            fontSize: 10,
          }}
        >
          {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
        </div>
      )}
    </aside>
  );
}

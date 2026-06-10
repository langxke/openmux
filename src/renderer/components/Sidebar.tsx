import { useState, useRef, useCallback, useEffect, forwardRef } from "react";
import { ChevronLeft, HelpCircle, Terminal } from "lucide-react";
import { useSidebarStore } from "../stores/sidebarStore";
import { useRenameInput } from "../hooks/useRenameInput";

interface WorkspaceRow {
  id: string;
  name: string;
  panelCount: number;
}

interface SidebarProps {
  zoom?: number;
  workspaces: WorkspaceRow[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onNewWorkspace: () => void;
  onRemoveWorkspace: (id: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onReorderWorkspaces: (fromIndex: number, toIndex: number) => void;
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(function Sidebar({
  zoom = 1,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onNewWorkspace,
  onRemoveWorkspace,
  onRenameWorkspace,
  onReorderWorkspaces,
}, ref) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const sidebarWidth = useSidebarStore((s) => s.width);
  const toggle = useSidebarStore((s) => s.toggle);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const helpBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, vh: 0 });
  const helpTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const isEditing = editingId !== null;

  useRenameInput(inputRef, isEditing);

  const startRename = useCallback((id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
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

  useEffect(() => {
    if (!helpOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [helpOpen]);

  return (
    <aside
      ref={ref}
      className="h-full flex flex-col shrink-0"
      style={{
        width: collapsed ? 40 : sidebarWidth,
        backgroundColor: "var(--color-sidebar)",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: 28,
          paddingLeft: collapsed ? 0 : 12,
          justifyContent: collapsed ? "center" : "flex-start",
          WebkitAppRegion: "drag",
        } as React.CSSProperties}
      >
        {collapsed ? (
          <Terminal size={16} strokeWidth={1.5} style={{ color: "var(--color-accent)" }} />
        ) : (
          <div className="flex items-center gap-2 select-none">
            <Terminal size={16} strokeWidth={1.5} style={{ color: "var(--color-accent)" }} />
            <span className="font-medium" style={{ color: "var(--color-text)", fontSize: 15 }}>
              openmux
            </span>
          </div>
        )}
      </div>

      {/* Workspace rows */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ paddingTop: 2, zoom }}>
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
              className="cursor-pointer select-none transition-colors mx-1"
              style={{
                backgroundColor: isActive
                  ? "var(--color-selected)"
                  : isHovered
                    ? "var(--color-hover)"
                    : "transparent",
                borderTop: isDragOver
                  ? "2px solid var(--color-accent)"
                  : "2px solid transparent",
                padding: collapsed ? "14px 0" : "14px 14px",
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
                    color: isActive ? "#ffffff" : "var(--color-text-dim)",
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
                  className="w-full bg-transparent outline-none text-sm font-medium"
                  style={{
                    color: "#ffffff",
                    borderBottom: "1px solid var(--color-accent)",
                    }}
                  maxLength={32}
                />
              ) : (
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-sm font-medium truncate"
                      style={{ color: isActive ? "#ffffff" : "var(--color-text)" }}
                    >
                      {ws.name}
                    </div>
                    {ws.panelCount > 0 && (
                      <div
                        className="text-xs truncate"
                        style={{ color: isActive ? "rgba(255,255,255,0.7)" : "var(--color-text-dim)" }}
                      >
                        {ws.panelCount} terminal{ws.panelCount !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                  {isHovered && workspaces.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`确定要关闭工作区 "${ws.name}" 吗？`)) {
                          onRemoveWorkspace(ws.id);
                        }
                      }}
                      className="shrink-0 ml-1 rounded-full w-6 h-6 flex items-center justify-center"
                      style={{ color: isActive ? "#fff" : "var(--color-text-dim)", fontSize: 16 }}
                      title="关闭工作区"
                    >
                      ✕
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
          className="cursor-pointer select-none transition-colors mx-1"
          style={{
            padding: collapsed ? "14px 0" : "14px 14px",
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
          <span className="text-sm">
            {collapsed ? "+" : "+ New Workspace"}
          </span>
        </div>
      </div>

      {/* Bottom icon bar */}
      <div
        className="shrink-0 flex items-center"
        style={{
          borderTop: "1px solid var(--color-border)",
          padding: collapsed ? "6px 0" : "6px 8px",
          justifyContent: collapsed ? "center" : "flex-start",
          flexDirection: collapsed ? "column" : "row",
          gap: collapsed ? 4 : 2,
        }}
      >
        <button
          className="flex items-center justify-center rounded transition-colors select-none"
          style={{
            width: 28,
            height: 28,
            color: "var(--color-text-dim)",
          }}
          onClick={toggle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-hover)";
            (e.currentTarget as HTMLElement).style.color = "var(--color-text)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--color-text-dim)";
          }}
          title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
        >
          <ChevronLeft size={16} strokeWidth={1.5} style={{ transform: collapsed ? "rotate(180deg)" : "none" }} />
        </button>
        {!collapsed && (
        <div style={{ position: "relative" }}>
          <button
            ref={helpBtnRef}
            className="flex items-center justify-center rounded transition-colors select-none"
            style={{
              width: 28,
              height: 28,
              color: helpOpen ? "var(--color-text)" : "var(--color-text-dim)",
              backgroundColor: helpOpen ? "var(--color-hover)" : "transparent",
            }}
            onMouseEnter={() => {
              if (helpTimerRef.current) clearTimeout(helpTimerRef.current);
              const rect = helpBtnRef.current?.getBoundingClientRect();
              if (rect) {
                setPopoverPos({
                  top: rect.top,
                  left: rect.left,
                  vh: window.innerHeight,
                });
              }
              setHelpOpen(true);
            }}
            onMouseLeave={() => {
              helpTimerRef.current = setTimeout(() => setHelpOpen(false), 150);
            }}
            title="快捷键帮助"
          >
            <HelpCircle size={16} strokeWidth={1.5} />
          </button>
          {helpOpen && (
            <div
              ref={popoverRef}
              className="rounded-lg"
              style={{
                position: "fixed",
                bottom: popoverPos.vh - popoverPos.top + 8,
                left: popoverPos.left,
                minWidth: 230,
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)",
                zIndex: 100,
                animation: "popover-in 150ms ease-out",
                padding: "12px 20px",
              }}
              onMouseEnter={() => {
                if (helpTimerRef.current) clearTimeout(helpTimerRef.current);
              }}
              onMouseLeave={() => {
                setHelpOpen(false);
              }}
            >
              {/* Arrow pointing down */}
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  bottom: -5,
                  width: 10,
                  height: 10,
                  backgroundColor: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  borderLeft: "none",
                  borderTop: "none",
                  transform: "rotate(45deg)",
                }}
              />
              <div className="py-0.5">
                {[
                  { keys: ["Ctrl", "= / +"], desc: "放大" },
                  { keys: ["Ctrl", "-"], desc: "缩小" },
                  { keys: ["Ctrl", "0"], desc: "重置缩放" },
                  { keys: ["Ctrl", "B"], desc: "折叠侧边栏" },
                  { keys: ["Ctrl", "N"], desc: "新建终端" },
                  { keys: ["Ctrl", "Shift", "N"], desc: "新建工作区" },
                  { keys: [] as string[], desc: "双击标题或 Tab 可改名" },
                ].map((s) => (
                  <div
                    key={s.desc}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span style={{ fontSize: 12, color: s.keys.length > 0 ? "var(--color-text)" : "var(--color-text-dim)" }}>
                      {s.desc}
                    </span>
                    {s.keys.length > 0 && (
                      <span className="flex items-center gap-0.5">
                        {s.keys.map((k, i) => (
                          <span key={k}>
                            <kbd
                              style={{
                                fontSize: 10,
                                fontFamily: "inherit",
                                color: "var(--color-text-secondary)",
                                backgroundColor: "var(--color-hover)",
                                border: "1px solid var(--color-border)",
                                borderRadius: 3,
                                padding: "1px 4px",
                                boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.1)",
                              }}
                            >
                              {k}
                            </kbd>
                            {i < s.keys.length - 1 && (
                              <span style={{ fontSize: 10, color: "var(--color-text-dim)", margin: "0 1px" }}>+</span>
                            )}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </aside>
  );
});

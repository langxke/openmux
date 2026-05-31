import { useState, useCallback, useEffect, useRef } from "react";
import { DockviewLayout } from "./components/DockviewLayout";
import { Sidebar } from "./components/Sidebar";
import { TitleBar } from "./components/TitleBar";
import { CommandPalette } from "./components/CommandPalette";
import { useSidebarStore } from "./stores/sidebarStore";
import { useConfigStore } from "./stores/configStore";
import { useZoomStore } from "./stores/zoomStore";
import type { CustomCommand } from "./lib/types";

const EMPTY_COMMANDS: CustomCommand[] = [];

interface WorkspaceEntry {
  id: string;
  name: string;
  panelCount: number;
}

let nextWorkspaceNum = 1;

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteKey, setPaletteKey] = useState(0);

  const [workspaceIds, setWorkspaceIds] = useState<string[]>(() => {
    const id = `ws-${nextWorkspaceNum++}`;
    return [id];
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(workspaceIds[0]);
  const [workspaceMeta, setWorkspaceMeta] = useState<Map<string, WorkspaceEntry>>(() => {
    const m = new Map<string, WorkspaceEntry>();
    m.set(workspaceIds[0], { id: workspaceIds[0], name: `Workspace 1`, panelCount: 0 });
    return m;
  });

  const addTerminalRefs = useRef<Map<string, () => void>>(new Map());
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const configLoaded = useConfigStore((s) => s.loaded);
  const customCommands = useConfigStore(
    (s) => s.config?.customCommands ?? EMPTY_COMMANDS,
  );
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!hasLoaded.current && !configLoaded) {
      hasLoaded.current = true;
      useConfigStore.getState().load();
    }
  }, [configLoaded]);

  const workspaceList = workspaceIds.map((id) => {
    const meta = workspaceMeta.get(id);
    return {
      id,
      name: meta?.name ?? "Workspace",
      panelCount: meta?.panelCount ?? 0,
    };
  });

  const handleStateChange = useCallback(
    (wsId: string, state: { panels: { id: string; title: string; shell: string }[] }) => {
      setWorkspaceMeta((prev) => {
        const next = new Map(prev);
        const existing = next.get(wsId);
        if (existing) {
          next.set(wsId, { ...existing, panelCount: state.panels.length });
        }
        return next;
      });
    },
    [],
  );

  const handleDockviewReady = useCallback(
    (wsId: string, addTerminal: () => void) => {
      addTerminalRefs.current.set(wsId, addTerminal);
    },
    [],
  );

  const createWorkspace = useCallback(() => {
    const n = nextWorkspaceNum++;
    const newId = `ws-${n}`;
    setWorkspaceIds((prev) => [...prev, newId]);
    setWorkspaceMeta((prev) => {
      const next = new Map(prev);
      next.set(newId, { id: newId, name: `Workspace ${n}`, panelCount: 0 });
      return next;
    });
    setActiveWorkspaceId(newId);
  }, []);

  const removeWorkspace = useCallback((wsId: string) => {
    addTerminalRefs.current.delete(wsId);
    setWorkspaceIds((prev) => {
      const next = prev.filter((id) => id !== wsId);
      if (next.length === 0) {
        const n = nextWorkspaceNum++;
        const fallback = `ws-${n}`;
        setWorkspaceMeta((map) => {
          const m2 = new Map(map);
          m2.set(fallback, { id: fallback, name: `Workspace ${n}`, panelCount: 0 });
          return m2;
        });
        setActiveWorkspaceId(fallback);
        return [fallback];
      }
      return next;
    });
    setWorkspaceMeta((prev) => {
      const next = new Map(prev);
      next.delete(wsId);
      return next;
    });
    setActiveWorkspaceId((prev) => {
      if (prev !== wsId) return prev;
      const currentIds = workspaceIds;
      return currentIds.find((id) => id !== wsId) ?? "";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renameWorkspace = useCallback((wsId: string, name: string) => {
    setWorkspaceMeta((prev) => {
      const next = new Map(prev);
      const existing = next.get(wsId);
      if (existing) {
        next.set(wsId, { ...existing, name: name.trim() || existing.name });
      }
      return next;
    });
  }, []);

  const reorderWorkspaces = useCallback((fromIndex: number, toIndex: number) => {
    setWorkspaceIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = useSidebarStore.getState().width;

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      useSidebarStore.getState().setWidth(startWidth + delta);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "p") {
        e.preventDefault();
        setPaletteKey((k) => k + 1);
        setPaletteOpen(true);
      } else if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      } else if (e.ctrlKey && e.shiftKey && e.key === "N") {
        e.preventDefault();
        createWorkspace();
      } else if (e.ctrlKey && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        useZoomStore.getState().zoomIn();
      } else if (e.ctrlKey && e.key === "-") {
        e.preventDefault();
        useZoomStore.getState().zoomOut();
      } else if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        useZoomStore.getState().zoomReset();
      }
    },
    [toggleSidebar, createWorkspace],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-full w-full flex flex-col">
      <TitleBar />
      <div className="flex-1 flex min-h-0">
        <Sidebar
          workspaces={workspaceList}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={setActiveWorkspaceId}
          onNewWorkspace={createWorkspace}
          onRemoveWorkspace={removeWorkspace}
          onRenameWorkspace={renameWorkspace}
          onReorderWorkspaces={reorderWorkspaces}
        />
        {!sidebarCollapsed && (
          <div
            className="shrink-0 cursor-col-resize transition-colors duration-150"
            style={{
              width: 4,
              backgroundColor: "var(--color-border)",
            }}
            onMouseDown={handleResizeStart}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "var(--color-accent)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "var(--color-border)";
            }}
          />
        )}
        <main className="flex-1 min-w-0" style={{ position: "relative" }}>
          {workspaceIds.map((wsId) => (
            <DockviewLayout
              key={wsId}
              workspaceId={wsId}
              visible={wsId === activeWorkspaceId}
              onStateChange={(state) => handleStateChange(wsId, state)}
              onReady={(addTerminal) => handleDockviewReady(wsId, addTerminal)}
            />
          ))}
        </main>
        <CommandPalette
          key={paletteKey}
          isOpen={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          commands={customCommands}
        />
      </div>
    </div>
  );
}

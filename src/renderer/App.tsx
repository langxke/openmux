import { useState, useCallback, useEffect, useRef } from "react";
import { DockviewLayout } from "./components/DockviewLayout";
import { Sidebar } from "./components/Sidebar";
import { TitleBar } from "./components/TitleBar";
import { CommandPalette } from "./components/CommandPalette";
import { useSidebarStore } from "./stores/sidebarStore";
import { useConfigStore } from "./stores/configStore";
import { useZoomStore } from "./stores/zoomStore";
import { om } from "./lib/openmux-api";
import type { CustomCommand } from "./lib/types";
import type { DockviewApi, SerializedDockview } from "dockview";

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
  const uiZoom = useZoomStore((s) => s.uiZoom);
  const customCommands = useConfigStore(
    (s) => s.config?.customCommands ?? EMPTY_COMMANDS,
  );
  const hasLoaded = useRef(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const dockviewApis = useRef<Map<string, DockviewApi>>(new Map());
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);
  const savedLayoutsRef = useRef<Map<string, SerializedDockview>>(new Map());
  const isRestoringRef = useRef(true);

  useEffect(() => {
    if (!hasLoaded.current && !configLoaded) {
      hasLoaded.current = true;
      useConfigStore.getState().load();
    }
  }, [configLoaded]);

  // Persist when zoom changes
  const sessionSizes = useZoomStore((s) => s.sessionSizes);
  useEffect(() => {
    persistWorkspace();
  }, [uiZoom, sessionSizes]);

  // --- Workspace persistence ---

  const workspaceIdsRef = useRef(workspaceIds);
  workspaceIdsRef.current = workspaceIds;
  const workspaceMetaRef = useRef(workspaceMeta);
  workspaceMetaRef.current = workspaceMeta;
  const activeRef = useRef(activeWorkspaceId);
  activeRef.current = activeWorkspaceId;

  const persistWorkspace = useCallback(() => {
    if (isRestoringRef.current) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      const apis = dockviewApis.current;
      const data = {
        sidebar: {
          width: useSidebarStore.getState().width,
          collapsed: useSidebarStore.getState().collapsed,
        },
        workspaces: workspaceIdsRef.current.map((id) => {
          const meta = workspaceMetaRef.current.get(id);
          const api = apis.get(id);
          return {
            id,
            name: meta?.name ?? "Workspace",
            layout: api ? api.toJSON() : null,
          };
        }),
        activeWorkspaceId: activeRef.current,
        sessionSizes: useZoomStore.getState().sessionSizes,
        uiZoom: useZoomStore.getState().uiZoom,
      };
      om().workspace.save(data);
    }, 500);
  }, []);

  // Restore on first mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    om().workspace.load().then((saved: any) => {
      if (saved?.workspaces?.length) {
        // Restore sidebar
        if (saved.sidebar) {
          useSidebarStore.getState().setWidth(saved.sidebar.width ?? 220);
          if (saved.sidebar.collapsed) {
            useSidebarStore.getState().setCollapsed(true);
          }
        }

        // Restore session font sizes
        if (saved.sessionSizes) {
          useZoomStore.setState({ sessionSizes: saved.sessionSizes });
        }

        // Restore UI zoom
        if (saved.uiZoom) {
          useZoomStore.setState({ uiZoom: saved.uiZoom });
        }

        // Restore workspaces
        const restoredIds: string[] = [];
        const restoredMeta = new Map<string, WorkspaceEntry>();
        const layouts = new Map<string, SerializedDockview>();
        for (const ws of saved.workspaces) {
          const id = ws.id || `ws-${nextWorkspaceNum++}`;
          restoredIds.push(id);
          restoredMeta.set(id, {
            id,
            name: ws.name || "Workspace",
            panelCount: 0,
          });
          if (ws.layout) layouts.set(id, ws.layout as SerializedDockview);
        }

        if (restoredIds.length > 0) {
          savedLayoutsRef.current = layouts;
          setWorkspaceIds(restoredIds);
          setWorkspaceMeta(restoredMeta);
          if (saved.activeWorkspaceId && restoredIds.includes(saved.activeWorkspaceId)) {
            setActiveWorkspaceId(saved.activeWorkspaceId);
          }
          // Sync counter to avoid duplicate IDs
          let maxNum = 1;
          for (const wid of restoredIds) {
            const m = wid.match(/^ws-(\d+)$/);
            if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10) + 1);
          }
          nextWorkspaceNum = maxNum;
        }
      }
      isRestoringRef.current = false;
    });
  }, []);

  const workspaceList = workspaceIds.map((id) => {
    const meta = workspaceMeta.get(id);
    return {
      id,
      name: meta?.name ?? "Workspace",
      panelCount: meta?.panelCount ?? 0,
    };
  });

  const handleSelectWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    const api = dockviewApis.current.get(id);
    if (api) {
      const activePanel = api.activePanel;
      const sid = activePanel?.params?.sessionId as string | undefined;
      useZoomStore.getState().setActiveSession(sid ?? null);
    }
  }, []);

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
      persistWorkspace();
    },
    [persistWorkspace],
  );

  const handleDockviewReady = useCallback(
    (wsId: string, addTerminal: () => void) => {
      addTerminalRefs.current.set(wsId, addTerminal);
    },
    [],
  );

  const handleApiReady = useCallback((wsId: string, api: DockviewApi) => {
    dockviewApis.current.set(wsId, api);
  }, []);

  const handleLayoutChange = useCallback(() => {
    persistWorkspace();
  }, [persistWorkspace]);

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
    persistWorkspace();
  }, [persistWorkspace]);

  const removeWorkspace = useCallback((wsId: string) => {
    addTerminalRefs.current.delete(wsId);
    dockviewApis.current.delete(wsId);
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
    persistWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistWorkspace]);

  const renameWorkspace = useCallback((wsId: string, name: string) => {
    setWorkspaceMeta((prev) => {
      const next = new Map(prev);
      const existing = next.get(wsId);
      if (existing) {
        next.set(wsId, { ...existing, name: name.trim() || existing.name });
      }
      return next;
    });
    persistWorkspace();
  }, [persistWorkspace]);

  const reorderWorkspaces = useCallback((fromIndex: number, toIndex: number) => {
    setWorkspaceIds((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    persistWorkspace();
  }, [persistWorkspace]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = useSidebarStore.getState().width;
    const el = sidebarRef.current;

    useSidebarStore.getState().setIsResizing(true);

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const w = Math.min(480, Math.max(120, Math.round(startWidth + delta)));
      if (el) {
        el.style.width = `${w}px`;
      }
    };

    const handleMouseUp = () => {
      const finalWidth = el ? parseInt(el.style.width, 10) : startWidth;
      useSidebarStore.getState().setWidth(finalWidth || startWidth);
      useSidebarStore.getState().setIsResizing(false);
      persistWorkspace();
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [persistWorkspace]);

  const isTerminalFocused = () => {
    const el = document.activeElement;
    return !!(el && el.closest(".xterm"));
  };

  const isInBrowserPanel = () => {
    const el = document.activeElement;
    return !!(el && (el.closest("webview") || el.closest("[data-browser-panel]")));
  };

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
        if (isTerminalFocused()) {
          useZoomStore.getState().zoomTerminalIn();
        } else if (!isInBrowserPanel()) {
          useZoomStore.getState().zoomIn();
        }
      } else if (e.ctrlKey && e.key === "-") {
        e.preventDefault();
        if (isTerminalFocused()) {
          useZoomStore.getState().zoomTerminalOut();
        } else if (!isInBrowserPanel()) {
          useZoomStore.getState().zoomOut();
        }
      } else if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        if (isTerminalFocused()) {
          useZoomStore.getState().zoomTerminalReset();
        } else if (!isInBrowserPanel()) {
          useZoomStore.getState().zoomReset();
        }
      }
    },
    [toggleSidebar, createWorkspace],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-full w-full flex">
      <Sidebar
        ref={sidebarRef}
        zoom={uiZoom}
        workspaces={workspaceList}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={handleSelectWorkspace}
        onNewWorkspace={createWorkspace}
        onRemoveWorkspace={removeWorkspace}
        onRenameWorkspace={renameWorkspace}
        onReorderWorkspaces={reorderWorkspaces}
      />
      {!sidebarCollapsed && (
        <div
          className="shrink-0 cursor-col-resize flex justify-center"
          style={{
            width: 6,
            marginLeft: -3,
            zIndex: 10,
          }}
          onMouseDown={handleResizeStart}
          onMouseEnter={(e) => {
            const bar = e.currentTarget.firstChild as HTMLElement;
            if (bar) bar.style.backgroundColor = "var(--color-accent)";
          }}
          onMouseLeave={(e) => {
            const bar = e.currentTarget.firstChild as HTMLElement;
            if (bar) bar.style.backgroundColor = "transparent";
          }}
        >
          <div
            className="transition-colors duration-150"
            style={{ width: 1, height: "100%", backgroundColor: "transparent" }}
          />
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <TitleBar />
        <main className="flex-1 min-h-0" style={{ position: "relative" }}>
          {workspaceIds.map((wsId) => (
            <DockviewLayout
              key={wsId}
              workspaceId={wsId}
              visible={wsId === activeWorkspaceId}
              initialLayout={savedLayoutsRef.current.get(wsId)}
              onStateChange={(state) => handleStateChange(wsId, state)}
              onReady={(addTerminal) => handleDockviewReady(wsId, addTerminal)}
              onApiReady={(api) => handleApiReady(wsId, api)}
              onLayoutChange={handleLayoutChange}
            />
          ))}
        </main>
      </div>
      <CommandPalette
        key={paletteKey}
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={customCommands}
      />
    </div>
  );
}

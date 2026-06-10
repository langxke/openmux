import { useState, useCallback, useRef } from "react";
import { useOpenMux, type OpenMuxAPI } from "./useOpenMux";
import { useSidebarStore } from "../stores/sidebarStore";
import { useZoomStore } from "../stores/zoomStore";
import type { DockviewApi, SerializedDockview } from "dockview";

export interface WorkspaceEntry {
  id: string;
  name: string;
  panelCount: number;
}

interface WorkspaceRow {
  id: string;
  name: string;
  panelCount: number;
}

let nextWorkspaceNum = 1;

export function useWorkspaces() {
  const om = useOpenMux();

  const [workspaceIds, setWorkspaceIds] = useState<string[]>(() => {
    const id = `ws-${nextWorkspaceNum++}`;
    return [id];
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(workspaceIds[0]);
  const [workspaceMeta, setWorkspaceMeta] = useState<Map<string, WorkspaceEntry>>(() => {
    const m = new Map<string, WorkspaceEntry>();
    m.set(workspaceIds[0], { id: workspaceIds[0], name: "New Workspace", panelCount: 0 });
    return m;
  });

  const addTerminalRefs = useRef<Map<string, () => void>>(new Map());
  const dockviewApis = useRef<Map<string, DockviewApi>>(new Map());
  const savedLayoutsRef = useRef<Map<string, SerializedDockview>>(new Map());
  const isRestoringRef = useRef(true);

  // --- Persistence ---

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceIdsRef = useRef(workspaceIds);
  const workspaceMetaRef = useRef(workspaceMeta);
  const activeRef = useRef(activeWorkspaceId);

  // Sync refs to latest values (matching original App.tsx pattern)
  // eslint-disable-next-line react-hooks/refs
  workspaceIdsRef.current = workspaceIds;
  // eslint-disable-next-line react-hooks/refs
  workspaceMetaRef.current = workspaceMeta;
  // eslint-disable-next-line react-hooks/refs
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
      om.workspace.save(data);
    }, 500);
  }, [om.workspace]);

  // --- Restore ---

  const restoredRef = useRef(false);
  const restoreWorkspace = useCallback(
    (api: OpenMuxAPI) => {
      if (restoredRef.current) return;
      restoredRef.current = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      api.workspace.load().then((saved: any) => {
        if (saved?.workspaces?.length) {
          if (saved.sidebar) {
            useSidebarStore.getState().setWidth(saved.sidebar.width ?? 220);
            if (saved.sidebar.collapsed) {
              useSidebarStore.getState().setCollapsed(true);
            }
          }
          if (saved.sessionSizes) {
            useZoomStore.setState({ sessionSizes: saved.sessionSizes });
          }
          if (saved.uiZoom) {
            useZoomStore.setState({ uiZoom: saved.uiZoom });
          }

          const restoredIds: string[] = [];
          const restoredMeta = new Map<string, WorkspaceEntry>();
          const layouts = new Map<string, SerializedDockview>();
          for (const ws of saved.workspaces) {
            const id = ws.id || `ws-${nextWorkspaceNum++}`;
            restoredIds.push(id);
            restoredMeta.set(id, { id, name: ws.name || "Workspace", panelCount: 0 });
            if (ws.layout) layouts.set(id, ws.layout as SerializedDockview);
          }

          if (restoredIds.length > 0) {
            savedLayoutsRef.current = layouts;
            setWorkspaceIds(restoredIds);
            setWorkspaceMeta(restoredMeta);
            if (saved.activeWorkspaceId && restoredIds.includes(saved.activeWorkspaceId)) {
              setActiveWorkspaceId(saved.activeWorkspaceId);
            }
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
    },
    [],
  );

  // --- Mutations ---

  const workspaceList: WorkspaceRow[] = workspaceIds.map((id) => {
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
    (wsId: string, state: { panels: { id: string; title: string; shell: string; sessionId?: string }[] }) => {
      setWorkspaceMeta((prev) => {
        const next = new Map(prev);
        const existing = next.get(wsId);
        if (existing) {
          next.set(wsId, { ...existing, panelCount: state.panels.filter((p) => p.sessionId).length });
        }
        return next;
      });
      persistWorkspace();
    },
    [persistWorkspace],
  );

  const handleDockviewReady = useCallback((wsId: string, addTerminal: () => void) => {
    addTerminalRefs.current.set(wsId, addTerminal);
  }, []);

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
      next.set(newId, { id: newId, name: "New Workspace", panelCount: 0 });
      return next;
    });
    setActiveWorkspaceId(newId);
    persistWorkspace();
  }, [persistWorkspace]);

  const removeWorkspace = useCallback(
    (wsId: string) => {
      addTerminalRefs.current.delete(wsId);
      dockviewApis.current.delete(wsId);
      setWorkspaceIds((prev) => {
        const next = prev.filter((id) => id !== wsId);
        if (next.length === 0) {
          const n = nextWorkspaceNum++;
          const fallback = `ws-${n}`;
          setWorkspaceMeta((map) => {
            const m2 = new Map(map);
            m2.set(fallback, { id: fallback, name: "New Workspace", panelCount: 0 });
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
        const currentIds = workspaceIdsRef.current;
        return currentIds.find((id) => id !== wsId) ?? "";
      });
      persistWorkspace();
    },
    [persistWorkspace],
  );

  const renameWorkspace = useCallback(
    (wsId: string, name: string) => {
      setWorkspaceMeta((prev) => {
        const next = new Map(prev);
        const existing = next.get(wsId);
        if (existing) {
          next.set(wsId, { ...existing, name: name.trim() || existing.name });
        }
        return next;
      });
      persistWorkspace();
    },
    [persistWorkspace],
  );

  const reorderWorkspaces = useCallback(
    (fromIndex: number, toIndex: number) => {
      setWorkspaceIds((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
      persistWorkspace();
    },
    [persistWorkspace],
  );

  return {
    workspaceIds,
    activeWorkspaceId,
    workspaceList,
    savedLayouts: savedLayoutsRef,
    restoreWorkspace,
    handleSelectWorkspace,
    handleStateChange,
    handleDockviewReady,
    handleApiReady,
    handleLayoutChange,
    createWorkspace,
    removeWorkspace,
    renameWorkspace,
    reorderWorkspaces,
  };
}

import { useEffect, useRef } from "react";
import { useConfigStore } from "./stores/configStore";
import { useSidebarStore } from "./stores/sidebarStore";
import { useZoomStore } from "./stores/zoomStore";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useOpenMux } from "./hooks/useOpenMux";
import { DockviewLayout } from "./components/DockviewLayout";
import { Sidebar } from "./components/Sidebar";
import { TitleBar } from "./components/TitleBar";

export default function App() {
  const om = useOpenMux();
  const configLoaded = useConfigStore((s) => s.loaded);
  const uiZoom = useZoomStore((s) => s.uiZoom);
  const sidebarCollapsed = useSidebarStore((s) => s.collapsed);
  const sidebarRef = useRef<HTMLElement>(null);

  // Config bootstrap
  const hasLoaded = useRef(false);
  useEffect(() => {
    if (!hasLoaded.current && !configLoaded) {
      hasLoaded.current = true;
      useConfigStore.getState().load(om);
    }
  }, [configLoaded, om]);

  // Workspaces
  const {
    workspaceIds,
    activeWorkspaceId,
    workspaceList,
    savedLayouts,
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
  } = useWorkspaces();

  // Keyboard shortcuts
  useKeyboardShortcuts({ createWorkspace });

  // Sidebar resize
  const { handleResizeStart } = useSidebarResize({
    sidebarRef,
    onPersist: handleLayoutChange,
  });

  // Persist when zoom changes
  const sessionSizes = useZoomStore((s) => s.sessionSizes);
  useEffect(() => {
    handleLayoutChange();
  }, [uiZoom, sessionSizes, handleLayoutChange]);

  // Restore on first mount
  useEffect(() => {
    restoreWorkspace(om);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              initialLayout={savedLayouts.current.get(wsId)}
              onStateChange={(state) => handleStateChange(wsId, state)}
              onReady={(addTerminal) => handleDockviewReady(wsId, addTerminal)}
              onApiReady={(api) => handleApiReady(wsId, api)}
              onLayoutChange={handleLayoutChange}
            />
          ))}
        </main>
      </div>
    </div>
  );
}

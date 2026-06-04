import { useCallback, useEffect, useRef } from "react";
import {
  DockviewReact,
  themeLight,
  type IWatermarkPanelProps,
  type DockviewApi,
  type SerializedDockview,
} from "dockview";
import "dockview/dist/styles/dockview.css";
import { TerminalPanel } from "./TerminalPanel";
import { BrowserPanel } from "./BrowserPanel";
import { HeaderActions } from "./HeaderActions";
import { om } from "../lib/openmux-api";
import { createTerminalId } from "../lib/terminalId";
import { useZoomStore } from "../stores/zoomStore";

function DefaultWatermark(_props: IWatermarkPanelProps) {
  return (
    <div
      className="flex items-center justify-center h-full select-none text-sm"
      style={{ color: "var(--color-text-dim)" }}
    >
      <span>Ctrl+N 新建终端</span>
    </div>
  );
}

const panelComponents = {
  terminal: (props: {
    params: { sessionId: string; shell?: "powershell" | "cmd"; cwd?: string };
    api: import("dockview").DockviewPanelApi;
  }) => (
    <TerminalPanel
      sessionId={props.params.sessionId}
      shell={props.params.shell ?? "powershell"}
      cwd={props.params.cwd ?? "."}
      api={props.api}
    />
  ),
  browser: (props: {
    params: { initialUrl?: string };
    api: import("dockview").DockviewPanelApi;
    containerApi: import("dockview").DockviewApi;
  }) => <BrowserPanel params={props.params} api={props.api} />,
};

interface DockviewLayoutState {
  panels: { id: string; title: string; shell: string }[];
}

interface DockviewLayoutProps {
  workspaceId: string;
  visible: boolean;
  initialLayout?: SerializedDockview;
  onStateChange: (state: DockviewLayoutState) => void;
  onReady: (addTerminal: () => void) => void;
  onApiReady?: (api: DockviewApi) => void;
  onLayoutChange?: () => void;
}

export function DockviewLayout({
  workspaceId: _workspaceId,
  visible,
  initialLayout,
  onStateChange,
  onReady,
  onApiReady,
  onLayoutChange,
}: DockviewLayoutProps) {
  const apiRef = useRef<DockviewApi | null>(null);
  const initialSidRef = useRef<string | null>(null);

  const syncUp = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    const panels = api.panels.map((p) => ({
      id: (p.params?.sessionId as string) ?? p.id,
      title: (p.title as string) || "Terminal",
      shell: (p.params?.shell as string) || "powershell",
    }));
    onStateChange({ panels });
  }, [onStateChange]);

  const addTerminal = useCallback(
    (shell: "powershell" | "cmd" = "powershell") => {
      const api = apiRef.current;
      if (!api) return;
      const sessionId = createTerminalId();
      api.addPanel({
        id: `panel-${sessionId}`,
        component: "terminal",
        title: shell === "cmd" ? "CMD" : "PowerShell",
        params: { sessionId, shell },
      });
      setTimeout(syncUp, 50);
    },
    [syncUp],
  );

  const handleReady = useCallback(
    (event: { api: DockviewApi }) => {
      apiRef.current = event.api;
      onApiReady?.(event.api);

      event.api.onDidRemovePanel((panel) => {
        const sid = panel.params?.sessionId as string | undefined;
        if (sid) {
          om().pty.kill(sid);
          useZoomStore.getState().removeSession(sid);
        }
        setTimeout(syncUp, 50);
      });

      event.api.onDidActivePanelChange((panel) => {
        const sid = panel?.params?.sessionId as string | undefined;
        useZoomStore.getState().setActiveSession(sid ?? null);
        setTimeout(syncUp, 50);
      });

      event.api.onDidLayoutChange(() => {
        onLayoutChange?.();
      });

      event.api.onWillShowOverlay((e) => {
        if (e.kind === "tab") {
          e.preventDefault();
        }
      });

      if (initialLayout) {
        event.api.fromJSON(initialLayout);
      } else {
        if (!initialSidRef.current) {
          initialSidRef.current = createTerminalId();
        }
        const sid = initialSidRef.current;

        event.api.addPanel({
          id: `panel-${sid}`,
          component: "terminal",
          title: "PowerShell",
          params: { sessionId: sid, shell: "powershell" },
        });
      }

      setTimeout(syncUp, 50);
      onReady(() => addTerminal());
    },
    [addTerminal, syncUp, onReady, initialLayout, onApiReady, onLayoutChange],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!visible) return;
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        addTerminal();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, addTerminal]);

  const dockviewRef = useRef<HTMLDivElement>(null);
  const addTerminalRef = useRef(addTerminal);
  /* eslint-disable react-hooks/refs */
  addTerminalRef.current = addTerminal;
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    const el = dockviewRef.current;
    if (!el) return;
    const onDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const inTabBar = target.closest(".dv-tabs-and-actions-container");
      const onTab = target.closest(".dv-tab");
      if (inTabBar && !onTab) {
        e.preventDefault();
        e.stopPropagation();
        addTerminalRef.current();
      }
    };
    el.addEventListener("dblclick", onDblClick, true);
    return () => el.removeEventListener("dblclick", onDblClick, true);
  }, []);

  return (
    <div
      className="h-full w-full"
      style={{
        visibility: visible ? "visible" : "hidden",
        pointerEvents: visible ? "auto" : "none",
        zIndex: visible ? 0 : -1,
        backgroundColor: "var(--color-bg)",
        position: "absolute",
        inset: 0,
      }}
    >
      <DockviewReact
        ref={dockviewRef}
        components={panelComponents}
        watermarkComponent={DefaultWatermark}
        rightHeaderActionsComponent={HeaderActions}
        theme={themeLight}
        disableTabsOverflowList={true}
        defaultRenderer="always"
        onReady={handleReady}
        className="h-full w-full"
      />
    </div>
  );
}

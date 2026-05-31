import { useCallback, useEffect, useRef } from "react";
import {
  DockviewReact,
  type IWatermarkPanelProps,
  type DockviewApi,
} from "dockview";
import "dockview/dist/styles/dockview.css";
import { TerminalPanel } from "./TerminalPanel";
import { BrowserPanel } from "./BrowserPanel";
import { HeaderActions } from "./HeaderActions";
import { glaze } from "../lib/glaze-api";
import { createTerminalId } from "../lib/terminalId";

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
  }) => (
    <TerminalPanel
      sessionId={props.params.sessionId}
      shell={props.params.shell ?? "powershell"}
      cwd={props.params.cwd ?? "."}
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
  onStateChange: (state: DockviewLayoutState) => void;
  onReady: (addTerminal: () => void) => void;
}

export function DockviewLayout({
  workspaceId: _workspaceId,
  visible,
  onStateChange,
  onReady,
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

      event.api.onDidRemovePanel((panel) => {
        const sid = panel.params?.sessionId as string | undefined;
        if (sid) glaze().pty.kill(sid);
        setTimeout(syncUp, 50);
      });

      event.api.onDidActivePanelChange(() => {
        setTimeout(syncUp, 50);
      });

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

      setTimeout(syncUp, 50);
      onReady(() => addTerminal());
    },
    [addTerminal, syncUp, onReady],
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
        components={panelComponents}
        watermarkComponent={DefaultWatermark}
        rightHeaderActionsComponent={HeaderActions}
        onReady={handleReady}
        className="h-full w-full"
      />
    </div>
  );
}

import { useCallback } from "react";
import type { IDockviewHeaderActionsProps } from "dockview";
import { Terminal, Globe } from "lucide-react";
import { createTerminalId } from "../lib/terminalId";

export function HeaderActions({ containerApi, api }: IDockviewHeaderActionsProps) {
  const addTerminal = useCallback(() => {
    const sessionId = createTerminalId();
    containerApi.addPanel({
      id: `panel-${sessionId}`,
      component: "terminal",
      title: "PowerShell",
      params: { sessionId, shell: "powershell" },
      position: { referenceGroup: api.id },
    });
  }, [containerApi, api]);

  const addBrowser = useCallback(() => {
    const browserId = `browser-${Date.now()}`;
    containerApi.addPanel({
      id: `panel-${browserId}`,
      component: "browser",
      title: "Browser",
      params: {},
      position: { referenceGroup: api.id },
    });
  }, [containerApi, api]);

  return (
    <div className="flex items-center gap-0.5 h-full">
      <button
        onClick={addTerminal}
        className="flex items-center justify-center w-4 h-4 rounded cursor-pointer hover:bg-black/10"
        title="新建终端"
        aria-label="新建终端"
      >
        <Terminal size={10} strokeWidth={2} />
      </button>
      <button
        onClick={addBrowser}
        className="flex items-center justify-center w-4 h-4 rounded cursor-pointer hover:bg-black/10"
        title="新建浏览器"
        aria-label="新建浏览器"
      >
        <Globe size={10} strokeWidth={2} />
      </button>
    </div>
  );
}

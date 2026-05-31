import { useCallback } from "react";
import type { IDockviewHeaderActionsProps } from "dockview";
import { createTerminalId } from "../lib/terminalId";

export function HeaderActions({ containerApi }: IDockviewHeaderActionsProps) {
  const addTerminal = useCallback(() => {
    const sessionId = createTerminalId();
    containerApi.addPanel({
      id: `panel-${sessionId}`,
      component: "terminal",
      title: "PowerShell",
      params: { sessionId, shell: "powershell" },
    });
  }, [containerApi]);

  const addBrowser = useCallback(() => {
    const browserId = `browser-${Date.now()}`;
    containerApi.addPanel({
      id: `panel-${browserId}`,
      component: "browser",
      title: "Browser",
      params: {},
    });
  }, [containerApi]);

  return (
    <div className="flex items-center gap-0.5 h-full">
      <button
        onClick={addTerminal}
        className="flex items-center justify-center w-4 h-4 rounded cursor-pointer hover:bg-black/10"
        title="新建终端"
        aria-label="新建终端"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      </button>
      <button
        onClick={addBrowser}
        className="flex items-center justify-center w-4 h-4 rounded cursor-pointer hover:bg-black/10"
        title="新建浏览器"
        aria-label="新建浏览器"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </button>
    </div>
  );
}

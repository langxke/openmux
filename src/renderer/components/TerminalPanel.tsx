import { useEffect, useRef, useCallback } from "react";
import { useXTerm, LIGHT_THEME, DARK_THEME } from "../hooks/useXTerm";
import { useOpenMux } from "../hooks/useOpenMux";
import { useZoomStore } from "../stores/zoomStore";
import { useConfigStore } from "../stores/configStore";

function basename(str: string): string {
  const i = Math.max(str.lastIndexOf("/"), str.lastIndexOf("\\"));
  return i >= 0 ? str.slice(i + 1) : str;
}

interface TerminalPanelProps {
  sessionId: string;
  shell?: "powershell" | "cmd";
  cwd?: string;
  api?: import("dockview").DockviewPanelApi;
}

export function TerminalPanel({
  sessionId,
  shell = "powershell",
  cwd = ".",
  api,
}: TerminalPanelProps) {
  const offOutputRef = useRef<(() => void) | null>(null);
  const writeRef = useRef<(data: string) => void>(() => {});
  const fontSize = useZoomStore((s) => s.sessionSizes[sessionId] ?? s.terminalFontSize);
  const config = useConfigStore((s) => s.config);
  const om = useOpenMux();

  const sessionRef = useRef(sessionId);
  /* eslint-disable react-hooks/refs */
  sessionRef.current = sessionId;
  /* eslint-enable react-hooks/refs */

  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleData = useCallback((data: string) => {
    om.pty.write(sessionRef.current, data);
  }, [om.pty]);

  const handleResize = useCallback((cols: number, rows: number) => {
    if (resizeTimerRef.current) {
      clearTimeout(resizeTimerRef.current);
    }
    om.pty.resize(sessionRef.current, rows, cols);
    // Minimal trailing guard: ensure the last resize during rapid-fire events
    // arrives even if the leading call gets lost in the IPC queue.
    resizeTimerRef.current = setTimeout(() => {
      resizeTimerRef.current = null;
      om.pty.resize(sessionRef.current, rows, cols);
    }, 100);
  }, [om.pty]);

  const terminalTheme = config?.theme === "dark" ? DARK_THEME : LIGHT_THEME;

  const { containerRef, terminal, write, focus } = useXTerm({
    onData: handleData,
    onResize: handleResize,
    fontSize,
    fontFamily: config?.fontFamily,
    theme: terminalTheme,
  });

  useEffect(() => {
    const term = terminal.current;
    if (!term) return;
    const dispose = term.onTitleChange((title) => {
      if (!title) {
        api?.setTitle("Terminal");
        return;
      }
      const short = basename(title);
      api?.setTitle(short.length > 30 ? short.slice(0, 28) + ".." : short);
    });
    return () => dispose.dispose();
  }, [terminal, api]);

  /* eslint-disable react-hooks/refs */
  writeRef.current = write;
  /* eslint-enable react-hooks/refs */

  // Register IPC listener during render phase so PTY output from the initial
  // spawn isn't lost to a race with the mount effect. This intentional render-phase
  // access is safe because (a) the callback is stable (it reads writeRef.current,
  // which only changes when the xterm hook re-initializes), and (b) the offOutputRef
  // guard ensures it only runs once.
  // eslint-disable-next-line react-hooks/refs
  if (!offOutputRef.current) {
    // eslint-disable-next-line react-hooks/refs
    offOutputRef.current = om.pty.onOutput(sessionRef.current, (data: string) => {
      writeRef.current(data);
    });
  }

  useEffect(() => {
    const sid = sessionRef.current;

    // Re-register (first mount it's a no-op after cleanup, on deps
    // change it ensures the listener is live before the spawn below).
    offOutputRef.current?.();
    offOutputRef.current = om.pty.onOutput(sid, (data: string) => {
      writeRef.current(data);
    });

    // Use sensible defaults until the fit-addon measures the real viewport.
    // Spawning at (0,0) causes the shell to start with no width, which
    // misplaces the cursor (e.g. "PS D:\..." followed by garbage characters).
    om.pty.spawn(sid, shell, cwd, 80, 24);

    return () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      offOutputRef.current?.();
      offOutputRef.current = null;
      om.pty.release(sid);
    };
  }, [sessionId, shell, cwd, om.pty]);

  useEffect(() => {
    focus();
    const timer = setTimeout(() => focus(), 200);
    return () => clearTimeout(timer);
  }, [focus]);

  /* eslint-disable react-hooks/preserve-manual-memoization -- terminal is a stable RefObject */
  const handleContextMenu = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      const action = await om.contextMenu.showTerminal();
      if (!action) return;

      const term = terminal.current;
      if (!term) return;

      if (action === "copy") {
        const selection = term.getSelection();
        if (selection) {
          await om.clipboard.writeText(selection);
        }
      } else if (action === "paste") {
        const text = await om.clipboard.readText();
        if (text) {
          om.pty.write(sessionRef.current, text);
        }
      } else if (action === "selectAll") {
        term.selectAll();
      }
    },
    [terminal, om.contextMenu, om.clipboard, om.pty],
  );
  /* eslint-enable react-hooks/preserve-manual-memoization */

  return (
    <div
      className="h-full w-full p-px"
      style={{ backgroundColor: "var(--color-bg)" }}
      onContextMenu={handleContextMenu}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

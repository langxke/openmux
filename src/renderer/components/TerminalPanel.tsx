import { useEffect, useRef, useCallback } from "react";
import { useXTerm } from "../hooks/useXTerm";
import { om } from "../lib/openmux-api";
import { useZoomStore } from "../stores/zoomStore";

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

  const sessionRef = useRef(sessionId);
  /* eslint-disable react-hooks/refs */
  sessionRef.current = sessionId;
  /* eslint-enable react-hooks/refs */

  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleData = useCallback((data: string) => {
    om().pty.write(sessionRef.current, data);
  }, []);

  const handleResize = useCallback((cols: number, rows: number) => {
    if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    resizeTimerRef.current = setTimeout(() => {
      om().pty.resize(sessionRef.current, rows, cols);
    }, 150);
  }, []);

  const { containerRef, terminal, write, focus } = useXTerm({
    onData: handleData,
    onResize: handleResize,
    fontSize,
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

  // Register IPC listener before any effects fire, so PTY output
  // from the initial spawn isn't lost to a race with the effect.
  if (!offOutputRef.current) {
    offOutputRef.current = om().pty.onOutput(sessionRef.current, (data: string) => {
      writeRef.current(data);
    });
  }

  useEffect(() => {
    const sid = sessionRef.current;

    // Re-register (first mount it's a no-op after cleanup, on deps
    // change it ensures the listener is live before the spawn below).
    offOutputRef.current?.();
    offOutputRef.current = om().pty.onOutput(sid, (data: string) => {
      writeRef.current(data);
    });

    om().pty.spawn(sid, shell, cwd, 0, 0);

    return () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      offOutputRef.current?.();
      offOutputRef.current = null;
      om().pty.release(sid);
    };
  }, [sessionId, shell, cwd]);

  useEffect(() => {
    focus();
    const timer = setTimeout(() => focus(), 200);
    return () => clearTimeout(timer);
  }, [focus]);

  const handleContextMenu = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      const action = await om().contextMenu.showTerminal();
      if (!action) return;

      const term = terminal.current;
      if (!term) return;

      if (action === "copy") {
        const selection = term.getSelection();
        if (selection) {
          await om().clipboard.writeText(selection);
        }
      } else if (action === "paste") {
        const text = await om().clipboard.readText();
        if (text) {
          om().pty.write(sessionRef.current, text);
        }
      } else if (action === "selectAll") {
        term.selectAll();
      }
    },
    [terminal],
  );

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

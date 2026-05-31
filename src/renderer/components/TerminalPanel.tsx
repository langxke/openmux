import { useEffect, useRef, useCallback } from "react";
import { useXTerm } from "../hooks/useXTerm";
import { glaze } from "../lib/glaze-api";
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
  const fontSize = useZoomStore((s) => s.terminalFontSize);

  const sessionRef = useRef(sessionId);
  /* eslint-disable react-hooks/refs */
  sessionRef.current = sessionId;
  /* eslint-enable react-hooks/refs */

  const handleData = useCallback((data: string) => {
    glaze().pty.write(sessionRef.current, data);
  }, []);

  const handleResize = useCallback((cols: number, rows: number) => {
    const sid = sessionRef.current;
    glaze().pty.spawn(sid, shell, cwd, rows, cols);
    glaze().pty.resize(sid, rows, cols);
  }, [shell, cwd]);

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

  useEffect(() => {
    const sid = sessionRef.current;

    glaze().pty.spawn(sid, shell, cwd, 24, 80);

    if (!offOutputRef.current) {
      offOutputRef.current = glaze().pty.onOutput(sid, (data: string) => {
        writeRef.current(data);
      });
    }

    return () => {
      offOutputRef.current?.();
      offOutputRef.current = null;
      glaze().pty.release(sid);
    };
  }, [sessionId, shell, cwd]);

  useEffect(() => {
    focus();
    const timer = setTimeout(() => focus(), 200);
    return () => clearTimeout(timer);
  }, [focus]);

  return (
    <div
      className="h-full w-full p-px"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

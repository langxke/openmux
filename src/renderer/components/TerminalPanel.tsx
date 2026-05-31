import { useEffect, useRef, useCallback } from "react";
import { useXTerm } from "../hooks/useXTerm";
import { glaze } from "../lib/glaze-api";

interface TerminalPanelProps {
  sessionId: string;
  shell?: "powershell" | "cmd";
  cwd?: string;
}

export function TerminalPanel({
  sessionId,
  shell = "powershell",
  cwd = ".",
}: TerminalPanelProps) {
  const offOutputRef = useRef<(() => void) | null>(null);
  const writeRef = useRef<(data: string) => void>(() => {});

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

  const { containerRef, write, focus } = useXTerm({
    onData: handleData,
    onResize: handleResize,
  });

  /* eslint-disable react-hooks/refs */
  writeRef.current = write;
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    const sid = sessionRef.current;

    // Ensure PTY session exists (main process handles dedup)
    glaze().pty.spawn(sid, shell, cwd, 24, 80);

    // Register output listener
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

import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface XTermTheme {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export const LIGHT_THEME: XTermTheme = {
  background: "#ffffff",
  foreground: "#1d1d1f",
  cursor: "#007aff",
  selectionBackground: "#007aff40",
  black: "#1d1d1f",
  red: "#ff3b30",
  green: "#34c759",
  yellow: "#ff9500",
  blue: "#007aff",
  magenta: "#af52de",
  cyan: "#5ac8fa",
  white: "#8e8e93",
  brightBlack: "#6e6e73",
  brightRed: "#ff3b30",
  brightGreen: "#34c759",
  brightYellow: "#ff9500",
  brightBlue: "#007aff",
  brightMagenta: "#af52de",
  brightCyan: "#5ac8fa",
  brightWhite: "#1d1d1f",
};

export const DARK_THEME: XTermTheme = {
  background: "#1d1d1f",
  foreground: "#f5f5f7",
  cursor: "#007aff",
  selectionBackground: "#007aff60",
  black: "#1d1d1f",
  red: "#ff453a",
  green: "#30d158",
  yellow: "#ffd60a",
  blue: "#0a84ff",
  magenta: "#bf5af2",
  cyan: "#5ac8fa",
  white: "#8e8e93",
  brightBlack: "#6e6e73",
  brightRed: "#ff453a",
  brightGreen: "#30d158",
  brightYellow: "#ffd60a",
  brightBlue: "#0a84ff",
  brightMagenta: "#bf5af2",
  brightCyan: "#5ac8fa",
  brightWhite: "#f5f5f7",
};

const DEFAULT_FONT = '"Consolas", "SimHei", "Microsoft YaHei", monospace';

interface UseXTermOptions {
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  fontSize?: number;
  fontFamily?: string;
  theme?: XTermTheme;
}

export function useXTerm(options: UseXTermOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initRef = useRef(false);

  // Output buffering during resize — prevents xterm.js from receiving PTY
  // output while the buffer is being resized, which corrupts cursor tracking.
  const resizingRef = useRef(false);
  const outputBufferRef = useRef<string[]>([]);

  // Stable refs for callbacks
  const onDataRef = useRef(options.onData);
  const onResizeRef = useRef(options.onResize);
  /* eslint-disable react-hooks/refs */
  onDataRef.current = options.onData;
  onResizeRef.current = options.onResize;
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    const container = containerRef.current;
    if (!container || initRef.current) return;
    initRef.current = true;

    const terminal = new Terminal({
      fontSize: options.fontSize ?? 14,
      fontFamily: options.fontFamily ?? DEFAULT_FONT,
      theme: options.theme ?? LIGHT_THEME,
      cursorBlink: true,
      cursorStyle: "bar",
      allowTransparency: false,
      reflowCursorLine: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Register resize BEFORE fit so the first resize is captured
    const resizeDispose = terminal.onResize(({ cols, rows }) => {
      onResizeRef.current?.(cols, rows);
    });

    // Register data handler with proper cleanup
    const dataDispose = terminal.onData((data) => {
      onDataRef.current?.(data);
    });

    terminal.open(container);
    fitAddon.fit();

    // Notify parent of initial dimensions
    const dims = fitAddon.proposeDimensions();
    if (dims) {
      onResizeRef.current?.(dims.cols, dims.rows);
    }

    terminal.focus();
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    let rafId: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        resizingRef.current = true;
        fitAddon.fit();
        requestAnimationFrame(() => {
          resizingRef.current = false;
          const buffered = outputBufferRef.current;
          outputBufferRef.current = [];
          if (buffered.length > 0) {
            terminal.write(buffered.join(""));
          }
          terminal.refresh(0, terminal.rows - 1);
          terminal.scrollToBottom();
        });
      });
    });
    resizeObserver.observe(container);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      dataDispose.dispose();
      resizeDispose.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      initRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon || options.fontSize == null) return;

    // Buffer output during resize to prevent xterm.js cursor tracking
    // corruption caused by simultaneous buffer resize + data write.
    resizingRef.current = true;

    terminal.options.fontSize = options.fontSize;
    const predicted = fitAddon.proposeDimensions();
    if (predicted && predicted.cols > 0 && predicted.rows > 0) {
      onResizeRef.current?.(predicted.cols, predicted.rows);
    }
    fitAddon?.fit();

    // Flush buffered output after resize settles, then force re-render.
    requestAnimationFrame(() => {
      resizingRef.current = false;
      const buffered = outputBufferRef.current;
      outputBufferRef.current = [];
      if (buffered.length > 0) {
        terminal.write(buffered.join(""));
      }
      terminal.refresh(0, terminal.rows - 1);
      terminal.scrollToBottom();
    });

    return () => {
      resizingRef.current = false;
      const buffered = outputBufferRef.current;
      outputBufferRef.current = [];
      if (buffered.length > 0) {
        terminal.write(buffered.join(""));
      }
    };
  }, [options.fontSize]);

  const write = useCallback((data: string) => {
    if (resizingRef.current) {
      outputBufferRef.current.push(data);
      return;
    }
    terminalRef.current?.write(data);
  }, []);

  const writeln = useCallback((data: string) => {
    terminalRef.current?.writeln(data);
  }, []);

  const clear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  const focus = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  const fit = useCallback(() => {
    fitAddonRef.current?.fit();
  }, []);

  return {
    containerRef,
    terminal: terminalRef,
    write,
    writeln,
    clear,
    focus,
    fit,
  };
}

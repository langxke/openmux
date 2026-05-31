import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";

interface UseXTermOptions {
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  fontSize?: number;
  fontFamily?: string;
}

export function useXTerm(options: UseXTermOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initRef = useRef(false);

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
      fontFamily:
        options.fontFamily ??
        '"Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace',
      theme: {
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
      },
      cursorBlink: true,
      cursorStyle: "bar",
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    try {
      const webglAddon = new WebglAddon();
      terminal.loadAddon(webglAddon);
    } catch {
      // WebGL fallback
    }

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

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(container);

    return () => {
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
    if (!terminal || !options.fontSize) return;
    terminal.options.fontSize = options.fontSize;
    fitAddon?.fit();
  }, [options.fontSize]);

  const write = useCallback((data: string) => {
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

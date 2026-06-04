import type { OpenMuxConfig } from "./types";

interface OpenMuxPty {
  spawn(id: string, shell: string, cwd: string, rows: number, cols: number): Promise<void>;
  write(id: string, data: string): Promise<void>;
  resize(id: string, rows: number, cols: number): Promise<void>;
  kill(id: string): Promise<void>;
  release(id: string): Promise<void>;
  onOutput(id: string, cb: (data: string) => void): () => void;
}

interface OpenMuxConfigApi {
  get(): Promise<OpenMuxConfig>;
}

interface OpenMuxWindowApi {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  onMaximizeChange(cb: (maximized: boolean) => void): () => void;
  setZoom(level: number): Promise<void>;
  getZoom(): Promise<number>;
}

interface OpenMuxClipboardApi {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

interface OpenMuxContextMenuApi {
  showTerminal(): Promise<"copy" | "paste" | "selectAll" | null>;
}

interface OpenMuxWorkspaceApi {
  load(): Promise<unknown>;
  save(state: unknown): Promise<void>;
}

interface OpenMuxBrowserApi {
  setZoom(webContentsId: number, factor: number): Promise<void>;
  setup(webContentsId: number): Promise<void>;
}

interface OpenMuxAPI {
  pty: OpenMuxPty;
  config: OpenMuxConfigApi;
  window: OpenMuxWindowApi;
  clipboard: OpenMuxClipboardApi;
  contextMenu: OpenMuxContextMenuApi;
  workspace: OpenMuxWorkspaceApi;
  browser: OpenMuxBrowserApi;
  getWebviewPreloadPath(): Promise<string>;
}

declare global {
  interface Window {
    openmux: OpenMuxAPI;
  }
}

export function om(): OpenMuxAPI {
  if (!window.openmux) {
    throw new Error("openmux API not available — are you running in Electron?");
  }
  return window.openmux;
}

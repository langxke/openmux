import type { GlazeConfig } from "./types";

interface GlazePty {
  spawn(id: string, shell: string, cwd: string, rows: number, cols: number): Promise<void>;
  write(id: string, data: string): Promise<void>;
  resize(id: string, rows: number, cols: number): Promise<void>;
  kill(id: string): Promise<void>;
  release(id: string): Promise<void>;
  onOutput(id: string, cb: (data: string) => void): () => void;
}

interface GlazeConfigApi {
  get(): Promise<GlazeConfig>;
}

interface GlazeWindowApi {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  onMaximizeChange(cb: (maximized: boolean) => void): () => void;
}

interface GlazeClipboardApi {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

interface GlazeContextMenuApi {
  showTerminal(): Promise<"copy" | "paste" | "selectAll" | null>;
}

interface GlazeWorkspaceApi {
  load(): Promise<unknown>;
  save(state: unknown): Promise<void>;
}

interface GlazeAPI {
  pty: GlazePty;
  config: GlazeConfigApi;
  window: GlazeWindowApi;
  clipboard: GlazeClipboardApi;
  contextMenu: GlazeContextMenuApi;
  workspace: GlazeWorkspaceApi;
  getWebviewPreloadPath(): Promise<string>;
}

declare global {
  interface Window {
    glaze: GlazeAPI;
  }
}

export function glaze(): GlazeAPI {
  if (!window.glaze) {
    throw new Error("glaze API not available — are you running in Electron?");
  }
  return window.glaze;
}

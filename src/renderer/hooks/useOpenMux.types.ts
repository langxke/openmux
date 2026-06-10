// Separate file so tests can import the types without pulling in React/JSX.

export interface OpenMuxPty {
  spawn(id: string, shell: string, cwd: string, rows: number, cols: number): Promise<void>;
  write(id: string, data: string): Promise<void>;
  resize(id: string, rows: number, cols: number): Promise<void>;
  kill(id: string): Promise<void>;
  release(id: string): Promise<void>;
  onOutput(id: string, cb: (data: string) => void): () => void;
}

export interface OpenMuxConfigApi {
  get(): Promise<import("../../shared/types").OpenMuxConfig>;
  save(config: import("../../shared/types").OpenMuxConfig): Promise<void>;
}

export interface OpenMuxWindowApi {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  onMaximizeChange(cb: (maximized: boolean) => void): () => void;
  setZoom(level: number): Promise<void>;
  getZoom(): Promise<number>;
}

export interface OpenMuxClipboardApi {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

export interface OpenMuxContextMenuApi {
  showTerminal(): Promise<"copy" | "paste" | "selectAll" | null>;
}

export interface OpenMuxWorkspaceApi {
  load(): Promise<unknown>;
  save(state: unknown): Promise<void>;
}

export interface OpenMuxBrowserApi {
  setZoom(webContentsId: number, factor: number): Promise<void>;
}

export interface OpenMuxAPI {
  pty: OpenMuxPty;
  config: OpenMuxConfigApi;
  window: OpenMuxWindowApi;
  clipboard: OpenMuxClipboardApi;
  contextMenu: OpenMuxContextMenuApi;
  workspace: OpenMuxWorkspaceApi;
  browser: OpenMuxBrowserApi;
  getWebviewPreloadPath(): Promise<string>;
}

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("openmux", {
  pty: {
    spawn: (id: string, shell: string, cwd: string, rows: number, cols: number) =>
      ipcRenderer.invoke("pty:spawn", id, shell, cwd, rows, cols),
    write: (id: string, data: string) =>
      ipcRenderer.invoke("pty:write", id, data),
    resize: (id: string, rows: number, cols: number) =>
      ipcRenderer.invoke("pty:resize", id, rows, cols),
    kill: (id: string) =>
      ipcRenderer.invoke("pty:kill", id),
    release: (id: string) =>
      ipcRenderer.invoke("pty:release", id),
    onOutput: (id: string, cb: (data: string) => void) => {
      const channel = `pty-output-${id}`;
      const handler = (_event: Electron.IpcRendererEvent, data: string) => cb(data);
      ipcRenderer.on(channel, handler);
      return () => {
        ipcRenderer.removeListener(channel, handler);
      };
    },
  },
  config: {
    get: () => ipcRenderer.invoke("config:get"),
    save: (config: unknown) => ipcRenderer.invoke("config:save", config),
  },
  getWebviewPreloadPath: () => ipcRenderer.invoke("getWebviewPreloadPath"),
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    onMaximizeChange: (cb: (maximized: boolean) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) =>
        cb(maximized);
      ipcRenderer.on("window:maximizeChange", handler);
      return () => {
        ipcRenderer.removeListener("window:maximizeChange", handler);
      };
    },
    setZoom: (level: number) => ipcRenderer.invoke("window:setZoom", level),
    getZoom: () => ipcRenderer.invoke("window:getZoom"),
  },
  clipboard: {
    readText: () => ipcRenderer.invoke("clipboard:readText"),
    writeText: (text: string) => ipcRenderer.invoke("clipboard:writeText", text),
  },
  contextMenu: {
    showTerminal: () => ipcRenderer.invoke("context-menu:terminal"),
  },
  workspace: {
    load: () => ipcRenderer.invoke("workspace:load"),
    save: (state: unknown) => ipcRenderer.invoke("workspace:save", state),
  },
  browser: {
    setZoom: (webContentsId: number, factor: number) =>
      ipcRenderer.invoke("browser:setZoom", webContentsId, factor),
    setup: (webContentsId: number) =>
      ipcRenderer.invoke("browser:setup", webContentsId),
  },
});

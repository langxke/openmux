import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("glaze", {
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
  },
});

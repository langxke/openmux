import { ipcMain } from "electron";
import { ptyManager } from "./pty-manager";

export function registerPtyHandlers(getMainWindow: () => Electron.BrowserWindow | null) {
  ipcMain.handle("pty:spawn", (_event, sessionId: string, shell: string, cwd: string, rows: number, cols: number) => {
    ptyManager.ensureSession(
      sessionId,
      shell as "powershell" | "cmd",
      cwd,
      rows,
      cols,
      (data: string) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send(`pty-output-${sessionId}`, data);
        }
      },
    );
  });

  ipcMain.handle("pty:write", (_event, sessionId: string, data: string) => {
    ptyManager.write(sessionId, data);
  });

  ipcMain.handle("pty:resize", (_event, sessionId: string, rows: number, cols: number) => {
    ptyManager.resize(sessionId, rows, cols);
  });

  ipcMain.handle("pty:kill", (_event, sessionId: string) => {
    ptyManager.disposeSession(sessionId);
  });

  ipcMain.handle("pty:release", (_event, sessionId: string) => {
    ptyManager.releaseSession(sessionId);
  });
}

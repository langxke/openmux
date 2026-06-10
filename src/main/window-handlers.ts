import { ipcMain, webContents, clipboard } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function registerWindowHandlers(getMainWindow: () => Electron.BrowserWindow | null) {
  ipcMain.handle("window:minimize", () => {
    getMainWindow()?.minimize();
  });

  ipcMain.handle("window:maximize", () => {
    const win = getMainWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle("window:close", () => {
    getMainWindow()?.close();
  });

  ipcMain.handle("window:isMaximized", () => {
    return getMainWindow()?.isMaximized() ?? false;
  });

  ipcMain.handle("window:setZoom", (_event, level: number) => {
    getMainWindow()?.webContents.setZoomLevel(level);
  });

  ipcMain.handle("window:getZoom", () => {
    return getMainWindow()?.webContents.getZoomLevel() ?? 0;
  });
}

export function registerClipboardHandlers() {
  ipcMain.handle("clipboard:readText", () => {
    return clipboard.readText();
  });

  ipcMain.handle("clipboard:writeText", (_event, text: string) => {
    clipboard.writeText(text);
  });
}

export function registerBrowserHandler() {
  ipcMain.handle("browser:setZoom", (_event: unknown, webContentsId: number, factor: number) => {
    const wc = webContents.fromId(webContentsId);
    if (wc && !wc.isDestroyed()) {
      wc.setZoomFactor(factor);
    }
  });
}

export function registerWebviewHandler() {
  ipcMain.handle("getWebviewPreloadPath", () => {
    return pathToFileURL(path.join(__dirname, "webview.js")).toString();
  });
}

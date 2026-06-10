import { ipcMain, BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { Menu } from "electron";

export function registerContextMenuHandlers() {
  ipcMain.handle("context-menu:terminal", async (event: IpcMainInvokeEvent) => {
    return new Promise<string | null>((resolve) => {
      const menu = Menu.buildFromTemplate([
        { label: "复制", click: () => resolve("copy") },
        { label: "粘贴", click: () => resolve("paste") },
        { label: "全选", click: () => resolve("selectAll") },
      ]);
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) {
        resolve(null);
        return;
      }
      menu.popup({
        window: win,
        callback: () => resolve(null),
      });
    });
  });
}

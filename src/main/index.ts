import { app, BrowserWindow, Menu } from "electron";
import path from "node:path";
import { ptyManager } from "./pty-manager";
import { registerPtyHandlers } from "./pty-handlers";
import { registerConfigHandlers } from "./config-handlers";
import { registerWindowHandlers, registerClipboardHandlers, registerBrowserHandler, registerWebviewHandler } from "./window-handlers";
import { registerWorkspaceHandlers } from "./workspace-handlers";
import { registerContextMenuHandlers } from "./context-menu-handlers";

// 开发环境使用独立的 userData 目录，避免与已安装版本冲突
if (!app.isPackaged) {
  app.setPath("userData", path.join(app.getPath("userData"), "../openmux-dev"));
}

// node-pty's internal _deferNoArgs queue can fire resize calls after the PTY
// has already exited.  Catch those here instead of letting them crash the app.
process.on("uncaughtException", (error) => {
  if (error instanceof Error && error.message?.includes("pty that has already exited")) {
    return; // harmless race — suppress
  }
  console.error(error);
});

let mainWindow: BrowserWindow | null = null;

function getMainWindow() {
  return mainWindow;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 650,
    minWidth: 600,
    minHeight: 400,
    title: "openmux",
    frame: false,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/main_window/index.html"));
  }

  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window:maximizeChange", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window:maximizeChange", false);
  });

  // Webview zoom — single authority in main process via before-input-event.
  // BrowserPanel no longer maintains its own zoom state; all webview zoom
  // flows through this handler to avoid dual-scale (zoomLevel vs zoomFactor)
  // conflicts.
  mainWindow.webContents.on("did-attach-webview", (_event, wc) => {
    wc.on("before-input-event", (event, input) => {
      if (!input.control) return;
      if (input.key === "=" || input.key === "+") {
        event.preventDefault();
        const current = wc.getZoomLevel();
        wc.setZoomLevel(Math.min(5, current + 0.5));
      } else if (input.key === "-") {
        event.preventDefault();
        const current = wc.getZoomLevel();
        wc.setZoomLevel(Math.max(-5, current - 0.5));
      } else if (input.key === "0") {
        event.preventDefault();
        wc.setZoomLevel(0);
      }
    });

    // Redirect popups / window.open to a new browser tab.
    // Only allow http/https URLs to prevent injection via javascript: or
    // other dangerous protocols. Dispatch via executeJavaScript to avoid
    // a persistent issue with ipcRenderer.on delivery for the dedicated channel.
    wc.setWindowOpenHandler(({ url }) => {
      if (!url.startsWith("http:") && !url.startsWith("https:")) {
        return { action: "deny" };
      }
      setImmediate(() => {
        if (mainWindow && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.executeJavaScript(
            `window.dispatchEvent(new CustomEvent('openmux:openBrowserTab', { detail: ${JSON.stringify(url)} }))`,
          );
        }
      });
      return { action: "deny" };
    });

    wc.on("context-menu", (_event, params) => {
      const template: Electron.MenuItemConstructorOptions[] = [
        { label: "复制", click: () => wc.copy() },
        { label: "粘贴", click: () => wc.paste() },
        { type: "separator" },
        { label: "检查元素", click: () => wc.inspectElement(params.x, params.y) },
      ];

      const menu = Menu.buildFromTemplate(template);
      menu.popup({ window: mainWindow! });
    });
  });
}

// --- Register IPC handlers (grouped by theme) ---

registerPtyHandlers(getMainWindow);
registerConfigHandlers();
registerWindowHandlers(getMainWindow);
registerClipboardHandlers();
registerBrowserHandler();
registerWebviewHandler();
registerWorkspaceHandlers();
registerContextMenuHandlers();

// --- App lifecycle ---

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("before-quit", () => {
  ptyManager.disposeAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

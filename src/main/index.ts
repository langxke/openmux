import { app, BrowserWindow, ipcMain, Menu, clipboard, webContents } from "electron";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ptyManager } from "./pty-manager";
import { getConfig } from "./config";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 650,
    minWidth: 600,
    minHeight: 400,
    title: "openmux",
    frame: false,
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
    mainWindow.loadURL("http://localhost:5173");
  }

  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window:maximizeChange", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window:maximizeChange", false);
  });

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

    // Redirect popups / window.open to navigate in-place
    wc.setWindowOpenHandler(({ url }) => {
      setImmediate(() => {
        wc.loadURL(url);
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

// --- PTY IPC ---

ipcMain.handle("pty:spawn", (_event, sessionId: string, shell: string, cwd: string, rows: number, cols: number) => {
  ptyManager.ensureSession(
    sessionId,
    shell as "powershell" | "cmd",
    cwd,
    rows,
    cols,
    (data: string) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(`pty-output-${sessionId}`, data);
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

// --- Config IPC ---

ipcMain.handle("config:get", () => {
  return getConfig();
});

ipcMain.handle("getWebviewPreloadPath", () => {
  return pathToFileURL(path.join(__dirname, "webview.js")).toString();
});

// --- Window control IPC ---

ipcMain.handle("window:minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("window:maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle("window:close", () => {
  mainWindow?.close();
});

ipcMain.handle("window:isMaximized", () => {
  return mainWindow?.isMaximized() ?? false;
});

ipcMain.handle("window:setZoom", (_event, level: number) => {
  mainWindow?.webContents.setZoomLevel(level);
});

ipcMain.handle("window:getZoom", () => {
  return mainWindow?.webContents.getZoomLevel() ?? 0;
});

// --- Clipboard IPC ---

ipcMain.handle("clipboard:readText", () => {
  return clipboard.readText();
});

ipcMain.handle("clipboard:writeText", (_event, text: string) => {
  clipboard.writeText(text);
});

ipcMain.handle("browser:setZoom", (_event, webContentsId: number, factor: number) => {
  const wc = webContents.fromId(webContentsId);
  if (wc && !wc.isDestroyed()) {
    wc.setZoomFactor(factor);
  }
});

// --- Workspace State IPC ---

function workspaceStatePath(): string {
  return path.join(app.getPath("userData"), "workspaces.json");
}

ipcMain.handle("workspace:load", () => {
  try {
    const p = workspaceStatePath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    }
  } catch {
    // corrupted or missing — return null
  }
  return null;
});

ipcMain.handle("workspace:save", (_event, state: unknown) => {
  try {
    const dir = path.dirname(workspaceStatePath());
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(workspaceStatePath(), JSON.stringify(state, null, 2), "utf-8");
  } catch {
    // best effort
  }
});

// --- Context Menu IPC ---

ipcMain.handle("context-menu:terminal", async (event) => {
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

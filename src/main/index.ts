import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ptyManager } from "./pty-manager";
import { getConfig } from "./config";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: "Glaze",
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
      mainWindow?.webContents.send(`pty-output-${sessionId}`, data);
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

import { app, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";

function workspaceStatePath(): string {
  return path.join(app.getPath("userData"), "workspaces.json");
}

export function registerWorkspaceHandlers() {
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

  ipcMain.handle("workspace:save", (_event: unknown, state: unknown) => {
    try {
      const dir = path.dirname(workspaceStatePath());
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(workspaceStatePath(), JSON.stringify(state, null, 2), "utf-8");
    } catch {
      // best effort
    }
  });
}

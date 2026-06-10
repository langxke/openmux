import { ipcMain } from "electron";
import { getConfig, saveConfig } from "./config";

export function registerConfigHandlers() {
  ipcMain.handle("config:get", () => {
    return getConfig();
  });

  ipcMain.handle("config:save", (_event, config: unknown) => {
    saveConfig(config as Parameters<typeof saveConfig>[0]);
  });
}

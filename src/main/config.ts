import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export interface OpenMuxConfig {
  defaultShell: "powershell" | "cmd";
  fontSize: number;
  fontFamily: string;
  theme: string;
  keybindings: Record<string, string>;
}

function defaultConfig(): OpenMuxConfig {
  return {
    defaultShell: "powershell",
    fontSize: 14,
    fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',
    theme: "dark",
    keybindings: {
      newTab: "Ctrl+T",
      closeTab: "Ctrl+W",
      toggleSidebar: "Ctrl+B",
    },
  };
}

function configPath(): string {
  const userDataPath = app.getPath("userData");
  return path.join(userDataPath, "openmux.json");
}

export function getConfig(): OpenMuxConfig {
  const cp = configPath();
  try {
    if (fs.existsSync(cp)) {
      const content = fs.readFileSync(cp, "utf-8");
      return JSON.parse(content) as OpenMuxConfig;
    }
  } catch {
    // Corrupted config — fall through to defaults
  }

  // Write defaults
  const config = defaultConfig();
  try {
    const dir = path.dirname(cp);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cp, JSON.stringify(config, null, 2), "utf-8");
  } catch {
    // Best effort
  }
  return config;
}

export function saveConfig(config: OpenMuxConfig): void {
  const cp = configPath();
  try {
    const dir = path.dirname(cp);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(cp, JSON.stringify(config, null, 2), "utf-8");
  } catch {
    // Best effort
  }
}

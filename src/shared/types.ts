/** Shared types — single source of truth for both main and renderer processes. */

export interface OpenMuxConfig {
  defaultShell: "powershell" | "cmd";
  fontSize: number;
  fontFamily: string;
  theme: string;
  keybindings: Record<string, string>;
}

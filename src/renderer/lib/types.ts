export interface TerminalSession {
  id: string;
  shell: "powershell" | "cmd";
  cwd: string;
}

export interface PanelData {
  id: string;
  sessionId: string;
  title: string;
}

export interface TabData {
  id: string;
  title: string;
  panels: PanelData[];
}

export interface OpenMuxConfig {
  defaultShell: "powershell" | "cmd";
  fontSize: number;
  fontFamily: string;
  theme: "dark";
  customCommands: CustomCommand[];
  keybindings: Record<string, string>;
}

export interface CustomCommand {
  name: string;
  command: string;
}

export interface WorkspaceInfo {
  id: string;
  title: string;
  shell: string;
  panelCount: number;
  isActive: boolean;
  isMaximized: boolean;
}

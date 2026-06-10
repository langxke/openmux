import * as pty from "node-pty";
import { EventEmitter } from "events";

type Shell = "powershell" | "cmd";
type PtyState = "opening" | "ready" | "releasing" | "exited";

interface PtySession {
  id: string;
  shell: Shell;
  cwd: string;
  state: PtyState;
  ptyProcess: pty.IPty;
  cols: number;
  rows: number;
}

class PtyManager {
  private sessions = new Map<string, PtySession>();
  private releaseTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private RELEASE_DELAY = 500;

  private getShellPath(shell: Shell): string {
    if (shell === "cmd") {
      return "C:\\Windows\\System32\\cmd.exe";
    }
    return "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
  }

  /** Get or create a PTY session. `onOutput` only applies to newly created sessions. */
  ensureSession(
    id: string,
    shell: Shell,
    cwd: string,
    rows: number,
    cols: number,
    onOutput?: (data: string) => void,
  ): PtySession {
    const timer = this.releaseTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.releaseTimers.delete(id);
    }

    const existing = this.sessions.get(id);
    if (existing) {
      if (existing.state === "exited") {
        this.sessions.delete(id);
      } else {
        if (existing.state === "releasing") {
          existing.state = "ready";
        }
        return existing;
      }
    }

    const session = this.createSession(id, shell, cwd, rows, cols, onOutput);
    this.sessions.set(id, session);
    return session;
  }

  private createSession(
    id: string,
    shell: Shell,
    cwd: string,
    rows: number,
    cols: number,
    onOutput?: (data: string) => void,
  ): PtySession {
    const shellPath = this.getShellPath(shell);
    const env = {
      ...(process.env as Record<string, string>),
      TERM: "xterm-256color",
      // PowerShell needs SystemRoot to load crypto DLLs (error 8009001d without it).
      // Electron's process.env may not inherit it depending on how the app was launched.
      SystemRoot: process.env.SystemRoot || "C:\\Windows",
    };
    const ptyProcess = pty.spawn(shellPath, [], {
      name: "xterm-256color",
      cols: cols > 0 ? cols : 80,
      rows: rows > 0 ? rows : 24,
      cwd: cwd === "." ? process.cwd() : cwd,
      env,
    });

    if (onOutput) {
      ptyProcess.onData(onOutput);
    }

    const session: PtySession = {
      id,
      shell,
      cwd,
      state: "ready",
      ptyProcess,
      cols,
      rows,
    };

    return session;
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (session && session.state !== "exited") {
      session.ptyProcess.write(data);
    }
  }

  resize(id: string, rows: number, cols: number): void {
    const session = this.sessions.get(id);
    if (session && session.state !== "exited") {
      this.doResize(session, rows, cols);
    }
  }

  private doResize(session: PtySession, rows: number, cols: number): void {
    try {
      session.ptyProcess.resize(cols, rows);
      session.cols = cols;
      session.rows = rows;
    } catch {
      // PTY already exited between check and resize — ignore
    }
  }

  /** Start release countdown. If ensureSession not called within delay, kills PTY. */
  releaseSession(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    if (session.state === "releasing" || session.state === "exited") return;

    session.state = "releasing";

    const timer = setTimeout(() => {
      this.releaseTimers.delete(id);
      this.destroySession(id);
    }, this.RELEASE_DELAY);

    this.releaseTimers.set(id, timer);
  }

  /** Immediately kill a session. */
  disposeSession(id: string): void {
    const timer = this.releaseTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.releaseTimers.delete(id);
    }
    this.destroySession(id);
  }

  /** Kill all sessions immediately. Call before app quit. */
  disposeAll(): void {
    for (const timer of this.releaseTimers.values()) {
      clearTimeout(timer);
    }
    this.releaseTimers.clear();
    for (const id of this.sessions.keys()) {
      this.destroySession(id);
    }
  }

  private destroySession(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.state = "exited";
    (session.ptyProcess as unknown as EventEmitter).removeAllListeners("data");
    try {
      session.ptyProcess.kill();
    } catch {
      // Already dead
    }
    this.sessions.delete(id);
  }
}

export const ptyManager = new PtyManager();

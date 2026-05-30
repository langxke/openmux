import { create } from "zustand";
import type { TerminalSession } from "../lib/types";

interface TerminalStore {
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
  createSession: (shell?: "powershell" | "cmd", cwd?: string) => string;
  removeSession: (id: string) => void;
  setActiveSession: (id: string) => void;
}

let nextId = 1;

export const useTerminalStore = create<TerminalStore>((set) => ({
  sessions: new Map(),
  activeSessionId: null,

  createSession: (shell = "powershell", cwd = ".") => {
    const id = `term-${nextId++}`;
    const session: TerminalSession = { id, shell, cwd };
    set((state) => {
      const next = new Map(state.sessions);
      next.set(id, session);
      return { sessions: next, activeSessionId: id };
    });
    return id;
  },

  removeSession: (id) => {
    set((state) => {
      const next = new Map(state.sessions);
      next.delete(id);
      return {
        sessions: next,
        activeSessionId:
          state.activeSessionId === id ? null : state.activeSessionId,
      };
    });
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
  },
}));

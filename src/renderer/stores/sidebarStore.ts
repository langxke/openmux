import { create } from "zustand";

const MIN_WIDTH = 120;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 220;

interface SidebarState {
  collapsed: boolean;
  width: number;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
  setWidth: (w: number) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  width: DEFAULT_WIDTH,
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
  setCollapsed: (v: boolean) => set({ collapsed: v }),
  setWidth: (w: number) =>
    set({ width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w))) }),
}));

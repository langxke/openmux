import { create } from "zustand";

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;
const DEFAULT_FONT_SIZE = 14;

interface ZoomState {
  /** Default font size for new terminals */
  terminalFontSize: number;
  /** Per-session font size overrides */
  sessionSizes: Record<string, number>;
  /** Currently active terminal session */
  activeSessionId: string | null;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  setActiveSession: (id: string | null) => void;
}

export const useZoomStore = create<ZoomState>((set, get) => ({
  terminalFontSize: DEFAULT_FONT_SIZE,
  sessionSizes: {},
  activeSessionId: null,

  zoomIn: () => {
    const { activeSessionId, sessionSizes, terminalFontSize } = get();
    if (!activeSessionId) return;
    const current = sessionSizes[activeSessionId] ?? terminalFontSize;
    set({
      sessionSizes: {
        ...sessionSizes,
        [activeSessionId]: Math.min(MAX_FONT_SIZE, current + 1),
      },
    });
  },

  zoomOut: () => {
    const { activeSessionId, sessionSizes, terminalFontSize } = get();
    if (!activeSessionId) return;
    const current = sessionSizes[activeSessionId] ?? terminalFontSize;
    set({
      sessionSizes: {
        ...sessionSizes,
        [activeSessionId]: Math.max(MIN_FONT_SIZE, current - 1),
      },
    });
  },

  zoomReset: () => {
    const { activeSessionId, sessionSizes } = get();
    if (!activeSessionId) return;
    const newSizes = { ...sessionSizes };
    delete newSizes[activeSessionId];
    set({ sessionSizes: newSizes });
  },

  setActiveSession: (id) => set({ activeSessionId: id }),
}));

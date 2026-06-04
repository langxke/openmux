import { create } from "zustand";

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

const MIN_FONT = 8;
const MAX_FONT = 32;

interface ZoomState {
  terminalFontSize: number;
  sessionSizes: Record<string, number>;
  activeSessionId: string | null;
  uiZoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  zoomTerminalIn: () => void;
  zoomTerminalOut: () => void;
  zoomTerminalReset: () => void;
  setActiveSession: (id: string | null) => void;
  removeSession: (id: string) => void;
}

export const useZoomStore = create<ZoomState>((set, get) => ({
  terminalFontSize: 14,
  sessionSizes: {},
  activeSessionId: null,
  uiZoom: 1.0,

  zoomIn: () => {
    const { uiZoom } = get();
    const next = Math.min(MAX_ZOOM, +(uiZoom + ZOOM_STEP).toFixed(1));
    set({ uiZoom: next });
  },

  zoomOut: () => {
    const { uiZoom } = get();
    const next = Math.max(MIN_ZOOM, +(uiZoom - ZOOM_STEP).toFixed(1));
    set({ uiZoom: next });
  },

  zoomReset: () => {
    set({ uiZoom: 1.0 });
  },

  zoomTerminalIn: () => {
    const { activeSessionId, sessionSizes, terminalFontSize } = get();
    if (!activeSessionId) return;
    const current = sessionSizes[activeSessionId] ?? terminalFontSize;
    set({
      sessionSizes: {
        ...sessionSizes,
        [activeSessionId]: Math.min(MAX_FONT, current + 1),
      },
    });
  },

  zoomTerminalOut: () => {
    const { activeSessionId, sessionSizes, terminalFontSize } = get();
    if (!activeSessionId) return;
    const current = sessionSizes[activeSessionId] ?? terminalFontSize;
    set({
      sessionSizes: {
        ...sessionSizes,
        [activeSessionId]: Math.max(MIN_FONT, current - 1),
      },
    });
  },

  zoomTerminalReset: () => {
    const { activeSessionId, sessionSizes } = get();
    if (!activeSessionId) return;
    const newSizes = { ...sessionSizes };
    delete newSizes[activeSessionId];
    set({ sessionSizes: newSizes });
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  removeSession: (id) => {
    const { sessionSizes } = get();
    if (!(id in sessionSizes)) return;
    const newSizes = { ...sessionSizes };
    delete newSizes[id];
    set({ sessionSizes: newSizes });
  },
}));

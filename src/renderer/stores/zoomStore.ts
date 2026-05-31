import { create } from "zustand";

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;
const DEFAULT_FONT_SIZE = 14;

interface ZoomState {
  terminalFontSize: number;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
}

export const useZoomStore = create<ZoomState>((set) => ({
  terminalFontSize: DEFAULT_FONT_SIZE,
  zoomIn: () =>
    set((s) => ({
      terminalFontSize: Math.min(MAX_FONT_SIZE, s.terminalFontSize + 1),
    })),
  zoomOut: () =>
    set((s) => ({
      terminalFontSize: Math.max(MIN_FONT_SIZE, s.terminalFontSize - 1),
    })),
  zoomReset: () =>
    set({
      terminalFontSize: DEFAULT_FONT_SIZE,
    }),
}));

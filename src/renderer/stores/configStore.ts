import { create } from "zustand";
import type { OpenMuxConfig } from "../lib/types";
import type { OpenMuxAPI } from "../hooks/useOpenMux.types";

interface ConfigState {
  config: OpenMuxConfig | null;
  loaded: boolean;
  load: (api: OpenMuxAPI) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  loaded: false,
  load: async (api) => {
    try {
      const cfg = await api.config.get();
      set({
        config: {
          defaultShell: cfg.defaultShell as "powershell" | "cmd",
          fontSize: cfg.fontSize,
          fontFamily: cfg.fontFamily,
          theme: cfg.theme,
          keybindings: cfg.keybindings ?? {},
        },
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },
}));

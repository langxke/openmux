import { create } from "zustand";
import type { GlazeConfig } from "../lib/types";
import { glaze } from "../lib/glaze-api";

interface ConfigState {
  config: GlazeConfig | null;
  loaded: boolean;
  load: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  loaded: false,
  load: async () => {
    try {
      const cfg = await glaze().config.get();
      set({
        config: {
          defaultShell: cfg.defaultShell as "powershell" | "cmd",
          fontSize: cfg.fontSize,
          fontFamily: cfg.fontFamily,
          theme: cfg.theme as "dark",
          customCommands: cfg.customCommands ?? [],
          keybindings: cfg.keybindings ?? {},
        },
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },
}));

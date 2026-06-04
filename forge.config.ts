import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { VitePlugin } from "@electron-forge/plugin-vite";

export default {
  packagerConfig: {
    name: "openmux",
    executableName: "openmux",
  },
  // Skip auto-rebuild during start — needs VS Dev Cmd Prompt for node-pty.
  // Rebuild manually when needed: npx electron-rebuild -f -w node-pty
  rebuildConfig: {
    onlyModules: [],
  },
  makers: [
    new MakerSquirrel({
      name: "openmux",
      setupIcon: undefined,
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main/index.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload/index.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
        {
          entry: "src/preload/webview.ts",
          config: "vite.webview.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
  ],
};

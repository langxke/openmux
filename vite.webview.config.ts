import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    outDir: ".vite/build",
    emptyOutDir: false,
    rollupOptions: {
      input: "src/preload/webview.ts",
      external: ["electron"],
      output: {
        format: "cjs",
        entryFileNames: "webview.js",
      },
    },
  },
});

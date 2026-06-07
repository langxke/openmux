import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    outDir: ".vite/build",
    emptyOutDir: false,
    rollupOptions: {
      input: "src/preload/index.ts",
      external: ["electron"],
      output: {
        format: "cjs",
        entryFileNames: "preload.js",
      },
    },
  },
});

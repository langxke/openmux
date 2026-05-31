import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      external: ["electron", "node-pty"],
      output: {
        format: "cjs",
        entryFileNames: "main.js",
      },
    },
  },
  resolve: {
    conditions: ["node"],
  },
});

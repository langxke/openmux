import { defineConfig } from "vite";
import { copyFileSync, mkdirSync } from "node:fs";

export default defineConfig({
  define: {
    "process.env": "process.env",
  },
  publicDir: false,
  build: {
    outDir: ".vite/build",
    rollupOptions: {
      input: "src/main/index.ts",
      external: ["electron", "node-pty", "node:fs", "node:path", "node:url", "node:child_process"],
      output: {
        format: "cjs",
        entryFileNames: "main.js",
      },
    },
  },
  plugins: [
    {
      name: "copy-icon",
      writeBundle() {
        mkdirSync(".vite/build", { recursive: true });
        copyFileSync("src/assets/icon.png", ".vite/build/icon.png");
      },
    },
  ],
  resolve: {
    conditions: ["node"],
  },
});

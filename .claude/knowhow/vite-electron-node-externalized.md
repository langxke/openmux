# Vite 构建 Electron 主进程时 node: 内置模块被静默替换导致窗口不显示

## 症状

从 Electron Forge 迁移到独立 Vite + electron-builder 后，安装应用并启动，任务管理器显示进程已运行，但无任何窗口弹出。无报错对话框，无日志输出。

## 根因

Electron Forge 的 Vite 插件在调用 `vite.build()` 时自动处理了 `node:*` 内置模块的 external 配置。移除 Forge 后，`vite.main.config.ts` 中只 external 了 `electron` 和 `node-pty`，遗漏了 `node:fs`、`node:path`、`node:url`、`node:child_process`。

Vite 在构建"client environment"目标时，会将这些 Node.js 专属的 `node:*` 导入标记为外部依赖，但因为 Vite 默认是浏览器构建模式，这些导入被替换为**不包含完整 API 的空桩模块**。于是 `path.join()`、`fs.existsSync()` 等调用在运行时返回 `TypeError: xxx.join is not a function`，主进程在 `createWindow()` 之前静默崩溃。

## 诊断方法

1. 运行打包后的 exe，观察进程是否存在但窗口不显示
2. 直接在终端运行打包目录中的 `openmux.exe`，查看控制台输出
3. 如果看到 `TypeError: d.default.join is not a function` 或类似错误，即为此问题
4. 检查 `.vite/build/main.js` 的头部，确认 `node:fs`、`node:path` 等是否以 `require("node:xxx")` 形式出现，而非被内联或替换

## 修复步骤

在 `vite.main.config.ts` 的 `rollupOptions.external` 中显式声明所有 `node:*` 导入：

```typescript
// vite.main.config.ts
export default defineConfig({
  build: {
    outDir: ".vite/build",
    rollupOptions: {
      input: "src/main/index.ts",
      external: [
        "electron",
        "node-pty",
        "node:fs",
        "node:path",
        "node:url",
        "node:child_process",
      ],
      output: {
        format: "cjs",
        entryFileNames: "main.js",
      },
    },
  },
  // ...
});
```

另一个方案是使用函数形式匹配所有 `node:*` 前缀：

```typescript
external: (id: string) =>
  id.startsWith("node:") || id === "electron" || id === "node-pty",
```

## 失败尝试

- 只 external `electron` 和 `node-pty` — 不工作，其他 `node:` 模块仍被替换
- 使用 `resolve.conditions: ["node"]` 但不配置 external — Vite 仍然以浏览器模式处理未 external 的模块

## 关键约束

- `node:` 前缀是 Node.js v12+ 支持的内置模块引用方式，Vite 不会自动将其识别为需要 external 的模块
- Electron Forge 的 Vite 插件在内部自动处理了这一点，迁移到独立 Vite 后需要手动配置
- 主进程的其他 Vite 配置（preload、webview）也需要相同的设置
- `emptyOutDir: false` 用于 preload/webview 构建，避免后续构建清空主进程的输出

## 原理

Rollup 的 `external` 配置告诉打包器哪些模块不应被打包进 bundle，而是在运行时通过 `require()` 或 `import` 从外部加载。对于 Electron 主进程，`node:fs`、`node:path` 等是运行时可用的 Node.js 内置模块，必须保持为 external。如果不声明 external，Vite/Rollup 会尝试解析和打包，发现无法处理（浏览器不兼容）后用空桩替换，导致运行时 API 缺失。

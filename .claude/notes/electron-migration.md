# Tauri → Electron 迁移经验

> 2026-05-30 | 迁移工时 ~1 天（含大量 toolchain 排障）

## 迁移动因

Tauri 的 multi-webview API (`Window::add_child()`) 标记为 unstable 超过 2 年。Child webview 需要手动管理原生子窗体的物理像素坐标、dpr 乘法、z-order 和显隐，与 HTML 布局完全断裂。

## 最终技术栈

| 层 | 选型 |
|----|------|
| 桌面壳 | Electron 42 + Electron Forge |
| 构建 | @electron-forge/plugin-vite (三进程独立 Vite 配置) |
| PTY | node-pty 1.1 (ConPTY on Windows) |
| 浏览器 | `<webview>` 标签 (DOM 元素，CSS 自动布局) |
| 前端 | React 19 + Zustand + Tailwind + dockview + xterm.js (不变) |

## 工具链选型

### Electron Forge + @electron-forge/plugin-vite ★ 选定

Electron 团队官方维护的一站式工具链。`electron-forge start` 处理 dev + HMR，`electron-forge make` 生成 Squirrel.Windows 安装包。`@electron-forge/plugin-vite` 为 main / preload / renderer 三进程各生成独立 Vite 配置。

wmux (桌面终端竞品) 也是这套方案，同场景验证过。

### 三进程 Vite 配置

```
vite.main.config.ts     — main process, CommonJS 输出, external: [electron, node-pty]
vite.preload.config.ts  — preload, CommonJS 输出, external: [electron]
vite.renderer.config.ts — renderer, ESM, plugins: [react(), tailwindcss()]
```

关键点：`package.json` 必须去掉 `"type": "module"`，否则 Electron 会把 main process 的 CJS 输出当 ESM 加载（`require is not defined in ES module scope`）。Renderer 的 ESM 由 Vite 独立处理，不受影响。

## 浏览器方案：`<webview>` vs BrowserView

### BrowserView 的问题 ★

BrowserView 虽然是 Electron 官方推荐的方案，但它和 Tauri 的 `add_child()` **本质相同**——都是原生窗口叠加层，不是 DOM 元素。

- 手动追踪 placeholder div 的 bounds → IPC 到 main process → `BrowserView.setBounds()`
- ResizeObserver + requestAnimationFrame 保持同步
- 显隐切换需要 `setVisible` → 移出视口
- **Z-order 不可控**：BrowserView 覆盖整个窗口，和 DOM 布局断裂
- 多个 panel 切换时容易重叠、错位

### 最终选择 `<webview>`

`<webview>` 被 Chromium 标记为 deprecated-ish，但在 Electron 中**仍可使用**（需要 `webviewTag: true`）。它是 DOM 元素，CSS 自动布局，不需要任何坐标管理。

BrowserPanel 从 ~130 行（ResizeObserver + 手动 bounds + IPC）缩减到 ~65 行。

**教训**：官方推荐的方案不一定是最好用的方案。优先选和当前架构（HTML/CSS/React）兼容性高的方案。

## node-pty 编译

### 问题链

1. `electron-forge start` 自动运行 `@electron/rebuild` 将 native 模块编译为 Electron ABI
2. node-pty 的 `winpty.gyp` 调用了 `GetCommitHash.bat`，在 node-gyp 的 cwd 下找不到
3. node-pty 默认启用 Spectre 缓解，但 VS Build Tools 缺少 Spectre 库 → `error MSB8040`
4. patch `binding.gyp` 设置 `SpectreMitigation: 'false'`，再删 build 目录重新 gyp
5. 从 VS 2022 Developer Command Prompt 运行 `msbuild binding.sln` 手动编译
6. 最终成功产出 `conpty.node`, `pty.node`, `conpty_console_list.node`

### 编译环境要求

- Visual Studio 2022 Build Tools (winget 安装)
- MSVC v143 工具链 + Windows 10/11 SDK
- Python 3.x (已有)
- git (已有)

### 经验

- node-pty 的 npm prebuild 是为系统 Node.js 编译的，不是 Electron。ABI 一定不匹配。
- 最好在 VS Developer Command Prompt 里手动 rebuild，而不是通过 `electron-rebuild`。
- 如果 Spectre 库缺失，改 `binding.gyp` 的 `SpectreMitigation: 'false'` 跳过。

## PTY 输出重复

### 根因

这是一个和原始 Tauri 代码**完全相同**的 bug 模式（见 [pty-lifecycle.md](./pty-lifecycle.md)）。

Main process 的 `pty:spawn` handler 每次调用都执行 `session.onOutput(cb)`，而 `ensureSession` 是幂等的（返回已有 session）。结果 IPC sender 被重复注册 N 次，每条输出都发送 N 份副本到 renderer。

### 修复

将 output sender 内嵌到 `ensureSession` 的 `onOutput` 回调参数中，**只在 session 创建时绑定**。复用已有 session 时忽略 `onOutput` 参数：

```typescript
ensureSession(id, shell, cwd, rows, cols, onOutput) {
  // existing session: return it, ignore onOutput
  // new session: createSession(id, ..., onOutput) → ptyProcess.onData(onOutput)
}
```

从 EventEmitter 模式改为直接回调，消除 listener 累积。

## Electron 二进制下载

- 默认从 `github.com/electron/releases` 下载，在中国超时
- 设置 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 环境变量使用国内镜像
- 也可以在 `.npmrc` 中添加 `electron_mirror` 配置

## pnpm + Electron Forge

- 需要 `node-linker=hoisted`（`.npmrc` 中设置）
- 需要 `block-exotic-subdeps=false`（Electron Forge 依赖 git 子包）
- `pnpm store prune` 后需要重新 `pnpm approve-builds node-pty electron-winstaller`

## forge.config.ts 要点

```typescript
export default {
  packagerConfig: {
    name: "Glaze",
    executableName: "glaze",
  },
  rebuildConfig: {
    onlyModules: [],  // 跳过自动 rebuild（手动从 VS Dev Cmd 编译 node-pty）
  },
  makers: [new MakerSquirrel({ name: "Glaze" })],
  plugins: [new VitePlugin({
    build: [
      { entry: "src/main/index.ts", config: "vite.main.config.ts", target: "main" },
      { entry: "src/preload/index.ts", config: "vite.preload.config.ts", target: "preload" },
    ],
    renderer: [
      { name: "main_window", config: "vite.renderer.config.ts" },
    ],
  })],
};
```

- `build[].config` 是每个 target 的独立 vite 配置文件名
- `renderer[].name` 对应窗口名
- renderer 不需要设置 `html` 字段

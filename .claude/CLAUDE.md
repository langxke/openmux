# CLAUDE.md — Glaze

> Windows 原生 AI 编程终端，对标 macOS cmux（manaflow-ai/cmux）

## 技术栈

| 层 | 选型 | 版本 |
|----|------|------|
| 桌面壳 | Electron | 42 |
| 前端框架 | React | 19 |
| 语言 | TypeScript | 6.x |
| 构建 | Electron Forge + Vite | 7.x / 8.x |
| UI | Tailwind CSS | 4.x |
| 分屏布局 | dockview | 6.x |
| 终端渲染 | xterm.js | 6.x |
| PTY | node-pty | 1.1 |
| 状态管理 | Zustand | 5.x |
| 包管理 | pnpm | latest |

## 架构决策

### PTY 会话所有权在 Main Process ★

PTY 是 OS 级资源（子进程 + 管道）。React renderer 只负责 xterm.js 的展示绑定，PTY 的创建/销毁由 Electron main process 的 `PtyManager` 管理。

```
Main Process (Electron):
  ptyManager: PtyManager
    sessions: Map<id, PtySession>
    ensureSession(id) → 创建或复用
    releaseSession(id) → 500ms 延迟 kill
    disposeSession(id) → 立即 kill

Renderer (TerminalPanel):
  useEffect:
    glaze.pty.spawn(sid, ...)           ← IPC → main process ensureSession
    glaze.pty.onOutput(sid, callback)   ← IPC channel `pty-output-${sid}`
    return () => glaze.pty.release(sid) ← IPC → main process releaseSession
```

### IPC 通信架构

```
Renderer ←→ Preload (contextBridge) ←→ Main Process (ipcMain.handle)

  pty:*        — PTY 会话管理
  browser:*    — BrowserView 管理
  config:get   — 配置读取
```

### BrowserView 内嵌浏览器

使用 Electron 官方推荐的 BrowserView API（非 `<webview>` 标签）。BrowserView 在 main process 创建，渲染进程通过 placeholder div + ResizeObserver 追踪 bounds，IPC 通知 main process 更新位置。BrowserView 使用 CSS 像素（无需 dpr 乘法）。

### 多 dockview 实例 = cmux workspace

每个 workspace 拥有独立的 `DockviewLayout` 实例。切换 workspace = CSS `display` 切换（隐藏的 PTY 继续运行）。

### 白色主题

- CSS 变量定义在 `src/renderer/index.css`
- dockview 暗色元素通过 `!important` 覆盖
- xterm.js 主题在 `useXTerm.ts` 中硬编码为浅色

### 脚本

```bash
pnpm start        # electron-forge start (dev + HMR)
pnpm package      # electron-forge package (打包为目录)
pnpm make         # electron-forge make (生成 Windows 安装包)
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
```

## Quality Gates

```bash
pnpm typecheck    # TypeScript 类型检查
pnpm lint         # 前端 lint
```

## 关键文件速查

| 文件 | 用途 |
|------|------|
| `src/main/pty-manager.ts` | node-pty 会话管理器（ensure/release/dispose） |
| `src/main/browser-manager.ts` | BrowserView 管理（create/setBounds/destroy） |
| `src/main/index.ts` | BrowserWindow + IPC handlers |
| `src/preload/index.ts` | contextBridge API |
| `src/renderer/lib/glaze-api.ts` | window.glaze 类型化封装 |
| `src/renderer/hooks/useXTerm.ts` | xterm.js 初始化 |
| `src/renderer/components/DockviewLayout.tsx` | 每个 workspace 的 dockview 实例 |
| `src/renderer/components/TerminalPanel.tsx` | xterm.js + PTY session 绑定 |
| `src/renderer/components/BrowserPanel.tsx` | BrowserView 内嵌浏览器 |
| `.claude/notes/pty-lifecycle.md` | PTY 生命周期经验文档 |

## 注意事项

- **PTY 生命周期在 main process 管理**：renderer 通过 IPC 调用，不直接操作 node-pty
- **`terminal.onData()` 返回值必须 dispose**：存在 cleanup 中，否则 StrictMode 下双重注册
- **`onResize` 必须在 `fitAddon.fit()` 之前注册**：否则第一次 resize 丢失
- **`onDidRemovePanel` 在 StrictMode 下也触发**：用 `pty.kill`（main process 内部有 delay-release）
- **`useRef` 值在 StrictMode remount 时保留**：可利用此特性稳定 sessionId
- **dockview 暗色元素需 CSS 覆盖**：`.dv-groupview`, `.dv-tabs-and-actions-container` 硬编码了暗色背景
- **BrowserView 坐标使用 CSS 像素**：getBoundingClientRect 返回值直接传给 setBounds，无需 dpr 乘法

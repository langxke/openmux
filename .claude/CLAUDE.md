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

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+B` | 折叠/展开侧边栏 |
| `Ctrl+N` | 新建终端 |
| `Ctrl+Shift+N` | 新建工作区 |
| `Ctrl+P` | 命令面板 |
| `Ctrl+=` / `Ctrl++` | 放大（终端字号/浏览器缩放） |
| `Ctrl+-` | 缩小 |
| `Ctrl+0` | 重置缩放 |

## Quality Gates

```bash
pnpm typecheck    # TypeScript 类型检查
pnpm lint         # 前端 lint
```

## Commit 规范

- 提交信息必须使用中文描述
- 格式：`<type>: <中文描述>`
- 类型：feat, fix, refactor, docs, test, chore, perf, ci

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
| `.claude/notes/` | 开发经验总结目录（踩坑记录、迁移心得等） |
| `.claude/notes/pty-lifecycle.md` | PTY 生命周期经验文档 |
| `.claude/notes/dockview-integration.md` | dockview 集成经验（右键菜单/光标/拖拽） |
| `.claude/notes/workspace-persistence.md` | 工作区持久化方案 |
| `.claude/notes/ui-interactions.md` | UI 交互经验（拖拽/缩放/字体） |

## 注意事项

- **PTY 生命周期在 main process 管理**：renderer 通过 IPC 调用，不直接操作 node-pty
- **`terminal.onData()` 返回值必须 dispose**：存在 cleanup 中，否则 StrictMode 下双重注册
- **`onResize` 必须在 `fitAddon.fit()` 之前注册**：否则第一次 resize 丢失
- **`onDidRemovePanel` 在 StrictMode 下也触发**：用 `pty.kill`（main process 内部有 delay-release）
- **`useRef` 值在 StrictMode remount 时保留**：可利用此特性稳定 sessionId
- **dockview 暗色元素需 CSS 覆盖**：`.dv-groupview`, `.dv-tabs-and-actions-container` 硬编码了暗色背景
- **BrowserView 坐标使用 CSS 像素**：getBoundingClientRect 返回值直接传给 setBounds，无需 dpr 乘法
- **右键菜单不传 x/y 坐标**：让 `Menu.popup()` 用默认光标位置，手动传反而偏移
- **`-webkit-app-region: drag` 导致双击最大化**：Windows 将拖拽区域的双击解释为窗口最大化，tab 栏需设为 `no-drag`
- **ResizeObserver 必须 rAF 限流**：sidebar 动画期间每帧 resize 会导致 xterm.js 缓冲区内容交错
- **PTY 输出监听器必须在 spawn 前注册**：IPC 监听器晚于 PTY 创建会导致首次输出丢失
- **工作区持久化有启动竞态**：restore 完成前禁止 persist，否则初始状态覆盖已保存的正确状态
- **dockview cursor: grab 需 `!important` 覆盖**：选择器优先级不够

## 参考文档

| 文档 | 链接 |
|------|------|
| dockview API Options | <https://dockview.dev/docs/api/dockview/options> |
| dockview React 组件 Props | `IDockviewReactProps extends DockviewOptions` 见 `node_modules/dockview/dist/esm/dockview/dockview.d.ts` |
| dockview Core Options | `DockviewOptions` 见 `node_modules/dockview-core/dist/esm/dockview/options.d.ts` |

| 笔记 | 内容 |
|------|------|
| `.claude/notes/pty-lifecycle.md` | PTY 生命周期、竞态处理、ResizeObserver 限流、监听器时序 |
| `.claude/notes/dockview-integration.md` | 右键菜单、面板渲染模式、光标覆盖、拖拽区域 |
| `.claude/notes/workspace-persistence.md` | 布局持久化、启动竞态、URL 跟踪、序列化 |
| `.claude/notes/ui-interactions.md` | Sidebar 拖拽、字号缩放、字体、CSS 经验 |

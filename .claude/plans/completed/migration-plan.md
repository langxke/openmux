# Tauri → Electron 迁移方案

> 2026-05-30 | 项目目前仅开发数小时，迁移成本极低

## 迁移动因

Tauri 的 multi-webview（`Window::add_child`）标记为 unstable 超过 2 年，无稳定时间表。内嵌浏览器需要手动管理原生子窗体的坐标、z-order 和显隐，与 HTML 布局完全断裂。Electron 的 `<webview>` 标签是成熟方案——浏览器作为 DOM 元素，CSS 自动布局。详见 `.claude/notes/tauri-experience.md`。

## 技术栈变更

| 层 | 当前 | 迁移后 |
|----|------|--------|
| 桌面壳 | Tauri 2.x (Rust) | Electron |
| PTY | portable-pty (Rust) | node-pty (Node.js) |
| 浏览器 | `add_child()` + 手动坐标 | `<webview>` 标签 |
| React 19 / TypeScript / Vite / Tailwind / dockview / xterm.js / Zustand | **不变** | **不变** |

## 删除

- `src-tauri/` (Rust 后端全部)
- `src/lib/tauri.ts`, `src/lib/ptySessions.ts`, `src/lib/windows.ts` (Tauri IPC 层)
- `@tauri-apps/api` 依赖

## 新增

- `electron/main.ts` — 窗口创建, IPC 注册
- `electron/preload.ts` — contextBridge API
- `electron/pty-manager.ts` — node-pty 会话管理

## 关键代码映射

```typescript
// PTY 创建 — Tauri invoke → 直接调用
// 旧: invoke("pty_spawn", { sessionId, shell, cwd, rows, cols })
// 新: pty.spawn(shell, [], { name: "xterm-256color", cols, rows, cwd, env: process.env })

// PTY 写入
// 旧: invoke("pty_write", { sessionId, data })
// 新: ptyProcess.write(data)

// 浏览器
// 旧: browserCreate(bid, url, x, y, w, h) (~150 行)
// 新: <webview src={url} style={{ width: "100%", height: "100%" }} /> (1 行)

// 配置
// 旧: invoke("get_config")
// 新: JSON.parse(fs.readFileSync(configPath, "utf-8"))
```

## 上下文桥接 API

```typescript
// electron/preload.ts
contextBridge.exposeInMainWorld("glaze", {
  pty: {
    spawn: (...args) => ipcRenderer.invoke("pty:spawn", ...args),
    write: (...args) => ipcRenderer.invoke("pty:write", ...args),
    resize: (...args) => ipcRenderer.invoke("pty:resize", ...args),
    kill: (...args) => ipcRenderer.invoke("pty:kill", ...args),
    onOutput: (id, cb) => {
      const h = (_e, d) => cb(d);
      ipcRenderer.on(`pty-output-${id}`, h);
      return () => ipcRenderer.removeListener(`pty-output-${id}`, h);
    },
  },
  config: {
    get: () => ipcRenderer.invoke("config:get"),
  },
});
```

## Electron 窗口配置

```typescript
const mainWindow = new BrowserWindow({
  width: 1200, height: 800,
  minWidth: 600, minHeight: 400,
  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,
    nodeIntegration: false,
    webviewTag: true,   // ← 启用 <webview>
  },
});
```

## 保留不变

React 组件层 (`App.tsx`, `DockviewLayout.tsx`, `TerminalPanel.tsx`, `Sidebar.tsx`, `CommandPalette.tsx`)、`useXTerm.ts`、stores、样式、dockview 配置 — **全部无需改动**。仅 `TerminalPanel.tsx` 中的 IPC 调用需要切换到 preload API。

## 迁移步骤

### Phase 1: Electron 壳
1. `pnpm add -D electron electron-builder concurrently wait-on`
2. `pnpm add node-pty`
3. 创建 `electron/main.ts`、`electron/preload.ts`
4. 删除 `src-tauri/`，删除 `@tauri-apps/api`
5. 验证：窗口打开，React 正常渲染

### Phase 2: PTY
1. 实现 `electron/pty-manager.ts`
2. 注册 IPC handlers，重写前端 IPC 调用
3. 验证：终端启动、输入输出、resize

### Phase 3: 浏览器
1. `BrowserPanel.tsx` 用 `<webview>` 重写（~40 行）
2. 验证：网页加载、切 tab 显隐

### Phase 4: 清理
1. 配置迁移、类型检查、打包配置
2. 删除不再需要的 Tauri IPC 代码

### 预估工期: 2-4 天

## 风险

| 风险 | 缓解 |
|------|------|
| node-pty 编译 (Windows) | prebuild 版本 |
| 包体积 150MB | 对标 wmux，可接受 |
| `<webview>` 未来可能废弃 | Electron 推荐 BrowserView 替代，后续可迁移 |

## 参考

- wmux (openwong2kim): Electron + xterm.js + `<webview>` + ConPTY 已验证方案
- https://www.electronjs.org/docs
- https://github.com/microsoft/node-pty

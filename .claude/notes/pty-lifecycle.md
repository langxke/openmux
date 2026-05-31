# PTY 生命周期管理经验

## 核心原则：PTY 会话的所有权不应属于 React 生命周期

React 组件负责**展示绑定**（打开/关闭 xterm.js），不负责**进程管理**（创建/销毁 PTY）。

PTY 是一个操作系统级资源（子进程 + 管道），其生命周期应该比 React 的 mount/unmount 周期更长。将两者绑定在一起会导致 StrictMode、快速切换 tab 等场景下出现竞态。

## 问题：React StrictMode + 异步 PTY spawn

### 现象
- 终端输出重复（PowerShell banner 出现多次）
- 打字显示双字符（输入 "1" → "11"）
- 光标位置错乱

### 根因
`spawnPty()` 返回 Promise（调用 Tauri IPC），`.then()` 链中注册的监听器跨越了 StrictMode 的清理边界：

```
t0: mount → spawnPty() ← Promise 开始
t1: StrictMode cleanup → unlistenRef?.() ← null（Promise 未 resolve）
t2: StrictMode remount → spawnPty() ← 第二个 Promise
t3: Promise A resolve → 监听器 A 注册 ← 泄露！
t4: Promise B resolve → 监听器 B 注册
t5: PTY 输出 → A、B 同时触发 → write() 被调两次
```

关键问题：清理时 listener 还不存在（Promise 未 resolve），清理完毕后旧 Promise 才 resolve 并注册新 listener。

## 解决方案：Module-level Session Manager

参考 terax-ai 的架构，将 PTY 会话管理移到模块级单例 Map。

### 架构

```
┌─ Module-level (React 外部) ──────────────────────┐
│  sessions: Map<id, PtySession>                    │
│  releaseTimers: Map<id, Timer>                    │
│                                                   │
│  ensureSession(id) → 创建或返回已有 session        │
│  releaseSession(id) → 500ms 延迟 kill              │
│  disposeSession(id) → 立即 kill                    │
└────────────────────┬─────────────────────────────┘
                     │
┌─ React (TerminalPanel) ──────────────────────────┐
│  useEffect:                                       │
│    s = ensureSession(id)  ← 复用或创建            │
│    s.ready.then(() => bind output to xterm.js)    │
│    return () => { releaseSession(id) }            │
└──────────────────────────────────────────────────┘
```

### 关键机制

**1. `useRef` 稳定 sessionId**

React 18+ StrictMode 会保留 ref 的值。利用这一点，DockviewLayout 中用 `useRef` 存储 sessionId：

```tsx
const initialSidRef = useRef<string | null>(null);
// StrictMode remount 时 ref 值不变，不会生成新 ID
if (!initialSidRef.current) initialSidRef.current = createTerminalId();
```

**2. 延迟释放 (releaseSession)**

```
StrictMode unmount → releaseSession(id) → 启动 500ms 倒计时
StrictMode remount → ensureSession(id) → 取消倒计时，返回已有 session
真正关闭        → releaseSession(id) → 500ms 后 kill PTY
```

延迟时间必须大于 StrictMode 的 remount 间隔（通常 < 100ms）。

**3. ensureSession 幂等**

同 ID 多次调用返回同一个 session 对象。PTY spawn 只执行一次，后续调用直接复用。

## xterm.js 集成要点

### onData 必须 dispose
`terminal.onData(cb)` 返回 `IDisposable`。必须在 effect cleanup 中 dispose，否则 StrictMode 下会重复注册。

### onResize 必须在 fit() 之前注册
`fitAddon.fit()` 触发 resize 事件。如果 `onResize` 在 `fit()` 之后注册，第一次 resize 事件丢失，PTY 尺寸不匹配。

### allowProposedApi 谨慎使用
xterm.js 6.x 中此选项可能改变输入处理行为，非必需建议关闭。

## dockview 集成要点

### onDidRemovePanel 在 StrictMode 下也会触发
StrictMode unmount 时 dockview 会销毁所有 panel，触发 `onDidRemovePanel`。不能用此事件做"用户关闭"判断。应用 `releaseSession`（延迟）而非 `disposeSession`（立即）。

### 多 workspace 架构
多个 workspace = 多个 `DockviewLayout` 实例。每个实例有独立的 dockview 和 PTY session。隐藏 workspace 的 PTY 继续运行（通过 `display:none` 隐藏而非卸载）。

## Electron 迁移后的差异 (2026-05-31)

迁移到 Electron 后，会话管理器移至 main process (`src/main/pty-manager.ts`)，架构相同但细节变化：

- **spawn 变为同步**：`pty.spawn()` 立即返回，不再需要 `session.ready` 异步等待
- **output 从 Tauri event → Electron IPC**：main process 通过 `mainWindow.webContents.send(pty-output-${id})` 推送，renderer 通过 `ipcRenderer.on()` 接收
- **output 回调必须幂等**：`ensureSession` 的 `onOutput` 参数仅在 session 创建时绑定。复用已有 session 时忽略该参数，否则输出会被重复发送 N 次（和原 Tauri 的 `onPtyOutput` 重复注册是同一类 bug）
- **delay-release 仍然有效**：StrictMode 的双重 mount/unmount 问题在 Electron 下同样存在，500ms 计时器继续工作

详见 `.claude/notes/electron-migration.md`。

## 参考

- terax-ai: `src/modules/terminal/lib/useTerminalSession.ts` — 模块级 Map + ensureSession 模式
- xterm.js 类型定义: `typings/xterm.d.ts` — onData/onResize 返回 IDisposable
- React StrictMode 文档: ref 值在 remount 时保留

## PTY 输出监听器必须在 spawn 之前注册 (2026-05-31)

### 现象
新建终端后无任何输出，光标停留在 (1,1)。改变窗口大小后才出现内容。

### 根因
React effect 执行顺序：子组件 effect（`useXTerm`）先于父组件 effect（`TerminalPanel`）。

```
1. useXTerm effect: fitAddon.fit() → onResize → handleResize → pty.spawn(...) → IPC 创建 PTY
2. TerminalPanel effect: pty.onOutput(sid, cb) ← 注册 IPC 监听器
```

PTY 在步骤 1 创建后立即开始输出（PowerShell banner），但步骤 2 的 IPC 监听器尚未注册，数据丢失。后续 resize 触发新输出时才可见。

### 解决方案
1. 在 render 阶段提前注册监听器（`if (!offOutputRef.current)` guard 确保只注册一次）
2. effect 中先 `offOutputRef.current?.()` + 重新注册，再调 `pty.spawn`

```tsx
// Render phase — 在任何 effect 之前执行
if (!offOutputRef.current) {
  offOutputRef.current = glaze().pty.onOutput(sid, cb);
}

useEffect(() => {
  // 重新注册（deps 变化时确保监听器在 spawn 之前就位）
  offOutputRef.current?.();
  offOutputRef.current = glaze().pty.onOutput(sid, cb);
  glaze().pty.spawn(sid, shell, cwd, 0, 0);
  return () => { offOutputRef.current?.(); offOutputRef.current = null; glaze().pty.release(sid); };
}, [sessionId, shell, cwd]);
```

## ResizeObserver 必须用 rAF 限流 (2026-05-31)

### 现象
折叠/展开 sidebar 时（`transition-all duration-200`），终端内容出现重复/交错：
```
Windows PowerShell
Copyright (C) Microsoft Corporation. All rights reserveWindows PowerShell
Copyright (C) Microsoft Corporation. All rights reserved. tall the latest PowerShell...
```

### 根因
Sidebar 200ms CSS 过渡期间，终端容器每帧都在 resize。`ResizeObserver → fitAddon.fit() → onResize → pty.spawn/pty.resize` 在 200ms 内触发 ~12 次。PTY 反复 resize 导致 shell 重绘输出在 xterm.js 缓冲区中交错。

### 解决方案
ResizeObserver 回调用 `requestAnimationFrame` 限流，每帧最多调用一次 `fit()`：

```ts
let rafId: number | null = null;
const resizeObserver = new ResizeObserver(() => {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    fitAddon.fit();
  });
});
// cleanup 中 cancelAnimationFrame(rafId)
```

## handleResize 用 pty.spawn 代替 pty.resize (2026-05-31)

### 问题
`handleResize` 只调 `pty.resize` 时，如果 resize 事件在 session 创建之前触发，resize 是空操作。后续 session 创建用错误尺寸。

### 解决方案
`handleResize` 调 `pty.spawn(sid, shell, cwd, rows, cols)`，利用 `ensureSession` 的幂等性——session 不存在就创建（正确尺寸），存在就 resize。

## effect 中 pty.spawn 传 0 尺寸避免覆盖 (2026-05-31)

### 问题
TerminalPanel effect 中 `pty.spawn(sid, shell, cwd, 24, 80)` 硬编码尺寸。如果 `handleResize`（来自 `useXTerm` effect）先用正确尺寸创建了 session，effect 随后调用会因 `ensureSession` 的 resize 逻辑把尺寸改回 24x80。

### 解决方案
- effect 传 `(0, 0)` 表示"只确保 session 存在，不要 resize"
- `ensureSession`: `if (rows > 0 && cols > 0 && ...) this.doResize(...)`
- `createSession`: `cols: cols > 0 ? cols : 80` 兜底

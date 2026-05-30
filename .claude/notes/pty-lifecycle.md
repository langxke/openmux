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

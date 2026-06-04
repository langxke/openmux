# React StrictMode 导致 PTY 输出重复和输入双字符

## 症状

- 终端输出重复（PowerShell banner 出现多次）
- 打字显示双字符（输入 "1" 显示 "11"）
- 光标位置错乱

## 根因

`spawnPty()` 返回 Promise，`.then()` 链中注册的监听器跨越了 React StrictMode 的清理边界：

```
t0: mount → spawnPty() ← Promise 开始
t1: StrictMode cleanup → unlistenRef?.() ← null（Promise 未 resolve）
t2: StrictMode remount → spawnPty() ← 第二个 Promise
t3: Promise A resolve → 监听器 A 注册 ← 泄露！
t4: Promise B resolve → 监听器 B 注册
t5: PTY 输出 → A、B 同时触发 → write() 被调两次
```

关键：cleanup 时 listener 还不存在（Promise 未 resolve），清理完毕后旧 Promise 才 resolve 并注册新 listener，导致两个监听器同时存活。

## 诊断方法

1. 在开发环境启用 StrictMode（`<React.StrictMode>`）
2. 创建新终端，观察输出是否重复
3. 在 `onData` 回调中加 `console.log`，确认是否被调用多次

## 修复步骤

将 PTY 会话管理移到 React 组件外部（模块级单例 Map），利用 `useRef` 在 StrictMode remount 时保持 sessionId 不变：

```ts
// src/main/pty-manager.ts — 模块级（非 React 组件内）
class PtyManager {
  sessions: Map<string, PtySession> = new Map();
  releaseTimers: Map<string, Timer> = new Map();

  ensureSession(id) { /* 创建或返回已有 session */ }
  releaseSession(id) { /* 500ms 延迟 kill */ }
  disposeSession(id) { /* 立即 kill */ }
}
```

```tsx
// DockviewLayout.tsx
const initialSidRef = useRef<string | null>(null);
// StrictMode remount 时 ref 值不变
if (!initialSidRef.current) initialSidRef.current = createTerminalId();
```

```tsx
// TerminalPanel.tsx
useEffect(() => {
  glaze().pty.spawn(sid, shell, cwd, 0, 0);
  return () => glaze().pty.release(sid);
}, [sessionId, shell, cwd]);
```

关键机制：
- **延迟释放**：`releaseSession` 启动 500ms 倒计时，`ensureSession` 在同一 ID 再次调用时取消倒计时。延迟时间必须大于 StrictMode 的 remount 间隔（通常 < 100ms）
- **ensureSession 幂等**：同 ID 多次调用返回同一个 session，PTY spawn 只执行一次

## 失败尝试

- 在 React 组件内直接管理 PTY 生命周期：StrictMode 双重挂载/卸载导致竞态不可避免
- 缩短延迟时间（< 100ms）：可能因慢机器上的 StrictMode remount 间隔过长而失效

## 关键约束

- `useRef` 在 React 18+ StrictMode remount 时保留值，这是方案可行的前提
- 延迟释放时间必须 > StrictMode remount 间隔（建议 500ms）
- `terminal.onData()` 返回 `IDisposable`，必须在 effect cleanup 中 dispose
- dockview 的 `onDidRemovePanel` 在 StrictMode 下也会触发，不能用于判断"用户关闭"

## 原理

将 PTY 生命周期从 React 组件树中提升到模块级，使得 React 的挂载/卸载周期不再直接影响 PTY 创建/销毁。`useRef` 跨 StrictMode remount 保持引用是 React 的保证行为。延迟释放通过简单的计时器机制在 StrictMode cleanup→remount 间隙中保护 session。

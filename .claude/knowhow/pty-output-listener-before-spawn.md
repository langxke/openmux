# PTY 输出监听器必须在 spawn 之前注册

## 症状

新建终端后无任何输出，光标停留在 (1,1)。改变窗口大小后才出现内容。

## 根因

React effect 执行顺序：子组件 effect（`useXTerm`）先于父组件 effect（`TerminalPanel`）。

```
1. useXTerm effect: fitAddon.fit() → onResize → handleResize → pty.spawn(...) → 创建 PTY
2. TerminalPanel effect: pty.onOutput(sid, cb) ← 注册 IPC 监听器
```

PTY 在步骤 1 创建后立即开始输出（PowerShell banner），但步骤 2 的 IPC 监听器尚未注册，初始输出数据丢失。后续 resize 触发新输出时内容才可见。

## 诊断方法

1. 新建终端，观察是否有初始输出（PowerShell banner）
2. 在 `onOutput` 回调中加 `console.log`
3. 观察日志是否在终端创建后才出现——如果是，说明监听器延后注册

## 修复步骤

在 React render 阶段（非 effect）提前注册监听器：

```tsx
// TerminalPanel.tsx

// Render phase — 在任何 effect 之前执行
if (!offOutputRef.current) {
  offOutputRef.current = glaze().pty.onOutput(sid, cb);
}

useEffect(() => {
  const sid = sessionRef.current;

  // 重新注册（deps 变化时确保监听器在 spawn 之前就位）
  offOutputRef.current?.();
  offOutputRef.current = glaze().pty.onOutput(sid, (data) => {
    writeRef.current(data);
  });

  glaze().pty.spawn(sid, shell, cwd, 0, 0);

  return () => {
    offOutputRef.current?.();
    offOutputRef.current = null;
    glaze().pty.release(sid);
  };
}, [sessionId, shell, cwd]);
```

## 失败尝试

无。

## 关键约束

- `offOutputRef` 的 guard（`if (!offOutputRef.current)`）确保 render 阶段的注册只执行一次
- render 阶段注册的监听器必须能在 effect cleanup 中正确移除
- 在 Tauri 版本中同样存在此问题（Rust reader 线程先启动），说明这不是框架特有问题，而是异步 spawn + 监听器注册的通用时序问题

## 原理

React 的 render 阶段在所有组件的 effect 之前同步执行。将监听器注册移到 render 阶段确保它在第一个 effect（触发 `fitAddon.fit()` → `handleResize` → `pty.spawn`）之前完成。监听器在 PTY 创建时已存在，不会丢失任何输出。

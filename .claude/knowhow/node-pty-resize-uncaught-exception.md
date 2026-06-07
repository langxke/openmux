# node-pty resize 竞态导致 Electron 主进程崩溃

## 症状

Electron 应用在打开/关闭终端面板时弹出 "Uncaught Exception" 错误对话框：

```
Uncaught Exception:
at WindowsPtyAgent.resize (windowsPtyAgent.js:121)
at WindowsTerminal.<anonymous> (windowsTerminal.js:130)
at Object.run (windowsTerminal.js:50)
...
Error: Cannot resize a pty that has already exited
```

应用窗口可以显示，但持续触发该错误直至进程退出。

## 根因

node-pty 的 `resize()` 方法内部使用 `_deferNoArgs` 机制延迟到下一个 tick 执行。当 PTY 进程在 resize 调用和实际执行之间退出时（例如终端面板关闭触发了 PTY kill，但 resize 事件已被排队），延迟的 resize 发现 PTY 已销毁，抛出异常。

代码层面的两个缺口：

1. `pty-manager` 的 `ensureSession()` 复用已有 session 时，未检查 `state === "exited"`，可能对已销毁的 session 调用 `doResize()`
2. `doResize()` 中没有 try-catch，即使 `resize()` 方法做了状态检查，PTY 也可能在检查通过后、resize 执行前的极短窗口内退出

## 诊断方法

1. 在 Electron 打包后的应用中重现：打开/关闭多个终端面板
2. 如果看到 `Cannot resize a pty that has already exited`，即为此问题
3. 关键特征：错误堆栈显示 `windowsTerminal.js` 的 `_deferNoArgs` / `run` 调用链，而非直接调用 `resize`

## 修复步骤

两处修改，均在 `src/main/pty-manager.ts`：

**修复 1：`ensureSession()` 中检测已退出 session**

```typescript
const existing = this.sessions.get(id);
if (existing) {
  if (existing.state === "exited") {
    this.sessions.delete(id);  // 丢弃已退出 session，让后续逻辑新建
  } else {
    if (existing.state === "releasing") {
      existing.state = "ready";
    }
    if (rows > 0 && cols > 0 && (existing.cols !== cols || existing.rows !== rows)) {
      this.doResize(existing, rows, cols);
    }
    return existing;
  }
}
```

**修复 2：`doResize()` 加 try-catch 兜底**

```typescript
private doResize(session: PtySession, rows: number, cols: number): void {
  try {
    session.ptyProcess.resize(cols, rows);
    session.cols = cols;
    session.rows = rows;
  } catch {
    // PTY already exited between check and resize — ignore
  }
}
```

**修复 3：主进程全局 uncaughtException 兜底（`src/main/index.ts`）**

node-pty 内部的 `_deferNoArgs` 队列不在应用代码的 try-catch 范围内，需要全局兜底：

```typescript
process.on("uncaughtException", (error) => {
  if (error instanceof Error && error.message?.includes("pty that has already exited")) {
    return; // harmless race — suppress
  }
  console.error(error);
});
```

## 失败尝试

- 仅在 `resize()` 方法中检查 `state !== "exited"` — 不够，因为 node-pty 内部 `_deferNoArgs` 延迟执行时 PTY 可能已退出
- 仅在 `doResize()` 中加 try-catch — 不够，因为 node-pty 内部延迟队列的异常会冒泡为 uncaught exception

## 关键约束

- node-pty 的 `_deferNoArgs` 是内部实现细节，无法从外部禁用或修改
- 全局 `uncaughtException` 只应静默忽略 PTY resize 竞态这一种已知无害的情况，其他异常仍需打印日志
- `ensureSession` 中丢弃已退出 session 后，后续逻辑会走 `createSession` 重建，确保终端仍可使用

## 原理

node-pty 的 `resize()` 不是同步执行的 — 它通过 `_deferNoArgs` 将实际 resize 操作推迟到 nextTick，以确保 IO 操作批量处理。当终端面板被移除时，React 组件发送 resize 事件（清理 state），同时触发 PTY release。两者在事件循环中交错执行，导致 resize 的回调在 PTY 销毁后才被处理。三层防护覆盖了所有可能的执行路径：应用层的状态检查、应用层的 try-catch、以及全局兜底。

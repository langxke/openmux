# ResizeObserver 在 CSS 过渡期间导致终端内容交错

## 症状

折叠/展开 sidebar 时（`transition-all duration-200`），终端内容出现重复和交错：

```
Windows PowerShell
Copyright (C) Microsoft Corporation. All rights reserveWindows PowerShell
Copyright (C) Microsoft Corporation. All rights reserved. tall the latest PowerShell...
```

## 根因

Sidebar 200ms CSS 过渡期间，终端容器每帧都在 resize。`ResizeObserver → fitAddon.fit() → onResize → pty.spawn/pty.resize` 在 200ms 内触发约 12 次。PTY 反复 resize 导致 shell 重绘输出在 xterm.js 缓冲区中交错叠加。

## 诊断方法

1. 在 `fitAddon.fit()` 调用前后加 `console.log`
2. 拖拽 sidebar 或折叠/展开它
3. 观察日志——如果在一次交互中 `fit()` 被调用了 10+ 次，确认此问题

## 修复步骤

ResizeObserver 回调用 `requestAnimationFrame` 限流：

```ts
let rafId: number | null = null;
const resizeObserver = new ResizeObserver(() => {
  if (rafId !== null) return;  // 已有待处理的 resize
  rafId = requestAnimationFrame(() => {
    rafId = null;
    fitAddon.fit();
  });
});
resizeObserver.observe(containerElement);

// cleanup
return () => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  resizeObserver.disconnect();
};
```

## 失败尝试

- **debounce**：用 `setTimeout` 延迟执行 resize，但 setTimeout 的最小延迟（~4ms）在 60fps 下仍可能堆积
- **直接去掉 CSS 过渡**：sidebar 动画生硬，用户体验差

## 关键约束

- `requestAnimationFrame` 保证每帧最多执行一次 `fit()`，天然匹配显示器刷新率
- 必须在 cleanup 中 `cancelAnimationFrame`，防止组件卸载后回调执行
- `onResize` 必须在 `fitAddon.fit()` 之前注册，否则第一次 resize 事件丢失

## 原理

CSS 过渡在每帧改变元素尺寸，ResizeObserver 在每帧尺寸变化后同步触发。通过 rAF 将多个 ResizeObserver 回调合并为一次 `fit()` 调用，确保在过渡期间只做一次 resize，而非 12 次。

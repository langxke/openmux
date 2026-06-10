---
title: "xterm.js resize 期间 PTY 输出导致光标跟踪错乱"
date: 2026-06-10
category: ui-bugs
module: useXTerm
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "终端 resize 后光标跳跃到错误行，不再位于命令提示符末尾"
  - "resize 期间到达的 PTY 输出与 xterm 内部 cursor reflow 产生内容交错"
  - "sidebar 拖拽动画期间快速连续 resize 导致缓冲区内容重复或乱码"
  - "PowerShell 启动时提示符排版异常（初始 spawn 尺寸为 0）"
root_cause: async_timing
resolution_type: code_fix
severity: high
tags: [xtermjs, pty, resize, cursor, reflow, output-buffering, resizeobserver, dom-renderer]
---

# xterm.js resize 期间 PTY 输出导致光标跟踪错乱

## Problem

容器尺寸变化时 xterm.js 通过 `fitAddon.fit()` 调整虚拟 buffer 行列数，但此过程中 PTY 仍在持续推送输出——xterm.js 在 buffer 重建的同时接收 `terminal.write()`，导致内部 `cursorY`/`cursorX` 基于旧的 buffer layout 计算出错误位置，光标错位到文本之前或跳跃到其他行。

## Symptoms

- 拖拽 resize 终端面板后，光标位置偏移，不再在命令提示符末尾
- resize 后输入字符出现在错误位置（如插入到前一行文本中间）
- sidebar 动画期间快速连续 resize 时 xterm.js 缓冲区内容交错
- PowerShell 启动时尺寸为 `(0, 0)`，shell 认为终端无宽度，提示符乱码

## What Didn't Work

1. **切换为 WebGL 渲染器** — 移除 `@xterm/addon-webgl` 后问题未消失，WebGL 不是根因
2. **仅 ResizeObserver rAF 限流** — 上轮修复加上了 `requestAnimationFrame` 去抖，但只解决了"内容交错"问题，未解决 resize 与 write 之间的同步竞态
3. **关闭 `reflowCursorLine`** — xterm.js 6.x 的这个选项对 idle 光标对齐是必需的，不开启时光标不会重新对齐

## Solution

核心思路：**resize 期间暂停写入 xterm.js，将 PTY 输出缓冲到数组，resize 完成后一次性刷新并强制重绘**。四重保护：

### 1. write() 函数门控

```typescript
// useXTerm.ts — write callback
const resizingRef = useRef(false);
const outputBufferRef = useRef<string[]>([]);

const write = useCallback((data: string) => {
  if (resizingRef.current) {
    outputBufferRef.current.push(data);
    return;
  }
  terminalRef.current?.write(data);
}, []);
```

### 2. ResizeObserver 回调中的缓冲保护

```typescript
// useXTerm.ts — ResizeObserver 回调
const resizeObserver = new ResizeObserver(() => {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    resizingRef.current = true;
    fitAddon.fit();
    requestAnimationFrame(() => {
      resizingRef.current = false;
      const buffered = outputBufferRef.current;
      outputBufferRef.current = [];
      if (buffered.length > 0) {
        terminal.write(buffered.join(""));
      }
      terminal.refresh(0, terminal.rows - 1);
      terminal.scrollToBottom();
    });
  });
});
```

### 3. 字号变化 effect 同样缓冲 + 卸载 drain

```typescript
// useXTerm.ts — fontSize effect
useEffect(() => {
  // ...
  resizingRef.current = true;
  terminal.options.fontSize = options.fontSize;
  const predicted = fitAddon.proposeDimensions();
  if (predicted && predicted.cols > 0 && predicted.rows > 0) {
    onResizeRef.current?.(predicted.cols, predicted.rows);
  }
  fitAddon?.fit();

  requestAnimationFrame(() => {
    resizingRef.current = false;
    // flush buffer...
    terminal.refresh(0, terminal.rows - 1);
    terminal.scrollToBottom();
  });

  return () => {
    // 卸载时 drain 缓冲数据，防止丢失
    resizingRef.current = false;
    const buffered = outputBufferRef.current;
    outputBufferRef.current = [];
    if (buffered.length > 0) {
      terminal.write(buffered.join(""));
    }
  };
}, [options.fontSize]);
```

### 4. Terminal 构造选项修复

```typescript
// useXTerm.ts — Terminal 构造
const terminal = new Terminal({
  fontSize: options.fontSize ?? 14,
  fontFamily: options.fontFamily ?? DEFAULT_FONT,
  theme: options.theme ?? LIGHT_THEME,
  cursorBlink: true,
  cursorStyle: "bar",
  allowTransparency: false,
  reflowCursorLine: true,  // xterm 6.0: idle 时光标自动对齐
});
```

### 辅助修复：PTY 初始尺寸与 resize 发送

```typescript
// TerminalPanel.tsx — spawn 时给合理默认值
om.pty.spawn(sid, shell, cwd, 80, 24);  // 80x24 而非 (0,0)

// TerminalPanel.tsx — handleResize: 立即发送 + 100ms 尾部保障
const handleResize = useCallback((cols: number, rows: number) => {
  if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
  om.pty.resize(sessionRef.current, rows, cols);
  resizeTimerRef.current = setTimeout(() => {
    resizeTimerRef.current = null;
    om.pty.resize(sessionRef.current, rows, cols);
  }, 100);
}, [om.pty]);
```

## Why This Works

xterm.js 的 `fit()` 调用会销毁并重建内部行 buffer。如果重建过程中有 `terminal.write()` 插入，xterm 内部维护的 `cursorY`/`cursorX` 基于旧的 buffer layout 计算——得到的位置可能在文本之前或其他错误的行。

缓冲方案在 resize 期间**完全隔离了外部写入**，确保 xterm 在 buffer 稳定后才收到数据。两帧 rAF 的时序：第一帧完成 `fit()`（buffer 重建），第二帧等待 xterm 内部状态稳定 → flush 缓冲 → `refresh()` 全屏强制重绘 → `scrollToBottom()` 确保光标可见。

## Prevention

- xterm.js 的所有 `fit()` 调用点都应设置输出门控（ResizeObserver、字号变化、手动 fit）
- `terminal.write()` 不应直接调用，应通过受控 wrapper（`useXTerm` 返回的 `write` 函数内置门控检查）
- cleanup 中 drain 缓冲数据：组件卸载时若 `resizingRef` 仍为 true，必须在 return cleanup 中 flush 缓冲
- PTY spawn 时传合理的默认尺寸（80x24），避免 shell 以零宽启动

## Related

- xterm.js issue #3486: WebGL 字体切换渲染伪影 → 改用 DOM renderer
- xterm.js issue #5295: cursorY 追踪 bug → upstream 已在 PR #5522 修复，等 v7.0.0
- `.claude/notes/pty-lifecycle.md` — PTY 生命周期经验（spawn(0,0) 建议已过时，应改为 80x24）
- `.claude/knowhow/resizeobserver-raf-throttle.md` — rAF 限流（本方案在此基础上增加了输出缓冲层）

# Electron webview 内 Ctrl+=/- 快捷键无法缩放页面

## 症状

在 Electron `<webview>` 内部获得焦点时，按 Ctrl+=、Ctrl+-、Ctrl+0 无法缩放页面内容。但在 webview 外部的 URL 地址栏中按这些快捷键可以正常触发缩放。

## 根因

当 webview 内容区获得焦点时，键盘事件直接进入嵌入的 Chromium 渲染进程，宿主 React 页面的 `window.addEventListener("keydown", ...)` 完全收不到这些事件。只有 webview 内部的 preload 脚本或 main process 的 `before-input-event` 能够拦截。

## 诊断方法

1. 在 webview 的 preload 脚本中加 `console.log`，确认 preload 是否加载成功
2. 在 webview 控制台（右键 → 检查元素）查看是否有 preload 日志
3. 如果 preload 未加载，检查 Electron 的 sandbox 策略是否阻止了 preload 执行

## 修复步骤

在 main process 的 `did-attach-webview` 回调中注册 `before-input-event` 监听器：

```ts
// src/main/index.ts
mainWindow.webContents.on("did-attach-webview", (_event, wc) => {
  wc.on("before-input-event", (event, input) => {
    if (!input.control) return;
    if (input.key === "=" || input.key === "+") {
      event.preventDefault();
      const current = wc.getZoomLevel();
      wc.setZoomLevel(Math.min(5, current + 0.5));
    } else if (input.key === "-") {
      event.preventDefault();
      const current = wc.getZoomLevel();
      wc.setZoomLevel(Math.max(-5, current - 0.5));
    } else if (input.key === "0") {
      event.preventDefault();
      wc.setZoomLevel(0);
    }
  });

  // ... 其他 webview 事件处理
});
```

## 失败尝试

- **preload + `sendToHost` IPC**：preload 脚本未加载（控制台无日志），可能因 Electron 42 的 webview 默认 sandbox 策略或 preload 编译配置问题导致
- **preload + `ipcRenderer.send` 到 main process**：同样因 preload 未加载而失效
- **`executeJavaScript` 注入 CSS zoom**：CSS zoom 与 Chromium 原生 zoom 机制不同，且需要每次导航后重新注入
- **React 组件级 `onKeyDown`**：只能处理 webview 外部的键盘事件，无法触及 webview 内容区

## 关键约束

- `before-input-event` 是 main process 的 API，修改后需要**完全重启 Electron 应用**（不热更新）
- zoom level 范围限制在 -5 到 5，步进 0.5，与 Chromium 默认行为一致
- `event.preventDefault()` 阻止 Chromium 的默认缩放行为，改由代码手动控制

## 原理

`before-input-event` 在 Chromium 的输入事件管道中位于最前端——按键事件在分发到渲染进程之前先经过此钩子。通过在 main process 拦截 Ctrl+=/-/0 并直接操作 `webContents.setZoomLevel()`，完全绕过了 webview 内部焦点导致的键盘事件隔离问题。

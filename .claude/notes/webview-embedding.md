# Webview 内嵌浏览器

> 2026-05-31 | webview / WebContentsView / preload / 缩放

## webview vs WebContentsView

| | `<webview>` | `WebContentsView` |
|---|---|---|
| 布局 | DOM 元素，CSS 自动布局 | 原生视图，手动 `setBounds` |
| 位置同步 | 自动 | 需要 ResizeObserver + rAF 轮询 |
| 进程隔离 | 独立进程 | 独立进程 |
| 键盘事件 | 不冒泡到宿主 | 不冒泡到宿主 |
| Electron 状态 | 已弃用但可用 | 当前推荐 |

**结论**：嵌入灵活布局（dockview 分屏、侧边栏拖拽）时用 `<webview>`。WebContentsView 的坐标轮询太 hack，只适合固定面板。

## 缩放快捷键

webview 的 Chromium 默认不启用缩放快捷键。`before-input-event` 不存在于 webview API。

**最终方案**：preload 脚本注入

```
src/preload/webview.ts
  → window.addEventListener('keydown', ...) 拦截 Ctrl+=/-/0
  → ipcRenderer.sendToHost('zoom', level)
  → 宿主 webview.addEventListener('ipc-message') 接收
  → webview.setZoomLevel(level)
```

## preload 加载时机

关键踩坑：preload 路径通过异步 IPC 获取时，首次渲染 `preloadPath` 为 null，webview 没有 preload 就加载了页面，后续再设置 preload 属性不生效。

**解决方案**：preload 路径就绪前不渲染 webview 元素。

```tsx
{preloadPath ? <webview preload={preloadPath} src={url} /> : <div />}
```

## forge 构建配置

webview preload 需要额外构建入口：

```typescript
// forge.config.ts
{
  entry: "src/preload/webview.ts",
  config: "vite.webview.config.ts",
  target: "preload",
}
```

## 页面标题同步

```typescript
wv.addEventListener("page-title-updated", (e) => {
  api.setTitle(e.title);
});
```

# Electron webview 内 target="_blank" 链接点击无反应

## 症状

在 Electron `<webview>` 中点击带有 `target="_blank"` 的链接或通过 `window.open()` 打开的链接时，没有任何反应——不导航、不弹窗、无错误提示。特别是必应首页"发现"模块等 Web Component 内部的链接完全无法点击。

## 根因

三层原因叠加：

1. **Chromium 层**：`<webview>` 默认不启用弹窗，所有 `target="_blank"` 和 `window.open()` 被 Chromium 静默拦截，主进程的 `setWindowOpenHandler` 也不会被调用。

2. **JS 拦截层**：即使在 preload 中覆盖了 `window.open`，Web Component（如必应的 `BING-HOMEPAGE-FEED`）可能在 preload 执行前就缓存了原生 `window.open` 引用，导致 patch 无效。

3. **Electron API 差异**：Electron 42 的 `setWindowOpenHandler` 只支持 `action: 'allow' | 'deny'`，不支持 `'navigate'`（该 action 属更高版本）。

## 诊断方法

1. 在 preload 中添加 `console.log` 监控所有 click 事件和 `window.open` 调用
2. 在 main process 的 `setWindowOpenHandler` 中加日志，确认是否被调用及其返回的 URL
3. 检查点击目标的 tag 名称（必应"发现"模块输出的 `BING-HOMEPAGE-FEED a? false` 说明它是 Web Component，未使用标准 `<a>` 标签）

## 修复步骤

需要**三层配合**修复：

### 第一层：webview 标签启用弹窗

```tsx
// src/renderer/components/BrowserPanel.tsx
<webview
  allowpopups="true"  // 必须，否则 setWindowOpenHandler 不会被调用
  ...
/>
```

### 第二层：preload 脚本拦截标准链接

```js
// src/preload/webview.ts
var TOP = window;

// 覆盖 window.open，重定向到当前页
function patchWindow(win) {
  var nativeOpen = win.open.bind(win);
  win.open = function (url, target, features) {
    if (url && typeof url === "string" && url.length > 0 && !url.startsWith("javascript:")) {
      TOP.location.href = url;
      return null;
    }
    return nativeOpen(url, target, features);
  };
}

// 拦截 <a target="_blank"> 点击
function patchDocument(doc) {
  doc.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (a && a.target === "_blank" && a.href && !a.href.startsWith("javascript:")) {
      e.preventDefault();
      e.stopImmediatePropagation();
      TOP.location.href = a.href;
    }
  }, true);
}

patchWindow(window);
patchDocument(document);
```

### 第三层：main process 兜底处理 Web Component 弹窗

```ts
// src/main/index.ts
mainWindow.webContents.on("did-attach-webview", (_event, wc) => {
  wc.setWindowOpenHandler(({ url }) => {
    setImmediate(() => {
      wc.loadURL(url);
    });
    return { action: "deny" };
  });
});
```

## 失败尝试

- **`setWindowOpenHandler` 返回 `{ action: "navigate" }`**：Electron 42 报错 "The window open handler response must be an object with an 'action' property of 'allow' or 'deny'"，不支持 `navigate`
- **仅 preload 拦截**：必应 Web Component 在 shadow DOM 内通过缓存的原生 `window.open` 引用打开链接，preload 的 patch 无效
- **仅 `setWindowOpenHandler` + `deny`（无 `allowpopups`）**：没有 `allowpopups` 时 Chromium 底层静默拦截，handler 不会被调用
- **`setWindowOpenHandler` 中同步调用 `loadURL`**：`deny` 的返回值可能取消已发起的导航，需要用 `setImmediate` 延迟

## 关键约束

- `allowpopups="true"` 是必须的，否则 Chromium 静默拦截所有弹窗
- `setWindowOpenHandler` 中导航必须用 `setImmediate` 延迟，避免被 `deny` 返回值抵消
- preload 中的 `TOP.location.href` 使用顶层 window 引用，确保导航发生在主 frame（而非 iframe）
- `stopImmediatePropagation` 防止页面原有事件处理器干扰导航

## 原理

三层互补覆盖所有链路：
1. `allowpopups="true"` 让 Chromium 不再静默拦截，转而上报 `setWindowOpenHandler`
2. preload 的 `window.open` patch + click capture 覆盖普通链接（`<a>` 标签和标准 JS 调用）
3. main process 的 `setWindowOpenHandler` + `deny` + `setImmediate(loadURL)` 兜底处理 Web Component 等绕过了 preload patch 的场景

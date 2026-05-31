# Dockview 集成经验

## 右键菜单

### 终端右键菜单

xterm.js 无内置右键菜单 API。通过 DOM `contextmenu` 事件 + IPC 调用主进程 `Menu.popup()` 实现：

```ts
// renderer: onContextMenu → IPC
const action = await glaze().contextMenu.showTerminal();

// main process: Promise 模式返回选中项
ipcMain.handle("context-menu:terminal", async (event) => {
  return new Promise((resolve) => {
    const menu = Menu.buildFromTemplate([
      { label: "复制", click: () => resolve("copy") },
      { label: "粘贴", click: () => resolve("paste") },
      { label: "全选", click: () => resolve("selectAll") },
    ]);
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender)!, callback: () => resolve(null) });
  });
});
```

**关键点**：
- **不要手动传 x/y 坐标**：让 `Menu.popup()` 使用默认光标位置，比手动传递 `clientX/clientY` 更准确
- 用 Promise 模式：menu item click → resolve(action)，menu dismiss callback → resolve(null)
- 复制：`terminal.getSelection()` → IPC clipboard.writeText
- 粘贴：IPC clipboard.readText → `pty.write()`

### Webview 右键菜单

在主进程通过 `did-attach-webview` 获取 webview 的 webContents，监听其 `context-menu` 事件：

```ts
mainWindow.webContents.on("did-attach-webview", (_event, wc) => {
  wc.on("context-menu", (_event, params) => {
    const menu = Menu.buildFromTemplate([
      { label: "复制", click: () => wc.copy() },
      { label: "粘贴", click: () => wc.paste() },
      { type: "separator" },
      { label: "检查元素", click: () => wc.inspectElement(params.x, params.y) },
    ]);
    menu.popup({ window: mainWindow! });
  });
});
```

- 同样不要传 x/y，用默认光标位置
- `wc.copy()` / `wc.paste()` 直接操作 webview 内容，无需 IPC 回传
- `wc.inspectElement(x, y)` 打开 DevTools 定位到点击的元素

### 剪贴板

使用 Electron 原生 `clipboard` 模块（通过 IPC），比 `navigator.clipboard` 更可靠：

```ts
// main process
ipcMain.handle("clipboard:readText", () => clipboard.readText());
ipcMain.handle("clipboard:writeText", (_event, text: string) => clipboard.writeText(text));
```

## 面板渲染模式：`defaultRenderer="always"`

### 问题
切换 dockview tab 后 webview 重新加载，丢失页面状态。

### 根因
dockview 默认渲染模式 `"onlyWhenVisible"`：切换 tab 时将非活跃面板的 DOM 元素从文档中移除，切回时重新插入。对 `<webview>` 而言，DOM 重新插入会触发 webview 进程重新初始化。

### 解决方案
```tsx
<DockviewReact defaultRenderer="always" ... />
```

所有面板 DOM 常驻文档，仅通过 CSS 隐藏/显示。终端也受益——PTY 继续运行，xterm.js 实例不被重建。

## `-webkit-app-region: drag` 导致双击最大化

### 问题
双击 tab 栏空白区域触发 OS 窗口最大化。

### 根因
`.dv-tabs-and-actions-container` 设置了 `-webkit-app-region: drag`。在 Electron `frame: false` 下，此 CSS 属性将元素标记为窗口拖拽区域。Windows 对拖拽区域的双击解释为窗口最大化/还原。

### 解决方案
改为 `-webkit-app-region: no-drag`。同时添加 dblclick 捕获处理器，双击 tab 栏空白区域改为新建终端：

```ts
el.addEventListener("dblclick", (e) => {
  const target = e.target as HTMLElement;
  if (target.closest(".dv-tabs-and-actions-container") && !target.closest(".dv-tab")) {
    e.preventDefault();
    addTerminalRef.current();
  }
}, true); // capture phase
```

## 光标样式覆盖

dockview 对 `.dv-void-container.dv-draggable` 设置了 `cursor: grab`。需要 `!important` 才能覆盖（选择器优先级不够）：

```css
.dv-tabs-and-actions-container .dv-void-container {
  cursor: pointer !important;
}
.dv-tab {
  cursor: pointer !important;
}
```

## 布局序列化类型

`SerializedDockview` 类型从 `dockview` 包导入（re-export from `dockview-core`）：

```ts
import type { SerializedDockview } from "dockview";
```

`api.toJSON()` 和 `api.fromJSON()` 使用此类型。

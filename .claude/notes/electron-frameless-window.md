# Electron 无框窗口

> 2026-05-31 | frame: false / 自定义标题栏 / 窗口控件

## 配置

```typescript
// main process
new BrowserWindow({
  frame: false,                // 去掉原生窗口框
  webviewTag: true,            // 启用 <webview>
  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,
    nodeIntegration: false,
  },
});

Menu.setApplicationMenu(null); // 去掉菜单栏
```

## 窗口控件 IPC

main process 提供 5 个窗口控制 handler + maximize 状态推送：

```typescript
ipcMain.handle("window:minimize", ...)
ipcMain.handle("window:maximize", ...)  // toggle
ipcMain.handle("window:close", ...)
ipcMain.handle("window:isMaximized", ...)
mainWindow.on("maximize", ...)          // 推送状态变化
```

renderer 最大/还原图标根据 `onMaximizeChange` 切换。

## 拖拽区域

标题栏和 tab 栏需要 `-webkit-app-region: drag`，交互元素（按钮、tab 标签）需要 `no-drag`：

```css
.dv-tabs-and-actions-container { -webkit-app-region: drag; }
.dv-tab { -webkit-app-region: no-drag; }
```

```tsx
<div style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
  <button style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
```

## 图标库

使用 `lucide-react`：
- `Minus` — 最小化
- `Square` — 最大化
- `Copy` — 还原（两个重叠方框）
- `X` — 关闭

不要手写 SVG path。

# dockview 切换 tab 导致 webview 重新加载

## 症状

切换 dockview tab 后再切回来，webview 内容重新加载，丢失页面状态（表单输入、滚动位置、JS 状态等）。

## 根因

dockview 默认渲染模式 `"onlyWhenVisible"`：切换 tab 时将非活跃面板的 DOM 元素从文档中移除。当切回该 tab 时，DOM 元素被重新插入文档。对 `<webview>` 而言，DOM 重新插入会触发 webview 进程的重新初始化，等同于重新加载页面。

## 诊断方法

1. 在 webview 页面中输入一些表单内容
2. 切换到另一个 tab
3. 切回原 tab
4. 观察页面是否重新加载（表单内容丢失）

## 修复步骤

将 dockview 渲染模式改为 `"always"`：

```tsx
<DockviewReact
  defaultRenderer="always"
  // ... 其他 props
/>
```

所有面板 DOM 常驻文档，仅通过 CSS 隐藏/显示。终端也受益——PTY 继续运行，xterm.js 实例不被重建。

## 失败尝试

- 手动在 tab 切换时保存/恢复 webview 状态：不可能，因为 webview 进程被销毁后无法恢复 JS 堆
- 使用 `visibility: hidden` 覆盖面板：dockview 的渲染模式直接控制 DOM 插入/移除，CSS 无法阻止

## 关键约束

- `defaultRenderer="always"` 会增加内存占用（所有面板的 DOM 常驻），面板数量较多时需注意
- 对 webview 面板必须用此模式，对纯终端面板可选

## 原理

`"onlyWhenVisible"` 通过移除 DOM 来释放资源，但 webview 的 DOM 移除 = 销毁渲染进程。`"always"` 模式保留所有 DOM，仅通过 CSS `display` 控制显隐，webview 进程不中断。

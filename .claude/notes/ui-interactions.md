# UI 交互经验

## Sidebar 拖拽 resize

### 宽热区 + 细视觉线

视觉 1px 分割线 + 5px 点击热区，既保持美观又容易抓取：

```tsx
{/* 外层 5px 热区，透明背景，处理 mousedown + hover */}
<div style={{ width: 5 }} onMouseDown={handleResizeStart} ...>
  {/* 内层 1px 视觉线 */}
  <div style={{ width: 1, height: "100%", backgroundColor: "var(--color-border)" }} />
</div>
```

hover 效果操作内层 div 的 `style.backgroundColor`（通过 `e.currentTarget.firstChild`）。

### 拖拽期间直接操作 DOM + 去掉 CSS 过渡

**问题**：每次 mousemove 更新 zustand store → React 重渲染 Sidebar（含工作区列表），加上 `transition-all duration-200`，拖拽明显延迟。

**解决方案**：
1. zustand store 加 `isResizing` 标志
2. 拖拽期间直接设置 `asideRef.current.style.width`（绕过 React 渲染）
3. Sidebar 组件在 `isResizing` 时去掉 `transition-all duration-200`
4. 松手后一次性 `setWidth(finalWidth)` 更新 store

```ts
// handleMouseMove: 直接 DOM，0 React 开销
const w = Math.min(480, Math.max(120, Math.round(startWidth + delta)));
if (el) el.style.width = `${w}px`;

// handleMouseUp: 一次性更新 store
useSidebarStore.getState().setWidth(finalWidth);
useSidebarStore.getState().setIsResizing(false);
persistWorkspace();
```

```tsx
// Sidebar.tsx: 拖拽中去掉过渡
<aside className={`... ${isResizing ? "" : "transition-all duration-200"}`}>
```

### Sidebar forwardRef

拖拽需要直接操作 Sidebar 的 DOM 元素。用 `forwardRef` 暴露 `aside` 的 ref：

```tsx
export const Sidebar = forwardRef<HTMLElement, SidebarProps>(function Sidebar(props, ref) {
  return <aside ref={ref} ...>;
});
```

## 终端字号独立缩放

全局 `terminalFontSize` 导致所有终端同步缩放。改为每个 session 独立存储：

```ts
// zoomStore
interface ZoomState {
  sessionSizes: Record<string, number>;  // sessionId → fontSize
  activeSessionId: string | null;
  zoomIn: () => { /* 只更新 activeSessionId 对应的字号 */ }
}
```

- `DockviewLayout` 的 `onDidActivePanelChange` 通知 zoomStore 当前活跃 session
- `TerminalPanel` 从 `sessionSizes[sessionId] ?? terminalFontSize` 读取

## 字体设置

UI 全局使用微软雅黑，终端保持等宽字体：

```css
html, body, #root {
  font-family: "Microsoft YaHei", "微软雅黑", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

终端等宽字体在 `useXTerm.ts` 中单独指定：
```ts
fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace'
```

## Electron 无边框窗口 + Tailwind 类

Tailwind 4.x 的 utility class（如 `pl-4`）在某些情况下可能不生效。拖拽区域（`-webkit-app-region: drag`）内的文本建议用 inline style 替代 Tailwind padding 类：

```tsx
// 行内样式保证一定生效
<span style={{ paddingLeft: 12 }}>Glaze</span>
```

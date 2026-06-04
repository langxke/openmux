# Sidebar 拖拽 resize 性能优化

## 症状

拖拽 sidebar 分隔线调整宽度时，拖拽明显延迟、卡顿。

## 根因

每次 `mousemove` 更新 zustand store → React 重渲染整个 Sidebar 组件（含工作区列表），加上 CSS `transition-all duration-200`，拖拽期间每帧都触发完整 React 渲染周期。

## 诊断方法

1. 在 Sidebar 组件中添加 `console.log` 观察重渲染频率
2. 拖拽 sidebar 分隔线，观察日志输出频率
3. 如果每次 `mousemove`（~60 次/秒）都触发渲染，确认此问题

## 修复步骤

拖拽期间绕过 React，直接操作 DOM：

```ts
// zustand store 加 isResizing 标志
interface SidebarState {
  isResizing: boolean;
  setIsResizing: (v: boolean) => void;
  // ...
}

// App.tsx — handleResizeStart
const handleMouseMove = (ev: MouseEvent) => {
  const delta = ev.clientX - startX;
  const w = Math.min(480, Math.max(120, Math.round(startWidth + delta)));
  if (el) el.style.width = `${w}px`;  // 直接 DOM，零 React 开销
};

const handleMouseUp = () => {
  const finalWidth = el ? parseInt(el.style.width, 10) : startWidth;
  useSidebarStore.getState().setWidth(finalWidth);
  useSidebarStore.getState().setIsResizing(false);
  persistWorkspace();
  // cleanup listeners
};
```

```tsx
// Sidebar.tsx — 拖拽中去掉 CSS 过渡
<aside className={`... ${isResizing ? "" : "transition-all duration-200"}`}>
```

## 失败尝试

- **在 store 中更新宽度并依赖 React 重渲染**：每帧 60 次渲染导致卡顿
- **用 debounce 减少 store 更新**：改善有限，仍有延迟感
- **去掉 CSS 过渡而不做 DOM 直接操作**：拖拽时视觉跳动

## 关键约束

- Sidebar 需要 `forwardRef` 暴露 DOM 引用给父组件
- 视觉分割线（1px）和点击热区（5px）分离，兼顾美观和可用性
- 松手后一次性更新 store 触发 persist

## 原理

拖拽期间的需求是"让分割线跟随鼠标"，不需要 React 重渲染任何子组件。直接操作 DOM `style.width` 达到 60fps 流畅度。松手后将最终值写入 store，触发 React 重渲染（仅一次）来持久化。

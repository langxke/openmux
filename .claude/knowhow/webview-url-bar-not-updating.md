# Electron webview 导航后地址栏和标签标题不更新

## 症状

webview 内的页面成功导航（内容已变化），但浏览器面板的 URL 地址栏和 dockview 标签页标题都没有随之更新，仍显示旧 URL 和旧标题。

## 根因

`BrowserPanel.tsx` 中绑定 webview 导航事件的 `useEffect` 依赖数组只写了 `[api]`：

```ts
useEffect(() => {
  const wv = webviewRef.current;
  if (!wv) return;  // webview 不存在时提前返回
  // ... 绑定 did-navigate、page-title-updated 等事件
}, [api]);  // ← 缺少 ready 和 preloadPath
```

但 webview 是条件渲染的（`ready && preloadPath` 时才渲染）。首次渲染时 `ready=false`，webview 不存在，effect 执行到 `if (!wv) return` 就提前退出了。后续 `ready` 变为 `true` 时组件重新渲染，但由于 `api` 未变化，effect **不会重新执行**——事件监听器从未被绑定到 webview 元素上。

## 诊断方法

1. 在 `onNavigate` 和 `onTitleUpdated` 回调中添加 `console.log`
2. 点击 webview 内链接触发导航
3. 观察控制台——如果没有任何 `[DEBUG-nav]` 或 `[DEBUG-title]` 日志，说明事件监听器未绑定
4. 检查 `useEffect` 的依赖数组是否包含了 webview 渲染所依赖的状态变量

## 修复步骤

将 `ready` 和 `preloadPath` 加入依赖数组：

```tsx
// src/renderer/components/BrowserPanel.tsx
useEffect(() => {
  const wv = webviewRef.current;
  if (!wv) return;

  const onTitleUpdated = (e) => { /* 更新标签标题 */ };
  const onNavigate = (e) => { /* 更新地址栏 URL */ };

  wv.addEventListener("page-title-updated", onTitleUpdated);
  wv.addEventListener("did-navigate", onNavigate);
  wv.addEventListener("did-navigate-in-page", onNavigate);

  return () => {
    wv.removeEventListener("page-title-updated", onTitleUpdated);
    wv.removeEventListener("did-navigate", onNavigate);
    wv.removeEventListener("did-navigate-in-page", onNavigate);
  };
}, [api, ready, preloadPath]);  // ← 加上 ready 和 preloadPath
```

## 失败尝试

无。这是一次性定位到的 bug。

## 关键约束

- `useEffect` 的依赖数组必须包含 effect 内部**条件依赖的渲染状态**。如果 DOM 元素是条件渲染的（`{condition && <element />}`），控制该条件的变量必须出现在依赖数组中
- ref（`webviewRef`）本身不需要加入依赖——React 保证 ref 在 DOM 提交后已更新
- `did-navigate` 只在跨文档导航时触发；同文档导航（`pushState`、hash 变化）触发 `did-navigate-in-page`，两者都应监听

## 原理

React 的 `useEffect` 在组件每次渲染后检查依赖数组。如果依赖值与前一次渲染相同，则跳过 effect 执行。条件渲染的元素在首次渲染时不存在（ref 为 null），只有当控制条件的 state 改变触发重新渲染后 ref 才指向实际 DOM 元素。如果该 state 不在依赖数组中，effect 不会重新执行，导致事件监听器始终未绑定。

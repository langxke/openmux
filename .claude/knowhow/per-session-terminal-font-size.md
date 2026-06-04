# 终端字号全局缩放导致所有 session 同步变化

## 症状

按 Ctrl+= 缩放终端字号时，所有终端的字号同步变化，无法为不同终端设置不同字号。

## 根因

全局 `terminalFontSize` 被所有 `TerminalPanel` 共享。缩放时修改的是全局值，所有终端读取同一个值。

## 诊断方法

1. 打开两个终端
2. 在其中一个终端按 Ctrl+= 放大
3. 观察另一个终端的字号是否也变化了

## 修复步骤

改为每个 session 独立存储字号，缩放只影响当前活跃 session：

```ts
// stores/zoomStore.ts
interface ZoomState {
  terminalFontSize: number;          // 新终端的默认字号
  sessionSizes: Record<string, number>;  // sessionId → 独立字号
  activeSessionId: string | null;

  zoomIn: () => {
    const { activeSessionId, sessionSizes, terminalFontSize } = get();
    if (!activeSessionId) return;
    const current = sessionSizes[activeSessionId] ?? terminalFontSize;
    set({
      sessionSizes: {
        ...sessionSizes,
        [activeSessionId]: Math.min(32, current + 1),
      },
    });
  },
  // zoomOut, zoomReset 同理
}
```

```tsx
// DockviewLayout.tsx — 通知当前活跃 session
event.api.onDidActivePanelChange((panel) => {
  const sid = panel?.params?.sessionId as string | undefined;
  useZoomStore.getState().setActiveSession(sid ?? null);
});
```

```tsx
// TerminalPanel.tsx — 读取当前 session 的字号
const fontSize = useZoomStore((s) => s.sessionSizes[sessionId] ?? s.terminalFontSize);
```

## 失败尝试

- 在 TerminalPanel 内部维护独立字号状态：切换 dockview tab 时状态可能丢失
- 使用全局缩放 + per-panel CSS transform：缩放质量差，且 xterm.js 的字符测量基于实际字号

## 关键约束

- `sessionSizes` 随 workspace 一起持久化到 `workspaces.json`，重启后恢复
- 字号范围限制 8-32px
- 步进为 1px（终端字号与 UI 缩放不同，不需要小数步进）

## 原理

将从"全局值 + 全局修改"改为"per-session 覆盖 + 全局默认值"模式。每个 session 在读字号时优先取自己的覆盖值，不存在则回退到全局默认。缩放只修改当前活跃 session 的覆盖值，不影响其他 session。

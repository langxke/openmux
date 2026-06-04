# Electron 无框窗口双击 tab 栏导致窗口最大化

## 症状

双击 dockview tab 栏的空白区域时，操作系统级窗口最大化/还原被触发。

## 根因

`.dv-tabs-and-actions-container` 设置了 `-webkit-app-region: drag`。在 Electron `frame: false` 无框窗口下，此 CSS 属性将元素标记为窗口拖拽区域。Windows 对拖拽区域的双击解释为窗口最大化/还原。

## 诊断方法

1. 在 Electron `frame: false` 窗口中的任意元素设置 `-webkit-app-region: drag`
2. 双击该元素的空白区域
3. 窗口最大化/还原 → 确认此问题

## 修复步骤

将 tab 栏设为 `no-drag`，同时在 JS 层处理双击事件：

```css
.dv-tabs-and-actions-container {
  -webkit-app-region: no-drag !important;
}
```

```ts
el.addEventListener("dblclick", (e) => {
  const target = e.target as HTMLElement;
  const inTabBar = target.closest(".dv-tabs-and-actions-container");
  const onTab = target.closest(".dv-tab");
  if (inTabBar && !onTab) {
    e.preventDefault();
    e.stopPropagation();
    addTerminalRef.current();  // 双击空白区域 → 新建终端
  }
}, true); // capture phase
```

## 失败尝试

- **阻止 `dblclick` 事件**：可以阻止 JS 层的双击处理，但 OS 层面的最大化由 Windows 窗口管理器在更底层处理，JS `preventDefault` 无效
- **在 tab 上保留 `drag` 属性**：tab 上的拖拽区域与双击冲突不可避免

## 关键约束

- 必须在 **capture phase** 监听 `dblclick`，确保在事件到达 dockview 内部处理之前拦截
- `-webkit-app-region` 只对 Electron `frame: false` 窗口有效
- 标题栏区域仍可保留 `drag`，但 tab 栏和按钮区域必须 `no-drag`

## 原理

Windows 窗口管理器的双击最大化行为通过 `-webkit-app-region: drag` 标记的元素传播。将此属性设为 `no-drag` 后，Windows 不再将该区域的双击解释为窗口操作。

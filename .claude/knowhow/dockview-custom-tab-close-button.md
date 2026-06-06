# dockview 自定义 Tab 组件导致关闭按钮失效

## 症状

使用 `defaultTabComponent` 替换 dockview 默认 Tab 后，Tab 的关闭按钮（X）点击后无反应，无法关闭面板。

## 根因

dockview 的默认 Tab 组件（`DockviewDefaultTab`）内部实现了一整套关闭处理逻辑，仅通过 `onClick={closeActionOverride}` 无法正确关闭：

1. **`closeActionOverride` 是可选 prop**：只有特定场景（如右键菜单关闭）才会传入。大多数情况下它为 `undefined`，此时关闭按钮的 fallback 是 `api.close()`。
2. **必须调用 `event.preventDefault()`**：阻止浏览器默认行为，否则事件冒泡可能导致意外行为。
3. **`onPointerDown` 处理器**：关闭按钮上的 `onPointerDown` 调用 `event.preventDefault()` 阻止焦点转移，缺少此处理可能导致焦点问题。

## 诊断方法

1. 在 dockview 中设置 `defaultTabComponent={CustomTab}`
2. 点击 Tab 上的关闭按钮
3. 观察面板是否关闭
4. 对比 `node_modules/dockview/dist/esm/dockview/defaultTab.js` 中原始 Tab 的实现

## 修复步骤

自定义 Tab 组件需完整复制 dockview 原生的关闭逻辑：

```tsx
import { useState, useCallback, useEffect } from "react";
import type { IDockviewDefaultTabProps } from "dockview";

export function EditableTab(props: IDockviewDefaultTabProps) {
  const { api, hideClose, closeActionOverride } = props;

  // 关闭处理：完全匹配 dockview 原生行为
  const onClose = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();                      // 必须
      if (closeActionOverride) {
        closeActionOverride();
      } else {
        api.close();                               // fallback
      }
    },
    [api, closeActionOverride],
  );

  // 阻止关闭按钮抢走焦点
  const onBtnPointerDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
  }, []);

  return (
    <div className="dv-default-tab">
      <span className="dv-default-tab-content">{api.title}</span>
      {!hideClose && (
        <div
          className="dv-default-tab-action"
          onPointerDown={onBtnPointerDown}          // 必须
          onClick={onClose}                         // 不是直接传 closeActionOverride
        >
          {/* 关闭图标 SVG */}
        </div>
      )}
    </div>
  );
}
```

## 失败尝试

- **直接传 `onClick={closeActionOverride}`**：关闭按钮无反应，因为大多数情况 `closeActionOverride` 为 `undefined`，且缺少 `event.preventDefault()`
- **`e.stopPropagation()` 包装**：阻止了 dockview 内部事件代理，反而更糟

## 关键约束

- 自定义 Tab 必须保留 `className="dv-default-tab"` 和 `dv-default-tab-content`、`dv-default-tab-action` 等类名，否则 dockview CSS 不生效
- 关闭图标 SVG 需要 `className="dv-svg"`，dockview CSS 通过此选择器设置图标尺寸和颜色
- Tab 标题需要监听 `api.onDidTitleChange` 事件，否则外部调用 `api.setTitle()` 后显示不更新

## 原理

dockview 的 Tab 关闭是一个两层回退机制：如果有 `closeActionOverride`（来自特殊上下文如右键菜单）则调用之；否则调用 `api.close()` 执行标准关闭流程。自定义 Tab 组件替换了 dockview 的整套渲染，必须完整实现此机制。

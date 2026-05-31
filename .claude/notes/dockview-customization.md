# Dockview 定制经验

> 2026-05-31 | 主题 / tab / 溢出菜单 / 拖拽分屏

## 浅色主题

dockview 内置 16 个主题，推荐 `themeLight`：

```tsx
import { DockviewReact, themeLight } from "dockview";
<DockviewReact theme={themeLight} ... />
```

`themeLight` 自动设置 `--dv-*-color` 等 CSS 变量。项目自定义颜色通过 `!important` 覆盖优先级高于主题变量。

## Tab 溢出菜单

dockview 默认在 tab 栏显示溢出下拉菜单（带数字的箭头）。选项：`disableTabsOverflowList={true}`。

当 tab 数量超出可视区域时，可用滚轮浏览，不需要下拉菜单。

## 拖拽分屏控制

`api.onWillShowOverlay` 在分屏指示出现前触发，返回 `kind` 标识目标位置：

| `kind` | 含义 |
|--------|------|
| `tab` | tab 标签上 |
| `header_space` | tab 栏空白区域 |
| `content` | 内容区 |
| `edge` | 外边缘 |

```typescript
event.api.onWillShowOverlay((e) => {
  if (e.kind === "tab") e.preventDefault(); // 禁止在标签上分屏
});
```

## Tab 样式覆盖

```css
/* 高度 */
.dv-tabs-and-actions-container { height: 24px !important; }
.dv-tab { height: 24px !important; padding: 1px 10px !important; }

/* 关闭按钮 */
.dv-tab .dv-default-tab .dv-default-tab-action { padding: 2px !important; }
.dv-tab .dv-default-tab .dv-default-tab-action .dv-svg {
  height: 7px !important; width: 7px !important;
}

/* 拖拽区域 */
.dv-tabs-and-actions-container { -webkit-app-region: drag; }
.dv-tab { -webkit-app-region: no-drag; }
.dv-right-actions-container { -webkit-app-region: no-drag; }
```

## 参考文档

- API Options: <https://dockview.dev/docs/api/dockview/options>
- 类型声明: `node_modules/dockview-core/dist/esm/dockview/options.d.ts`
- React Props: `node_modules/dockview/dist/esm/dockview/dockview.d.ts`

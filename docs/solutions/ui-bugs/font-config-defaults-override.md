---
title: "字体配置默认值被缓存覆盖导致 CJK 渲染回退到宋体"
date: 2026-06-10
category: ui-bugs
module: useXTerm
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "CJK 字符渲染为宋体，而非预期的 Microsoft YaHei"
  - "修改 useXTerm.ts 的 DEFAULT_FONT 常量后终端字体无变化"
  - "config.ts 默认值、useXTerm.ts 默认值、xterm.css 三者字体栈不一致"
root_cause: config_error
resolution_type: code_fix
severity: medium
tags: [font-family, cjk, config, default, cache, css-override, xterm]
---

# 字体配置默认值被缓存覆盖导致 CJK 渲染回退到宋体

## Problem

终端中文字体看起来像宋体（SimSun）而非微软雅黑（Microsoft YaHei）。原因是字体默认值存在三个独立的定义点，修改一个不会自动同步到其他两个，且磁盘缓存的用户配置文件会覆盖代码级默认值。

## Symptoms

- CJK 字符渲染为宋体而非预期的 Microsoft YaHei
- 修改 `useXTerm.ts` 的 `DEFAULT_FONT` 常量后终端字体无变化
- `Ctrl+N` 新建终端标签页也无法看到字体变更
- Playwright 检查发现 xterm.js DOM renderer 注入的 CSS 仍是旧字体栈

## What Didn't Work

1. **仅修改 `useXTerm.ts` 的 `DEFAULT_FONT`** — 无效，因为 `config:get` IPC 从 main process 的 `config.ts` 加载默认字体，该值覆盖了 `DEFAULT_FONT`
2. **删除 `openmux-dev/openmux.json` 配置文件** — 部分有效，但 config.ts 自身 `defaultConfig()` 中仍硬编码了旧字体栈
3. **仅修改 `config.ts` 的 `defaultConfig()`** — 仍然不够，xterm.css 中 `.xterm { font-family: monospace }` 会覆盖 xterm 元素的字体

## Solution

**三层修复**——必须同时修改三个位置：

### 1. config.ts 默认字体（canonical source）

```typescript
// src/main/config.ts — defaultConfig()
function defaultConfig(): OpenMuxConfig {
  return {
    defaultShell: "powershell",
    fontSize: 14,
    fontFamily: '"Consolas", "Microsoft YaHei", "微软雅黑", monospace',
    theme: "light",
    // ...
  };
}
```

### 2. 删除缓存配置文件

```bash
rm "$APPDATA/openmux-dev/openmux.json"
```

### 3. CSS `!important` 覆盖 xterm.css

```css
/* src/renderer/index.css */
.xterm {
  font-family: "Consolas", "Microsoft YaHei", "微软雅黑", monospace !important;
}
```

xterm.css 中 `.xterm { font-family: monospace }` 具有与 inline style 相同的 specificity，需要用 `!important` 确保 CSS 级联中用户定义值优先生效。同时，xterm.js DOM renderer 会读取 `terminal.options.fontFamily` 并注入自己的 `<style>` 规则到 `.xterm-dom-renderer-owner-N .xterm-rows`——这个规则也需要与 CSS override 保持一致。

### 最终字体栈

```
"Consolas", "Microsoft YaHei", "微软雅黑", monospace
```

Consolas 处理英文等宽字符，Microsoft YaHei（英文名 + 中文名双保险）处理 CJK，monospace 作为系统级兜底。

## Why This Works

字体配置存在**三层级联**：

| 层级 | 位置 | 作用 |
|------|------|------|
| 1 | `config.ts` → `config:get` IPC → `configStore` | 被 renderer 读取并传给 `useXTerm` |
| 2 | `useXTerm.ts` `DEFAULT_FONT` | 仅在 `options.fontFamily` 为 undefined 时使用 |
| 3 | `index.css` `.xterm` | 直接作用于 DOM，覆盖 xterm.css 默认值 |

第 1 层的值会覆盖第 2 层，第 3 层与第 1 层并行作用于不同维度（JS 传参控制测量，CSS 控制可见渲染）。三者必须同步。

## Prevention

- 修改任何字体相关默认值时，同时检查 config.ts `defaultConfig()` 和 `index.css` `.xterm` 规则
- 开发环境下删除 `%APPDATA%/openmux-dev/openmux.json` 缓存文件
- 新增配置字段时，将默认值定义在 `config.ts` 的 `defaultConfig()` 中作为 canonical source，避免散落各处
- 字体值变更后需重启应用（`Ctrl+N` 不够），或运行 Playwright 验证 DOM renderer 注入的 CSS 字体栈是否正确

## Related

- `.claude/notes/ui-interactions.md` — 终端字体家族配置
- `.claude/knowhow/per-session-terminal-font-size.md` — 每会话字号
- `src/shared/types.ts` — OpenMuxConfig 类型定义（fontFamily 字段）

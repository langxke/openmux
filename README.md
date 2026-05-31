# Glaze

Windows 原生 AI 编程终端，对标 macOS [cmux](https://github.com/manaflow-ai/cmux)。

## 快速开始

```bash
pnpm install
pnpm start
```

## 技术栈

| 层 | 选型 |
|---|---|
| 桌面壳 | Electron |
| 前端框架 | React 19 + TypeScript |
| 构建工具 | Electron Forge + Vite |
| UI | Tailwind CSS 4 |
| 分屏布局 | dockview |
| 终端渲染 | xterm.js |
| PTY | node-pty (ConPTY) |
| 状态管理 | Zustand |
| 包管理 | pnpm |

## 核心功能

- **分屏布局** — 同一窗口内多个终端面板自由分屏排列，拖拽分割条调整大小
- **标签页系统** — 每个标签页维护独立的分屏布局树，支持拖拽排序和重命名
- **拖拽分屏** — 拖拽标签到面板边缘自动创建分屏，dockview 内置 drop zone 指示器
- **多窗口** — 快捷键新建独立窗口，每个窗口有独立的标签集合
- **工作区侧边栏** — 左侧可折叠侧边栏，展示 Git 分支、工作目录等信息
- **命令面板** — `Ctrl+P` 唤起，在 `glaze.json` 中定义自定义命令
- **配置文件** — `%APPDATA%/glaze/glaze.json`，支持自定义 Shell、字体、主题、快捷键

## Quality Gates

```bash
pnpm typecheck    # TypeScript 类型检查
pnpm lint         # ESLint
```

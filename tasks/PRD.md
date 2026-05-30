[PRD]
# PRD: Glaze — Windows 原生 AI 编程终端

## Overview

Glaze 是一个面向 Windows 的 AI 编程代理终端，对标 macOS 上的 cmux（manaflow-ai/cmux）。第一期的核心目标是**多窗口 + 拖拽分屏 + 标签页**的终端体验，让开发者在 Windows 上获得与 cmux 同等的窗口管理和分屏能力。

技术栈：**Tauri 2 + Rust + React + TypeScript + xterm.js + dockview**

## Goals

- 提供 macOS cmux 核心分屏体验的 Windows 替代方案
- 支持拖拽标签到窗口边缘自动创建分屏（dockview 内置能力）
- 支持拖拽标签到窗口外创建新窗口
- 每个 Tab 内维护独立的分屏布局树
- 左侧工作区侧边栏，展示 Git 分支、工作目录等元数据
- 原生 Windows 体验（ConPTY、Win32 窗口管理、WebView2）
- 包体积控制在 15MB 以内

## Quality Gates

以下命令必须在每个 User Story 完成后通过：

- `cargo check` — Rust 类型检查
- `cargo clippy` — Rust lint
- `cargo test` — Rust 单元测试
- `pnpm typecheck` — TypeScript 类型检查
- `pnpm lint` — 前端 lint

## User Stories

### US-001: 项目脚手架与开发环境搭建

**Description:** 作为开发者，我需要一个可运行的 Tauri 2 + React + TypeScript 项目骨架，以便后续功能开发。

**Acceptance Criteria:**
- [ ] Tauri 2 项目初始化成功，`cargo tauri dev` 可启动窗口
- [ ] React + TypeScript + Vite 前端工程化就绪
- [ ] Tailwind CSS v4 集成，shadcn/ui 可用
- [ ] dockview 依赖安装并渲染一个空的 Dockview 容器
- [ ] xterm.js 依赖安装，能在面板中渲染一个终端实例
- [ ] `%APPDATA%/glaze/` 目录自动创建
- [ ] 默认配置文件 `glaze.json` 在首次启动时自动生成

### US-002: PTY 终端核心

**Description:** 作为用户，我需要一个能正常工作的终端面板，可以执行 PowerShell/CMD 命令并看到输出。

**Acceptance Criteria:**
- [ ] Rust 端通过 `portable-pty` 创建 Windows ConPTY 实例
- [ ] Tauri IPC 通道将 PTY 输出实时传输到前端 xterm.js
- [ ] 前端按键输入通过 IPC 写回 PTY
- [ ] 终端面板 resize 时同步 PTY 窗口大小
- [ ] 支持 PowerShell 和 CMD 两种 Shell
- [ ] `Ctrl+C` 等控制序列正常工作
- [ ] xterm.js WebGL addon 启用，GPU 加速渲染

### US-003: 分屏布局（核心）

**Description:** 作为用户，我可以通过 dockview 在同一个窗口内创建多个终端面板，自由分屏排列。

**Acceptance Criteria:**
- [ ] dockview 渲染分屏容器，支持多个终端面板同时存在
- [ ] 每个面板内嵌一个独立的 xterm.js 终端实例
- [ ] 每个面板有独立的 PTY 进程（Rust 端按 panel ID 管理）
- [ ] 面板之间可拖拽分割条调整大小
- [ ] 面板支持最大化/还原（双击标题栏）
- [ ] 关闭面板时清理对应 PTY 进程
- [ ] dockview 支持的水平/垂直分屏均可正常使用

### US-004: 标签页系统

**Description:** 作为用户，我可以通过标签页组织多个分屏布局，每个标签页有独立的分屏树。

**Acceptance Criteria:**
- [ ] dockview 的 Tab 系统正常工作
- [ ] 每个 Tab 内维护独立的分屏布局（切换 Tab 时布局保持不变）
- [ ] Tab 支持拖拽排序（在同一 Tab 栏内）
- [ ] Tab 支持重命名（双击或右键菜单）
- [ ] `+` 按钮新建 Tab
- [ ] 关闭 Tab 时清理该 Tab 内所有面板的 PTY 进程
- [ ] Tab 栏在有大量 Tab 时支持滚动或溢出菜单

### US-005: 拖拽分屏

**Description:** 作为用户，我可以拖拽标签到容器边缘自动创建分屏，获得与 cmux 一致的交互体验。

**Acceptance Criteria:**
- [ ] 拖拽标签到面板上/下/左/右边缘 → 在对应方向创建新分屏
- [ ] 拖拽标签到两个面板之间 → 插入分屏
- [ ] 拖拽过程中显示 drop zone 指示器（高亮边缘区域）
- [ ] 拖拽到中央区域 → 合并为同一 Tab set 的标签
- [ ] 拖拽动画流畅（60fps），无明显卡顿
- [ ] dockview 原生拖拽行为验证通过（dockview 已内置这些功能，配置即用）

### US-006: 多窗口支持

**Description:** 作为用户，我可以打开多个独立窗口，并能将标签页拖拽到窗口外创建新窗口。

**Acceptance Criteria:**
- [ ] 菜单栏 / 快捷键可以新建窗口
- [ ] 每个窗口有独立的 dockview 实例和标签集合
- [ ] 拖拽标签到当前窗口之外 → 自动创建新窗口并移入该标签
- [ ] Tauri Rust 端管理所有窗口实例
- [ ] 关闭窗口时清理该窗口内所有 PTY 进程
- [ ] 窗口标题栏显示当前活跃标签页名称

### US-007: 左侧工作区侧边栏

**Description:** 作为用户，我需要一个左侧侧边栏展示工作区信息，类似 cmux 的侧边栏体验。

**Acceptance Criteria:**
- [ ] 侧边栏可通过快捷键或按钮折叠/展开
- [ ] 展示当前 Git 分支名称
- [ ] 展示当前工作目录路径
- [ ] 展示活跃端口列表（自动检测 localhost 监听端口）
- [ ] 侧边栏风格与 cmux 侧边栏视觉一致（深色主题）
- [ ] 折叠时仅显示图标，展开时显示完整信息

### US-008: 配置文件系统

**Description:** 作为用户，我可以通过 `%APPDATA%/glaze/glaze.json` 配置 glaze 的行为，类似 cmux 的 `cmux.json`。

**Acceptance Criteria:**
- [ ] 配置文件位于 `%APPDATA%/glaze/glaze.json`
- [ ] 首次启动自动生成带默认值的配置文件
- [ ] 支持配置默认 Shell（PowerShell / CMD）
- [ ] 支持配置字体、字号、主题色
- [ ] 支持配置自定义快捷键
- [ ] 配置文件 JSON Schema 校验，格式错误时有提示
- [ ] 修改配置文件后可通过命令面板热重载

### US-009: 自定义命令面板

**Description:** 作为用户，我可以在配置文件中定义项目级命令，通过命令面板（Ctrl+P）快速执行。

**Acceptance Criteria:**
- [ ] 命令面板通过 `Ctrl+P` 唤起
- [ ] 在 `glaze.json` 中定义命令列表（名称 + 命令字符串）
- [ ] 命令在选中标签页的当前工作目录中执行
- [ ] 命令输出显示在新终端面板或浮动输出面板中
- [ ] 类似 cmux 的 custom commands 体验

## Functional Requirements

- FR-1: 应用启动时创建默认窗口，包含一个标签页和一个终端面板
- FR-2: 终端面板使用 Windows ConPTY 提供原生 Shell 体验
- FR-3: dockview 管理所有分屏布局，每个标签页有独立的 layout tree
- FR-4: 拖拽标签到窗口边缘时自动在对应方向创建分屏（上/下/左/右）
- FR-5: 拖拽标签到窗口外时创建新 Tauri 窗口
- FR-6: 左侧侧边栏可折叠，展示 Git 分支、工作目录、端口信息
- FR-7: 配置文件位于 `%APPDATA%/glaze/glaze.json`，首次启动自动生成
- FR-8: 命令面板（Ctrl+P）可执行配置文件中定义的自定义命令
- FR-9: 每个终端面板绑定一个独立的 PTY 进程，面板关闭时进程终止
- FR-10: 支持 PowerShell 和 CMD 两种 Shell 类型
- FR-11: xterm.js WebGL addon 提供 GPU 加速渲染
- FR-12: 窗口标题栏显示 `Glaze - [当前标签页名称]`

## Non-Goals (Out of Scope for V1)

- 内置浏览器面板（WebView2 面板与终端分屏）
- 会话恢复（窗口/标签/分屏布局的持久化）
- SSH 远程工作区
- Claude Code Teams 多代理协作
- WSL / Git Bash / 其他 Shell 支持
- AI 代理集成（Hook 恢复等）
- 主题系统（仅支持默认暗色主题）
- 国际化（仅中文/英文）

## Technical Considerations

### 技术栈
| 层级 | 选型 | 版本 |
|------|------|------|
| 桌面壳 | Tauri | 2.x |
| 前端框架 | React | 19 |
| 语言 | TypeScript | 5.x |
| 构建工具 | Vite | 6.x |
| UI 样式 | Tailwind CSS | 4.x |
| 组件库 | shadcn/ui | latest |
| 分屏布局 | dockview | 4.x |
| 终端渲染 | xterm.js | 5.x |
| PTY 管理 | portable-pty | latest |
| 状态管理 | Zustand | latest |
| 包管理器 | pnpm | latest |

### 关键架构决策
- **dockview vs 自研**: dockview(3.2k Stars, MIT, 零依赖) 已内置拖拽分屏、drop zone 指示器、Tab 管理，直接配置使用
- **xterm.js 直接封装**: 不做第三方 React wrapper（Star 都太低），用自定义 `useXTerm` hook (~60行)
- **每个面板一个 PTY**: Rust 端用 HashMap<PanelId, PtyHandle> 管理
- **portable-pty 直接用**: `dscode-terminal` 等封装 Star 太少，直接调 portable-pty API

### 参考项目
- [terax-ai](https://github.com/crynta/terax-ai): Tauri 2 + React + xterm.js 完整实现
- [cmux](https://github.com/manaflow-ai/cmux): 交互范式参考
- [SideX](https://github.com/kendallbooker/SideX): VS Code 的 Tauri 重写，PTY 方案验证

## Success Metrics

- 应用启动时间 < 2 秒
- 包体积 < 15MB
- 拖拽分屏动画 60fps
- 终端输入延迟 < 20ms
- 支持同时运行 10+ 个终端面板不卡顿
- 所有 Quality Gates 通过

## Open Questions

- dockview 的跨窗口拖拽（拖标签到窗口外）是其内置功能还是需要额外实现？（需验证 dockview `enablePopout` 与 Tauri 多窗口的集成方式）
- portable-pty 在 Windows ConPTY 上的稳定性和性能表现？（需实际测试）
- 是否需要支持窗口置顶（Always on Top）？
[/PRD]
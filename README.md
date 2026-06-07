![Platform](https://img.shields.io/badge/platform-Windows-blue?logo=windows)
![License](https://img.shields.io/badge/license-GPL--3.0-green)
![Release](https://img.shields.io/github/v/release/langxke/openmux?label=latest)

# openmux

A terminal workspace built for AI-powered development on Windows.

[中文](./README_zh.md)

![openmux Main Window](./screenshots/main.png)

## Why openmux

[cmux](https://github.com/manaflow-ai/cmux) is a great AI-native terminal multiplexer, but it's macOS only. On Windows, there is no equivalent. openmux fills that gap.

## Features

- **Multiple Workspaces** — Independent workspaces, each with its own split layout. Background processes keep running when switching.
- **Split Panes** — Horizontal and vertical splits, drag to resize.
- **Embedded Browser** — Browse the web directly in a panel, with isolated sessions per panel.
- **cmux-style Panels** — Tabs, drag-to-split, context menus. Familiar to cmux users.
- **Layout Persistence** — Workspace layouts are saved on exit and restored on launch.

## Install

Download the latest installer from [Releases](https://github.com/langxke/openmux/releases) and run it.

## Usage

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+N` | New terminal (when workspace is empty) |
| `Ctrl+Shift+N` | New workspace |
| `Ctrl+=` / `Ctrl++` | Zoom in (terminal font / UI) |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Reset zoom |

### Mouse

Double-click the empty space in the tab bar to create a new terminal.

## License

[GPL-3.0](LICENSE)

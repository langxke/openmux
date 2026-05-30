# Tauri 开发经验总结

> 2026-05-30 | glaze 项目从零到 Tauri 原型的实战记录

## 已解决的关键问题

### PTY 生命周期管理

- PTY 是 OS 级资源，所有权不属于 React。使用模块级 `PtySessionManager` 管理
- `ensureSession` / `releaseSession` 模式，500ms 延迟销毁以兼容 React StrictMode 双重挂载
- PTY 输出监听器必须在 `spawnPty` **之前**注册，否则 Rust reader 线程先启动导致初始输出丢失
- `TextDecoder` 必须使用 `{ stream: true }` 防止跨读取边界的多字节 UTF-8 字符损坏

### 工作区切换

- `display: none` 会导致容器尺寸坍缩为 0×0 → PTY 被 resize 到极小尺寸 → shell 输出被换行毁坏
- **根因修复**：用 `visibility: hidden` + `pointer-events: none` 替代 `display: none`，保留布局尺寸
- 子原生 webview 在隐藏工作区中仍然可见（原生层无法感知 HTML 显隐状态），需要手动 `hide()`/`show()`

### Tauri 主线程死锁

- Tauri 同步命令跑在主线程上
- `WebviewWindowBuilder::build()` 内部通过 `run_on_main_thread` 派发到主线程
- 同步命令持有锁 → 等待 `build()` → `build()` 等待主线程 → 主线程被命令阻塞 → **死锁**
- **修复**：涉及窗口操作的命令必须标记为 `async`，跑在线程池而非主线程

## Tauri 的根本局限

### Multi-webview 不成熟

`Window::add_child()` 是唯一真正嵌入窗口内的子 webview API，但：

- 标记为 `unstable` 已超过 2 年，无稳定时间表
- 文档几乎为零
- 子 webview 是原生控件，不在 HTML DOM 中，坐标使用物理像素，需手动转换
- Z-order 管理困难：子 webview 永远浮在 HTML 内容上方
- 切 tab 时需手动 `hide()`/`show()`，无法通过 CSS 控制

### WebviewWindowBuilder 创建的是独立 OS 窗口

`.parent()` 创建的是 owned window（非 child window），需要屏幕坐标定位。移动主窗口后子窗口可跟随，但不是真正的嵌入。

### HTML 布局与原生控件之间的断桥

```
HTML 世界 (dockview/CSS)          原生世界 (WebView2)
     │                                  │
     │   getBoundingClientRect()        │   add_child()
     │   ──────────────────────────→    │
     │   × devicePixelRatio             │
     │   手动坐标转换                      │
     │                                  │
```

Tauri 生态中不存在桥接这两者的通用方案。

## 对比：Tauri vs Electron

| | Tauri | Electron |
|---|---|---|
| 内嵌浏览器 | `add_child()` (unstable, 手动坐标) | `<webview>` (稳定, CSS 自动布局) |
| 终端支持 | `portable-pty` + xterm.js | `node-pty` + xterm.js |
| 包体积 | ~3MB | ~150MB |
| 布局系统 | HTML + 原生控件 (断裂) | 纯 HTML/CSS (统一) |
| 浏览器限制 | 需要手动管理显隐和坐标 | CSS 自动处理一切 |
| 多窗口/工作区 | `visibility:hidden` 可以工作 | 标准 HTML/CSS |
| 成熟度 (终端+浏览器场景) | 实验性，大量自定义代码 | 成熟方案，wmux 已证明可行 |

## 参考项目

- **wmux** (openwong2kim): Electron + xterm.js + `<webview>` + ConPTY，终端+浏览器混合方案的成功案例
- **cmux**: macOS 原生 Swift + AppKit + WebKit，纯原生布局，无 HTML/原生断裂问题
- **Tabby**: Electron + xterm.js，纯终端，无内嵌浏览器

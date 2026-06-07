# PowerShell PTY 会话报错 8009001d (NTE_PROVIDER_DLL_FAIL)

## 症状

在 Electron 应用中通过 node-pty 启动 PowerShell 时，终端显示：

```
Internal Windows PowerShell error. Loading managed Windows PowerShell failed with error 8009001d.
```

CMD 可以正常启动，但 PowerShell 初始化失败。在系统终端中直接运行 `powershell` 正常。

## 根因

`0x8009001d` = `NTE_PROVIDER_DLL_FAIL`，PowerShell 启动时需要从 `%SystemRoot%\System32`（通常为 `C:\Windows\System32`）加载加密服务 DLL。node-pty 使用 `process.env` 作为子进程的环境变量，但 Electron 应用通过 NSIS 安装器或某些场景启动时，`SystemRoot` 环境变量可能未被继承到主进程的 `process.env` 中，导致 PTY 子进程也缺失该变量。

这是多个同类工具（VS Code 终端、Windows Terminal、Codex Desktop）的已知问题。

## 诊断方法

1. 在 Electron 主进程中打印 `process.env.SystemRoot`，检查是否为空或不存在
2. 在系统 PowerShell 中运行 `echo $env:SystemRoot`，确认正常值应为 `C:\Windows`
3. 对比两者即可确认根因

## 修复步骤

在 `pty-manager.ts` 中创建 PTY 时，显式注入 `SystemRoot`：

```typescript
const env = {
  ...(process.env as Record<string, string>),
  TERM: "xterm-256color",
  SystemRoot: process.env.SystemRoot || "C:\\Windows",
};
const ptyProcess = pty.spawn(shellPath, [], {
  name: "xterm-256color",
  cols: cols > 0 ? cols : 80,
  rows: rows > 0 ? rows : 24,
  cwd: cwd === "." ? process.cwd() : cwd,
  env,
});
```

## 失败尝试

- `sfc /scannow`、`DISM /RestoreHealth` — 不适用，系统文件未损坏
- 改为 CMD 作为默认 shell — 规避了问题但失去了 PowerShell 功能
- 在用户系统设置中修改环境变量 — 不是每个用户都能或应该改系统环境变量

## 关键约束

- `SystemRoot` 必须是绝对路径（`C:\Windows`），不能用相对路径
- 需要同时保留 `process.env` 中的其他环境变量，用展开运算符合并
- 此修复仅影响 PTY 子进程，不影响主进程或渲染进程

## 原理

PowerShell 初始化时需要加载 `%SystemRoot%\System32\bcrypt.dll`、`ncrypt.dll` 等加密库。node-pty 的 `pty.spawn()` 会继承父进程环境变量，但如果父进程缺失 `SystemRoot`，子进程的 PowerShell 就无法定位这些 DLL。显式设置 `SystemRoot` 确保了 PowerShell 初始化所需的系统路径始终可用。

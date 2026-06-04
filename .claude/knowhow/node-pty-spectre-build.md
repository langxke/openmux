# node-pty 编译失败：Spectre 缓解库缺失 (MSB8040)

## 症状

在非 VS Developer Command Prompt 环境下运行 `pnpm install` 或 `electron-rebuild` 时，node-pty 编译失败：

```
error MSB8040: 此项目需要缓解了 Spectre 漏洞的库。
从 Visual Studio 安装程序(单个组件选项卡)为正在使用的任何工具集和体系结构安装它们。
```

## 根因

node-pty 的 `binding.gyp` 和 `deps/winpty/src/winpty.gyp` 中设置了 `'SpectreMitigation': 'Spectre'`，要求链接 Spectre 缓解版本的 C++ 运行时库。但 VS Build Tools 默认不安装这些库（体积大、对终端类项目无实际价值）。

## 诊断方法

1. 运行 `npx electron-rebuild -f -w node-pty`
2. 观察错误输出是否包含 `MSB8040` 和 `Spectre`

## 修复步骤

### 1. Patch gyp 文件

将 3 处 `'SpectreMitigation': 'Spectre'` 改为 `'SpectreMitigation': 'false'`：

```
node_modules/node-pty/binding.gyp:9
node_modules/node-pty/deps/winpty/src/winpty.gyp:44
node_modules/node-pty/deps/winpty/src/winpty.gyp:146
```

### 2. 删除旧 build 目录

```bash
rm -rf node_modules/node-pty/build
```

### 3. 从 VS Developer Command Prompt 手动编译

```
# 打开 "Developer Command Prompt for VS 2022"
cd D:\Projects\glaze
npx electron-rebuild -f -w node-pty
```

成功后应产出 `build/Release/conpty.node`、`pty.node`、`conpty_console_list.node`。

### 4. 跳过自动 rebuild

```ts
// forge.config.ts
rebuildConfig: {
  onlyModules: [],  // 空数组 = 不自动 rebuild 任何模块
}
```

## 失败尝试

- **安装 Spectre 缓解库**：体积大（数 GB），对该项目无实际安全价值
- **直接用 npm 安装的 node-pty 预编译二进制**：ABI 不匹配——npm 预编译是为系统 Node.js 编译的，不是 Electron 的 Node.js
- **在 bash/MSYS2 终端运行 electron-rebuild**：`GetCommitHash.bat` 等构建脚本需要 Windows cmd 环境

## 关键约束

- 必须在 **VS 2022 Developer Command Prompt** 中运行编译（不是普通 cmd 或 PowerShell）
- 不要在 `pnpm install` 前配置自动 rebuild——用 `onlyModules: []` 跳过
- 每次 `pnpm install` 后如果 node-pty 的 `build/` 目录被清理，需要重新手动编译

## 原理

`SpectreMitigation: 'Spectre'` 告诉 MSVC 链接器使用 Spectre 缓解版本的运行时库（`/guard:cf` 等）。这些库需要从 VS Installer 单独安装。对于终端模拟器项目，通过进程隔离和 ASLR 已提供充分防护，Spectre 缓解边际收益为零。改为 `'false'` 使用标准运行时库，编译即可通过。

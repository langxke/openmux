# dockview 移除面板组件导致工作区数据丢失

## 症状

从 `panelComponents` 中移除一个已注册的组件类型后，应用启动时所有工作区布局恢复失败，退回到默认单面板状态。保存的布局数据被默认状态覆盖，用户的工作区配置永久丢失。

## 根因

dockview 的 `fromJSON()` 在反序列化布局时，逐个恢复面板。当遇到一个 `contentComponent` 在 `panelComponents` 中不存在的面板时，整个反序列化过程失败，dockview 回退到初始默认状态（一个默认面板）。

更严重的是，应用的工作区持久化机制在布局变化时自动保存（`persistWorkspace()`）。反序列化失败 → 显示默认布局 → 触发 `onDidLayoutChange` → 自动保存默认布局覆盖原有数据文件。

## 诊断方法

1. 确认 `workspaces.json` 中有包含已删除组件类型的面板
2. 在 `api.fromJSON(initialLayout)` 前后添加日志
3. 检查是否有异常抛出或面板数量不符合预期
4. 观察应用是否只显示默认布局

## 修复步骤

**短期恢复**：删除 `workspaces.json`（位于 Electron `userData` 目录），重新开始。

**长期防护**：在移除组件前，确保没有工作区布局依赖该组件。如果只是暂时不需要该组件的创建入口，保留其在 `panelComponents` 中的注册，仅移除创建该面板的 UI 入口。

```tsx
// 组件注册保留（允许反序列化），但不提供创建入口
const panelComponents = {
  terminal: (props) => <TerminalPanel ... />,
  browser: (props) => <BrowserPanel ... />,
  settings: () => <SettingsPanel />,  // 保留注册但不提供新建按钮
};
```

## 失败尝试

- **删除 `workspaces.json` 后重新添加组件**：已删除的布局数据无法恢复，因为默认布局在下一次 `persistWorkspace()` 时覆盖了原文件

## 关键约束

- `panelComponents` 中注册的组件名（key）必须与 `fromJSON` 反序列化时的 `contentComponent` 字段完全匹配
- 工作区持久化采用自动保存机制（布局变化 → 500ms 防抖 → 写入文件），一旦显示默认状态就会覆盖原数据
- 这是开发阶段特有的问题，生产环境中组件注册一般是稳定的。但如果有动态组件注册需求，需要实现降级策略

## 原理

dockview 的序列化/反序列化是严格的：每个面板按 `contentComponent` 查找对应的渲染组件。组件不存在时，`fromJSON` 抛出异常或返回不完整状态，而非跳过未知组件。这与其他序列化框架（如 JSON.parse 忽略未知字段）的行为不同，是 dockview 的设计选择。

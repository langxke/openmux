# 工作区持久化启动竞态导致保存的状态被覆盖

## 症状

应用重启后，之前保存的工作区布局丢失——恢复出来的是初始默认状态（1 个空工作区），而非上次关闭前的多工作区布局。

## 根因

启动时执行顺序：

1. React 初始渲染：1 个工作区 "Workspace 1"（默认状态）
2. DockviewLayout 初始化 → 触发 `persistWorkspace()` → **把默认状态写入 `workspaces.json`，覆盖了之前正确保存的状态**
3. restore effect 异步完成 IPC 调用，读回 `workspaces.json` → 读到的是步骤 2 刚写入的污染数据

原因：persist 是同步可达的（初始化触发），而 restore 是异步的（IPC 调用有延迟）。

## 诊断方法

1. 创建多个工作区，关闭应用
2. 检查 `%APPDATA%/openmux/workspaces.json` 确认状态已保存
3. 重启应用，观察工作区数量
4. 在 `persistWorkspace` 中加 `console.log`，观察启动时是否在 restore 之前就调用了 persist

## 修复步骤

加 `isRestoringRef` 标志，启动恢复期间阻止所有 persist：

```ts
const isRestoringRef = useRef(true);

const persistWorkspace = useCallback(() => {
  if (isRestoringRef.current) return;  // 恢复期间不保存
  if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
  persistTimerRef.current = setTimeout(() => {
    // ... 收集状态 + IPC save
  }, 500);
}, []);

// restore effect
useEffect(() => {
  glaze().workspace.load().then((saved) => {
    // ... 恢复布局
    isRestoringRef.current = false;  // 恢复完成，允许 persist
  });
}, []);
```

## 失败尝试

- **先 restore 再渲染**：需要在 React 挂载前阻塞渲染，不符合 React 范式
- **在 persist 中检查状态是否为默认值**：不可靠，用户可能确实只想保留 1 个空工作区

## 关键约束

- `persistWorkspace` 使用 ref 读取最新值（避免闭包过期），deps 为空数组保持引用稳定
- 500ms debounce 防止频繁写入磁盘
- 恢复完成后才能将 `isRestoringRef` 设为 `false`，不能先渲染布局再异步恢复

## 原理

persist 和 restore 之间的竞态是经典的分布式一致性问题（"最后写入获胜"）。通过 `isRestoringRef` 在恢复窗口期间锁定写操作，保证 restore 总是先于第一次 persist 完成。

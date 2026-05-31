# 工作区持久化

## 存储架构

**文件**：`%APPDATA%/glaze-app/workspaces.json`（与 `glaze.json` 同级）

**格式**：
```json
{
  "sidebar": { "width": 220, "collapsed": false },
  "workspaces": [
    {
      "id": "ws-1",
      "name": "My Workspace",
      "layout": { /* dockview api.toJSON() 全量布局 */ }
    }
  ],
  "activeWorkspaceId": "ws-1",
  "sessionSizes": { "term-abc123": 16 }
}
```

**数据流**：
```
触发动作 → persistWorkspace() [500ms debounce]
  → 收集 dockviewApi.toJSON() + sidebar store + zoom store
  → IPC workspace:save → main process → fs.writeFile
```

```
启动 → IPC workspace:load → main process → fs.readFile
  → setWorkspaceIds / setWorkspaceMeta
  → DockviewLayout 传入 initialLayout → handleReady 调 fromJSON()
```

## `SerializedDockview` — dockview 内置序列化

`api.toJSON()` 返回的 `SerializedDockview` 包含：
- `grid` — 分割树结构（方向、尺寸比例、节点层级）
- `panels[]` — 面板 `id`、`component`、`title`、`params`（终端 shell、浏览器 URL 等）
- `groups[]` — 分组信息（活跃面板、tab 分组）
- `activeGroup` — 当前活跃组

`api.fromJSON(data)` 使用已注册的 component factories 重建所有面板。

## 浏览器 URL 持久化

浏览器面板的 `initialUrl` param 只在创建时设置。用户导航到其他页面后，param 不会自动更新，导致恢复后仍是旧 URL。

**解决方案**：监听 webview `did-navigate` 和 `did-navigate-in-page` 事件，调用 `api.updateParameters()` 同步当前 URL：

```ts
wv.addEventListener("did-navigate", (e) => {
  const url = (e as { url: string }).url;
  if (url && url !== "about:blank") {
    setInputValue(url);
    api.updateParameters({ initialUrl: url });
  }
});
```

这样 `toJSON()` 序列化的是当前实际 URL。`updateParameters` 来自 `DockviewPanelApi`（继承链：`PanelApi → GridviewPanelApi → DockviewPanelApi`）。

## 启动竞态：isRestoringRef 守卫 ★

### 问题
启动时初始状态（1 个工作区 "Workspace 1"）先渲染 → DockviewLayout 初始化触发 `persistWorkspace()` → **把之前正确保存的状态覆盖成 1 个工作区** → restore effect 才异步完成，读回来的就是刚被污染的错误数据。

### 解决方案
加 `isRestoringRef` 标志，启动恢复期间阻止所有 persist：

```ts
const isRestoringRef = useRef(true);

const persistWorkspace = useCallback(() => {
  if (isRestoringRef.current) return;
  // ... save logic
}, []);

// 恢复完成后
isRestoringRef.current = false;
```

## persist 使用 ref 避免闭包过期

`persistWorkspace` 需要读取 `workspaceIds`、`workspaceMeta`、`activeWorkspaceId`。如果在 useCallback 的 deps 中声明这些依赖，每次状态变化都会重建函数，造成 debounce timer 被频繁重置。

**解决方案**：用 ref 存储最新值，`persistWorkspace` 内部从 ref 读取，deps 为空数组：

```ts
const workspaceIdsRef = useRef(workspaceIds);
workspaceIdsRef.current = workspaceIds;

const persistWorkspace = useCallback(() => {
  // 直接读 ref，无闭包过期问题
  workspaceIdsRef.current.map(...)
}, []); // 稳定引用
```

## 恢复后同步 nextWorkspaceNum

`nextWorkspaceNum` 是模块级变量，重启后重置为 1。恢复时需要从已保存的工作区 ID 中计算最大值：

```ts
let maxNum = 1;
for (const wid of restoredIds) {
  const m = wid.match(/^ws-(\d+)$/);
  if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10) + 1);
}
nextWorkspaceNum = maxNum;
```

否则新建工作区会与已恢复的 ID 冲突。

## 恢复时不保留的内容

- PTY 进程内容（OS 级别进程，只能重建 session）
- 浏览器页面 JS 状态（webview 重新加载 URL）
- 终端滚动缓冲区

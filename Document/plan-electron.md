# Plan: Electron（桌面壳与窗口管理）

> 版本：v1.0.0  
> 状态：锁定  > 依赖：spec v1.0.0、constitution v1.0.0、plan-monorepo v1.0.0  > 对应需求：M-01

---

## 1. 目标与边界

Electron 模块负责提供桌面应用外壳：创建无边框主窗口、自定义标题栏、窗口控制按钮、文件对话框，并在生产期以后台子进程方式启动 Backend。

**边界内**：
- 主进程 `main.js` / `main.ts`。
- Preload 脚本 `preload.js` / `preload.ts`。
- 无边框窗口创建与自定义标题栏。
- 窗口控制：最小化、最大化/还原、关闭。
- 开发期加载 Vite dev server；生产期加载 frontend 构建产物。
- 生产期启动 Backend 子进程。
- IPC：`dialog:openSld`、`dialog:saveSld`、`window:minimize`、`window:maximize`、`window:close`。

**边界外**：
- 前端业务 UI（plan-frontend）。
- Backend 业务逻辑（plan-backend）。
- Core 数据模型（plan-core）。

## 2. 核心文件设计

### 2.1 `SourceCode/electron/main.ts`

```typescript
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { fork } from 'node:child_process';

class SLDAgentApp {
  private mainWindow: BrowserWindow | null = null;
  private backendProcess: ReturnType<typeof fork> | null = null;

  async start(): Promise<void>;
  private createWindow(): BrowserWindow;
  private startBackend(): void;
  private registerIpcHandlers(): void;
}
```

### 2.2 窗口配置

- `frame: false`：去除原生标题栏。
- `titleBarStyle: 'hidden'`：隐藏标题栏。
- `width: 1400`, `height: 900`。
- `minWidth: 1200`, `minHeight: 800`。
- `webPreferences`：
  - `preload: path.join(__dirname, 'preload.js')`
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: false`（如需加载本地文件）

### 2.3 `SourceCode/electron/preload.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件对话框
  openSld: () => ipcRenderer.invoke('dialog:openSld'),
  saveSld: (content: string) => ipcRenderer.invoke('dialog:saveSld', content),

  // 窗口控制
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => { ... },
});
```

## 3. 自定义标题栏

前端 `AppTitleBar.vue` 负责渲染自定义标题栏，要求：

- 高度：`40px`。
- 背景：`var(--bg-secondary)`。
- 左侧：应用图标 + 标题 "SLDAgent" + 全局操作按钮（导入 / 导出）。
- 右侧：最小化、最大化/还原、关闭按钮。
- 标题栏主体区域设置 `-webkit-app-region: drag`，允许拖拽移动窗口。
- 按钮区域设置 `-webkit-app-region: no-drag`，确保按钮可点击。
- 双击标题栏最大化/还原窗口。

```vue
<!-- AppTitleBar.vue 伪代码 -->
<div class="h-10 flex items-center justify-between bg-bg-secondary select-none" style="-webkit-app-region: drag;">
  <div class="flex items-center gap-2 no-drag" style="-webkit-app-region: no-drag;">
    <AppIcon />
    <span>SLDAgent</span>
    <button @click="importSld">导入</button>
    <button @click="exportSld">导出</button>
  </div>
  <WindowControls class="no-drag" />
</div>
```

## 4. 窗口控制 IPC

| 通道 | 方向 | 说明 |
| :--- | :--- | :--- |
| `window:minimize` | 渲染 → 主进程 | 最小化窗口。 |
| `window:maximize` | 渲染 → 主进程 | 最大化/还原窗口（主进程根据当前状态切换）。 |
| `window:close` | 渲染 → 主进程 | 关闭窗口；主进程在关闭前优雅终止 backend 子进程。 |
| `window:maximized-change` | 主进程 → 渲染 | 通知前端窗口最大化状态变化，用于更新按钮图标。 |

## 5. 文件对话框 IPC

| 通道 | 方向 | 载荷 | 说明 |
| :--- | :--- | :--- | :--- |
| `dialog:openSld` | 渲染 → 主进程 → 渲染 | `{ filePath: string, content: string }` | 显示打开文件对话框，过滤 `.sld` / `.xml`。 |
| `dialog:saveSld` | 渲染 → 主进程 | `{ filePath: string, content: string }` | 显示保存文件对话框。 |

## 6. 开发期与生产期行为

| 阶段 | Frontend 加载方式 | Backend 启动方式 | 前后端通信 |
| :--- | :--- | :--- | :--- |
| 开发期 | `http://localhost:5173`（Vite dev server） | `npm run dev:backend` 独立启动 | WebSocket |
| 生产期 | `file://.../frontend/dist/index.html` | Electron 主进程 `fork` backend 子进程 | WebSocket（本地回环） |

## 6.1 生产期资源路径

| 资源 | 开发期位置 | 生产期处理 |
| :--- | :--- | :--- |
| Registry JSON | `SourceCode/data/registry/*.json` | Vite 复制到 `frontend/dist/registry/`；前端通过相对路径 `fetch('./registry/...')` 加载 |
| Sample GeoJSON | `SourceCode/data/sample/*.geojson` | Vite 复制到 `frontend/dist/sample/`；`MapPreview` 通过相对路径加载 |
| Backend 产物 | `SourceCode/backend/dist/` | electron-builder 打包到应用目录；`main.ts` 通过 `app.getAppPath()` / `__dirname` 解析 |
| `config.json` | `SourceCode/config/config.json` | 优先读取用户数据目录（`app.getPath('userData')/config.json`），回退到应用内置模板；不打包真实 Key |

Backend 启动时通过 `process.env.SLDAGENT_CONFIG_PATH` 或默认相对路径定位 `config.json`。

| 决策 | 方案 | 原因 |
| :--- | :--- | :--- |
| 标题栏 | 无边框 + 前端自定义标题栏 | 与 UX 暗色制图工作台风格统一。 |
| 窗口控制 | 前端按钮 → IPC → 主进程执行 | 无边框窗口必须通过主进程控制窗口状态。 |
| Preload | 使用 `contextBridge` 暴露安全 API | 避免 `nodeIntegration: true` 带来的安全风险。 |
| 生产期后端启动 | Electron 主进程 `fork` backend | 用户无感知启动，打包为一个应用。 |
| 通信方式 | 开发与生产均使用 WebSocket | 前后端协议一致，IPC 仅用于窗口/文件等原生能力。 |

## 8. 任务清单

- [DE-001] 初始化 `SourceCode/electron/package.json`。
- [DE-002] 实现 `main.ts`：无边框窗口、加载 frontend、注册 IPC。
- [DE-003] 实现 `preload.ts`：暴露 `electronAPI`。
- [DE-004] 前端实现 `AppTitleBar.vue`：导入/导出按钮、窗口控制按钮、拖拽区域。
- [DE-005] 前端实现 `WindowControls.vue`：最小化、最大化/还原、关闭。
- [DE-006] 实现 `window:*` IPC 处理。
- [DE-007] 实现 `dialog:openSld` / `dialog:saveSld` IPC 处理。
- [DE-008] 生产期打包：配置 electron-builder，包含 frontend dist 与 backend 产物。
- [DE-009] 测试窗口控制与文件对话框。

## 9. 风险与依赖

- **拖拽与按钮冲突**：标题栏整体可拖拽时，按钮必须设置 `-webkit-app-region: no-drag`，否则无法点击。
- **生产期 backend 路径**：electron-builder 打包后，backend 子进程路径需正确解析。
- **安全**：preload 暴露的 API 必须最小化，禁止暴露 `require` 或 `ipcRenderer` 直接调用。
- **跨平台差异**：Windows 最大化/还原行为与 macOS 不同，需在主进程中统一处理。

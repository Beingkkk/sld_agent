# Proposal: 修复导入导出图标并支持导出后打开所在目录

> **类型**：Type-C（UI/交互优化）  
> **编号**：0004  
> **状态**：IMPLEMENTED  
> **提出日期**：2026-06-17  
> **实现日期**：2026-06-17  
> **依赖**：proposal-0001（已落地 MVP 源码）

---

## 1. 问题描述

1. **导入/导出图标与文案不匹配**：当前 [AppTitleBar.vue](SourceCode/frontend/src/components/titlebar/AppTitleBar.vue) 中：
   - 「导入」按钮使用的是**向上箭头**（通常表示导出/上传）；
   - 「导出」按钮使用的是**向下箭头**（通常表示导入/下载）。
   两者应互换。

2. **导出后没有打开文件所在目录**：用户保存 SLD 文件后，希望系统自动打开文件资源管理器并定位到该文件，方便后续查看/分享。

## 2. 变更目标

- 交换标题栏导入、导出按钮的 SVG 图标，使其与文案语义一致。
- 导出成功后，调用 Electron `shell.showItemInFolder(filePath)` 打开文件所在目录并高亮该文件。
- 浏览器降级模式下不执行打开目录操作。

## 3. 变更范围

### [MODIFIED] 前端

- `SourceCode/frontend/src/components/titlebar/AppTitleBar.vue`
  - 交换两个按钮的 SVG 图标。
  - `handleExport` 在 `saveSld` 成功后读取返回的 `filePath`，调用 `showItemInFolder`。
- `SourceCode/frontend/src/env.d.ts`
  - 补充 `showItemInFolder` 类型；修正 `saveSld` 返回类型与 preload 一致。
- `SourceCode/frontend/src/electron/ipc.ts`
  - 新增 `showItemInFolder(filePath)` 辅助函数。

### [MODIFIED] Electron 主进程 / Preload

- `SourceCode/electron/src/preload.ts`
  - `ElectronAPI` 接口与暴露对象新增 `showItemInFolder`。
- `SourceCode/electron/src/main.ts`
  - 引入 `shell`；注册 `shell:showItemInFolder` IPC handler。

## 4. 与 Plan 的对应关系

| Plan | 对应章节 |
| :--- | :--- |
| `plan-frontend.md` | §3 标题栏 / 工具栏交互 |
| `plan-electron.md` | §4 IPC 设计、§5 文件对话框 |

## 5. 验收标准

- [x] 「导入」按钮显示向下进入盒子的图标（下载/导入语义）。
- [x] 「导出」按钮显示向上离开盒子的图标（上传/导出语义）。
- [x] Electron 环境下导出成功后，自动打开文件资源管理器并高亮刚保存的 `.sld` 文件。
- [x] 浏览器降级导出（Blob 下载）不报错、不尝试调用 Electron API。
- [x] `npm run build --workspace=@sldagent/electron` 与 `npm run build --workspace=@sldagent/frontend` 通过。

## 6. 风险与回退

- **非 Electron 环境**：`window.electronAPI` 不存在时，`showItemInFolder` 不会被调用，避免报错。
- **文件路径为空/保存取消**：`saveSld` 返回 `filePath: null` 时跳过打开目录。
- **回退**：将图标 SVG 换回原顺序，并移除 `showItemInFolder` 调用即可。

## 7. 实现备注

- 使用 Electron 原生 `shell.showItemInFolder(path)`，Windows 上会在资源管理器中选中文件，macOS 上在 Finder 中显示，Linux 上由桌面环境处理。
- 由于 preload 通过 `contextBridge` 暴露 API，新增能力必须同时在 interface、expose 对象、main IPC handler 与前端类型中注册。

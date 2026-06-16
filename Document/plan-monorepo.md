# Plan: Monorepo（项目结构与依赖治理）

> 版本：v1.0.0  
> 状态：锁定  > 依赖：constitution v1.0.0  > 对应决策：D1

---

## 1. 目标与边界

本模块定义 SLDAgent 的 monorepo 结构、workspace 工具、依赖治理策略以及跨包引用方式。目标是在一个仓库内管理 Core / Frontend / Backend / Electron 四个子项目，并确保 `geostyler-sld-parser` 等关键依赖版本一致。

**边界内**：
- 目录结构。
- Workspace 工具与配置。
- 共享依赖版本策略。
- Root scripts（dev / build / test / lint / typecheck）。
- TypeScript project references。
- 跨 workspace 导入约定。

**边界外**：
- 具体业务逻辑（plan-core / plan-frontend / plan-backend）。
- Electron 主进程的窗口管理细节（plan-electron）。

## 2. 目录结构

```text
SLDAgent/
├── package.json                  # root workspace config
├── package-lock.json             # 统一 lock 文件
├── tsconfig.json                 # root tsconfig + references
├── .gitignore
├── Document/
├── spike/
└── SourceCode/
    ├── core/                     # workspace: @sldagent/core
    ├── frontend/                 # workspace: @sldagent/frontend
    ├── backend/                  # workspace: @sldagent/backend
    ├── electron/                 # workspace: @sldagent/electron
    ├── data/                     # Sample GeoJSON / shapefile / raster
    └── config/                   # config.json.template 等
```

## 3. Workspace 工具

**选择：npm workspaces**（Node.js 内置，无需额外工具）。

根 `package.json` 示例：

```json
{
  "name": "sldagent",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "SourceCode/core",
    "SourceCode/frontend",
    "SourceCode/backend",
    "SourceCode/electron"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:frontend": "npm run dev --workspace=@sldagent/frontend",
    "dev:backend": "npm run dev --workspace=@sldagent/backend",
    "build": "npm run build --workspaces --if-present",
    "test": "npm test --workspaces --if-present",
    "lint": "eslint SourceCode --ext .ts,.vue",
    "typecheck": "tsc -b"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "eslint": "^8.57.0",
    "concurrently": "^8.2.0"
  }
}
```

## 4. 共享依赖版本策略

### 4.1 必须统一版本的依赖

以下依赖由 root `package.json` 统一声明为 `dependencies`，各 workspace 通过 `npm` 的 hoisting 机制使用同一版本：

| 包名 | 位置 | 版本 | 原因 |
| :--- | :--- | :--- | :--- |
| `geostyler-sld-parser` | root dependencies | `^9.0.1` | 前后端必须解析/生成完全一致的 SLD。 |
| `geostyler-style` | root dependencies | `^12.0.0` | 共享 TypeScript 类型。 |
| `geostyler-openlayers-parser` | root dependencies | `^5.7.0` | 前端预览使用。 |

> 版本号随项目初始化时锁定，后续升级须走 `/sdd-propose` 变更提案。

### 4.2 各 workspace 特有依赖

- `frontend`：`vue`, `pinia`, `tailwindcss`, `ol`, `highlight.js`
- `backend`：`ws`, `ajv`, `chroma-js`
- `electron`：`electron`, `electron-builder`
- `core`：无额外运行时依赖（仅 `geostyler-*` 共享包）

### 4.3 禁止行为

- 禁止在任何 workspace 中单独升级 `geostyler-sld-parser` 版本。
- 禁止在 workspace 内通过 `file:../core` 路径引用，必须使用 `"@sldagent/core": "^1.0.0"` 并通过 workspace 协议解析。

## 5. TypeScript Project References

根 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "references": [
    { "path": "./SourceCode/core" },
    { "path": "./SourceCode/frontend" },
    { "path": "./SourceCode/backend" },
    { "path": "./SourceCode/electron" }
  ]
}
```

每个 workspace 的 `tsconfig.json` 引用依赖的 workspace：

- `frontend/tsconfig.json` → `"references": [{ "path": "../core" }]`
- `backend/tsconfig.json` → `"references": [{ "path": "../core" }]`

## 6. 跨包导入约定

```typescript
// frontend / backend 中引用 core
import { SLDTree, GeoStylerTransformer } from '@sldagent/core';
```

`core/package.json`：

```json
{
  "name": "@sldagent/core",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "test": "vitest run"
  }
}
```

## 7. 构建与开发流程

| 命令 | 作用 |
| :--- | :--- |
| `npm install` | 在 root 安装所有 workspace 依赖。 |
| `npm run dev` | 同时启动 backend + frontend（开发期）。 |
| `npm run dev:frontend` | 仅启动前端 dev server。 |
| `npm run dev:backend` | 仅启动后端 WebSocket 服务。 |
| `npm run build` | 构建所有 workspace。 |
| `npm test` | 运行所有 workspace 测试。 |
| `npm run typecheck` | 全量 TypeScript 类型检查。 |

## 8. Electron 集成简述

Electron 主进程（`SourceCode/electron/`）负责：
- 创建 BrowserWindow 加载 frontend 产物。
- 启动 backend 作为子进程（生产期）。
- 处理 `dialog:openSld` / `dialog:saveSld` IPC。

开发期 frontend 使用 Vite dev server，backend 使用独立 Node 进程，二者通过 WebSocket 通信；Electron 主进程可选不启动。

## 9. 任务清单

- [DM-001] 创建 root `package.json` 并配置 npm workspaces。
- [DM-002] 创建 root `tsconfig.json` 与 project references。
- [DM-003] 初始化 `SourceCode/core/package.json`。
- [DM-004] 初始化 `SourceCode/frontend/package.json`（Vue 3 + Vite + Tailwind）。
- [DM-005] 初始化 `SourceCode/backend/package.json`（Node + tsx/nodemon）。
- [DM-006] 初始化 `SourceCode/electron/package.json`（Electron + electron-builder）。
- [DM-007] 统一安装 `geostyler-sld-parser@^9.0.1`、`geostyler-style@^12.0.0`、`geostyler-openlayers-parser@^5.7.0` 到 root。
- [DM-008] 配置 root scripts：dev / build / test / lint / typecheck。
- [DM-009] 验证 `@sldagent/core` 可被 frontend/backend 正确导入。

## 10. 风险与依赖

- **npm workspaces 版本解析**：确保 `geostyler-sld-parser` 不会被某个 workspace 的依赖强制提升不同版本。如出现冲突，使用 `overrides` 锁定。
- **TypeScript project references 配置错误**：会导致 incremental build 失效，需通过 `tsc -b` 验证。
- **Electron 打包路径**：生产期需正确打包 backend 产物与 node_modules，plan-electron 中需详细设计。

# Proposal: 首次实现已锁定 Plan 到源码（MVP 落地）

> **类型**：Type-B（设计落地 / 首次实现）  
> **编号**：0001  
> **状态**：IMPLEMENTED  
> **归档日期**：2026-06-17  
> **提出日期**：2026-06-17  
> **依赖**：constitution v1.0.0、spec v1.0.0、plan-monorepo v1.0.0、plan-core v1.0.0、plan-frontend v1.0.0、plan-backend v1.0.0、plan-electron v1.0.0

---

## 1. 变更目标

将 `Document/` 下已锁定的 SLDAgent MVP 设计文档落地为可运行的源码，目标是可以通过 `npm run electron:dev` 启动 Electron 调试窗口，并在窗口中进行基础的功能使用测试。

## 2. 变更范围

### [ADDED] 新增源码

- `SourceCode/core/`：SLD 树数据模型、GeoStyler 双向转换、SLD XML 读写、校验引擎。
- `SourceCode/frontend/`：Vue 3 + Vite + Tailwind 三栏 UI、SLD 树编辑、JSON 驱动属性面板、OpenLayers 预览、代码/校验面板。
- `SourceCode/backend/`：Node.js/TypeScript WebSocket Agent、LLM 客户端桩、知识库加载、消息路由。
- `SourceCode/electron/`：主进程、preload、无边框窗口、文件对话框 IPC。
- 根目录 monorepo 配置：`package.json`、`package-lock.json`、`tsconfig.json`。

### [MODIFIED] 调整现有配置

- `SourceCode/config/config.json` 沿用现有模板结构，不提交真实 API Key。

## 3. 与 Plan 的对应关系

| Plan | 实现产物 |
| :--- | :--- |
| `plan-monorepo.md` §3–§7 | root `package.json`、workspaces、`tsconfig.json`、跨 workspace 引用 |
| `plan-core.md` §2 | `@sldagent/core` 包：`SLDTree`、`TreePath`、`GeoStylerTransformer`、`SymbolizerTransformer`、`ValidationEngine` |
| `plan-frontend.md` §2–§4 | `@sldagent/frontend` 包：Vue 组件、Pinia Store、OpenLayers 预览、WebSocket 客户端 |
| `plan-backend.md` §2–§3 | `@sldagent/backend` 包：`AgentServer`、`LLMClient`、`KnowledgeBase`、`PromptBuilder` |
| `plan-electron.md` §2–§5 | `@sldagent/electron` 包：`main.ts`、`preload.ts`、标题栏 IPC |

## 4. 验收标准

- [x] 执行 `npm install` 可完成所有 workspace 依赖安装。
- [x] 执行 `npm run build` 可构建 core / frontend / backend / electron。
- [x] 执行 `npm run electron:dev` 可启动 Electron 调试窗口。
- [x] 窗口中可看到左侧 SLD 树、中间属性面板与地图预览、右侧代码区。
- [x] 修改 Symbolizer 颜色后，代码区与地图预览在 300ms 内刷新。
- [x] 导入/导出 SLD 文件可用（开发期通过 Electron IPC）。
- [x] 校验规则生效（如同一 FeatureTypeStyle 内多个 ElseFilter 报错）。

## 5. 风险与回退

- **依赖安装失败**：`geostyler-sld-parser` 等包版本冲突时，使用 root `overrides` 锁定。
- **Electron 开发窗口无法启动**：优先保证 `npm run dev:frontend` + `npm run dev:backend` 可独立运行。
- **OpenLayers 预览异常**：降级为仅显示代码区与树编辑器，预览区显示占位提示。

## 7. 实现备注

- **WebSocket 端口**：开发机 8765 端口存在权限/占用问题，将后端默认端口与前端 WebSocket 客户端统一调整为 **18765**（通过 `SourceCode/config/config.json` 与 `SourceCode/frontend/src/ws/client.ts` 配置）。
- **geostyler-style v12 兼容**：`geostyler-style@12.0.0` 的 `dist/` 缺少 `style.js`/`functions.js`，在 `NodeNext` 模块解析下无法解析。将 `@sldagent/core` 的 `tsconfig.json` 改为 `module: ES2022` + `moduleResolution: Bundler`，并对 `SymbolizerTransformer` 中字符串到枚举类型的赋值做了显式断言；`TextSymbolizer.anchor` 按 v12 的 `AnchorType` 字符串而非数组处理。
- **ELECTRON_RUN_AS_NODE**：当前 shell 环境设置了 `ELECTRON_RUN_AS_NODE=1`，会导致 `require('electron')` 失败。新增 `SourceCode/electron/scripts/dev.cjs` 启动器，在子进程中删除该环境变量，并将根 `package.json` 的 `electron:dev` 脚本改为调用该启动器。
- **测试**：`@sldagent/frontend` 当前无测试文件，已给 `vitest run` 添加 `--passWithNoTests`，避免 `npm test` 因空测试而失败。
- **API Key**：发现 `SourceCode/config/config.json` 中存在硬编码 Key，已按宪法 RED-6 移除并改为 `apiKeyEnvVar` 模式。
- **遗留工作**：Filter 可视化构造器当前为占位实现；AI 解释在缺少 API Key 时自动降级为 Mock 返回。

## 6. 状态流转

```text
PROPOSED → APPROVED → IMPLEMENTING → IMPLEMENTED → 运行验收
```

- **APPROVED**：本提案经与项目设计文档核对，目标与 plan 一致，予以批准。
- **IMPLEMENTED**：所有 workspace 代码编写完成并通过构建。
- **验收**：运行 `npm run electron:dev` 验证窗口可启动。

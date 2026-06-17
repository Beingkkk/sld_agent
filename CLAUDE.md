# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# SLDAgent 项目指南

SLDAgent 是一个基于 **Electron + Vue 3 + Node.js/TypeScript** 的桌面端 SLD（Styled Layer Descriptor）智能样式编辑器。

> **当前状态**：项目处于设计落地阶段。`Document/` 下已锁定 constitution、spec、plan-core、plan-frontend、plan-backend、plan-electron、plan-monorepo、plan-knowledge、**plan-filter**；`SourceCode/data/` 已放置 JSON 注册表、知识库、预转换的 Sample GeoJSON 与本地字体；`SourceCode/core` 已实现 SLD 树、Transformer、ValidationEngine、FilterTransformer 并包含测试；`SourceCode/frontend` 已实现 Vue 3 三栏 UI、树编辑、JSON 驱动属性面板、OpenLayers 地图预览、代码/XML 显示；`SourceCode/backend` / `electron` 已搭建骨架但核心逻辑待完善。root `package.json` 与 workspaces 已启用，可运行 `npm install`、`npm run typecheck`、`npm test`、`npm run build`。

---

## 1. 核心设计文档（优先阅读）

在修改任何代码前，应先阅读以下文档：

| 文档 | 路径 | 内容 |
| --- | --- | --- |
| 宪法 | [`Document/constitution.md`](Document/constitution.md) | 技术栈约束、红色条款、质量门禁、文档效力层级 |
| 产品规格 | [`Document/spec.md`](Document/spec.md) | MVP MoSCoW、验收场景、数据模型、关键术语 |
| 架构与需求设计书 | [`Document/Research/调研方案.md`](Document/Research/调研方案.md) | 项目背景、核心需求、顶层架构、Roadmap |
| 树结构与 SLD 映射 | [`Document/Research/调研设计.md`](Document/Research/调研设计.md) | 完整 SLD 树层级、TypeScript 类型、比例尺与 ElseFilter 交互 |
| GeoStyler 复用报告 | [`Document/Research/GeoStyler复用报告.md`](Document/Research/GeoStyler复用报告.md) | GeoStyler 生态、依赖清单、集成方案、风险 |
| UX 设计规范 | [`Document/UX/design.md`](Document/UX/design.md) | 视觉系统、布局规范、组件状态、交互说明、本地字体决策 |
| 可交互原型 | [`Document/UX/prototype.html`](Document/UX/prototype.html) | 可直接用浏览器打开查看的 HTML 原型 |

模块设计 plan：

| Plan | 路径 | 内容 |
| --- | --- | --- |
| Core | [`Document/plan-core.md`](Document/plan-core.md) | SLD 树、Transformer、ValidationEngine、Symbolizer 映射层 |
| Frontend | [`Document/plan-frontend.md`](Document/plan-frontend.md) | Vue 三栏 UI、JSON 驱动属性面板、OpenLayers 预览 |
| Backend | [`Document/plan-backend.md`](Document/plan-backend.md) | Node/TS Agent、LLM、StyleBuilder、RuleGenerator |
| Filter | [`Document/plan-filter.md`](Document/plan-filter.md) | 节点树 Filter 编辑器、CQL 预览 |
| Electron | [`Document/plan-electron.md`](Document/plan-electron.md) | 无边框窗口、自定义标题栏、IPC、生产期资源路径 |
| Monorepo | [`Document/plan-monorepo.md`](Document/plan-monorepo.md) | 目录结构、workspace、依赖治理、构建脚本 |
| Knowledge | [`Document/plan-knowledge.md`](Document/plan-knowledge.md) | JSON 注册表、知识库、LLM 输入治理 |

---

## 2. 顶层架构

项目采用 **monorepo + 前后端分离 + 单向数据流 + AI 解释层** 的架构。

```text
┌─────────────────────────────────────────────────────────────┐
│                    Electron + Vue 3 前端                     │
│  ┌──────────────┐  ┌──────────────────────┐  ┌──────────┐  │
│  │   SLD 树编辑  │  │   属性面板 + 地图预览 │  │ 代码 + AI │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                   │            │
│         └─────────────────┼───────────────────┘            │
│                           │                                 │
│              SourceCode/data/registry/*.json                │
│              （字段定义 / Symbolizer schema / 编辑器类型）    │
└───────────────────────────┬─────────────────────────────────┘
                            │ WebSocket
┌───────────────────────────┼─────────────────────────────────┐
│              Node.js / TypeScript Agent 后端                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  LLM 语义解析  │  │ StyleBuilder │  │ geostyler-sld-   │  │
│  │  知识库注入    │  │ RuleGenerator│  │ parser write/read│  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────────────────────────────┐                  │
│  │ SourceCode/data/knowledge/*.json       │                  │
│  │ （SLD 速查 / 约束 / Few-shot 样例）     │                  │
│  └──────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 核心数据流

1. 前端树编辑器维护**唯一的 Store**（以 GeoStyler Style 为中间模型）。
2. 用户操作更新 Store 后，同步触发：
   - 属性面板从 `SourceCode/data/registry/*.json` 动态渲染；
   - 预览地图通过 `geostyler-openlayers-parser` 渲染；
   - 右侧代码区显示 GeoStyler JSON 与 SLD XML。
3. AI 功能由后端调用 LLM，前端只负责展示解释文本与预警。

---

## 3. 常用命令

> 以下命令已在 root `package.json` 与 workspaces 中启用：

```bash
# 安装所有 workspace 依赖
npm install

# 开发模式同时启动 frontend + backend
npm run dev

# 独立启动前端（Vite dev server）
npm run dev:frontend

# 独立启动后端（Node/TS WebSocket Agent）
npm run dev:backend

# 构建所有 workspace
npm run build

# 运行所有 workspace 测试
npm test

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 打包 Electron 应用
npm run dist
```

单测试命令待具体测试框架（如 vitest）初始化后补充，通常为：

```bash
npm test -- --run src/path/to/test.spec.ts
```

---

## 4. 代码组织

`SourceCode/` 采用 npm workspaces monorepo 结构：

```text
SourceCode/
├── core/                  # @sldagent/core：SLD 树、Transformer、ValidationEngine
├── frontend/              # @sldagent/frontend：Vue 3 前端
│   ├── src/
│   │   ├── components/    # Vue SFC 组件（tree / property / preview / code / filter 等）
│   │   ├── composables/   # 可复用组合式函数（如地图初始化 usePreviewMap）
│   │   ├── services/      # 无 UI 业务逻辑（如 preview-style 解析与 fallback）
│   │   ├── store/         # Pinia Store，维护 SLD 树与 transform 结果
│   │   ├── ws/            # WebSocket 客户端
│   │   └── ...
│   └── public/            # 静态资源（字体、图标等），不存放 sample GeoJSON
├── backend/               # @sldagent/backend：Node/TS Agent 后端
├── electron/              # @sldagent/electron：主进程、preload、打包
├── data/                  # 外置 JSON 资源（registry + knowledge + sample + fonts）
└── config/                # 配置文件模板（config.json.template）
```

外置资源：

```text
SourceCode/data/
├── registry/
│   ├── editor-types.json
│   ├── field-registry.json
│   ├── node-schemas.json
│   └── symbolizer-schemas.json
├── knowledge/
│   ├── root.json
│   ├── default.json
│   ├── sld-reference.json
│   └── examples.json
├── sample/                # Sample GeoJSON（由 shapefile 预转换）/ shapefile 源 / raster
└── fonts/                 # 本地字体：Space Grotesk / IBM Plex Sans / JetBrains Mono
```

---

## 5. SLD 生成链路（关键）

树 → 每个 FeatureTypeStyle 单独构造 GeoStyler Style → `geostyler-sld-parser.writeStyle()` 生成各 FTS 的 SLD 片段 → `fast-xml-parser` 后处理拼接为完整 SLD XML，并补回 UserStyle / FeatureTypeStyle / Rule 的扩展元数据。

导入时反向：先用 `fast-xml-parser` 解析 SLD XML 结构，按 `<FeatureTypeStyle>` 边界切分，再对每个片段调用 parser 读取为 GeoStyler JSON，最后还原为树。

---

## 6. SDD 工作流纪律

本项目使用 **SDD（Specification-Driven Development）** 规范驱动开发。编码前必须遵守：

- 禁止无 plan 直接编码。
- 禁止直接修改已锁定的 spec 或 plan。
- 所有变更必须先创建 `Document/changes/proposal-{NNNN}.md`，审阅通过后再实现。
- 公共接口必须在对应 plan 的「接口定义」章节中描述。
- 新增代码必须伴随测试。
- 需求变更必须同步更新 spec。

---

## 7. 关键决策记录

### 7.1 为什么用 GeoStyler 但不直接用 GeoStyler React UI？

GeoStyler 主包是 React + Ant Design，而 SLDAgent 前端是 Vue 3。复用报告结论：只复用 parser 与数据模型，UI 组件参考其设计后自行实现。

### 7.2 为什么后端用 Node.js/TypeScript？

`geostyler-sld-parser` 是 Node 包。直接用 Node/TS 调用 parser 可以避免 Python 与 Node 之间的子进程桥接，保证前后端对 SLD 的理解一致。

### 7.3 数据模型以什么为基准？

以 **GeoStyler Style** 为中间模型。前端 Store、后端 Builder、LLM 输出 Schema 都围绕 GeoStyler Style 字段设计，最终通过 `geostyler-sld-parser.writeStyle()` 输出 SLD XML。

### 7.4 项目为什么用 monorepo？

`geostyler-sld-parser` 等关键依赖必须前后端版本一致。monorepo + root lock 文件可以统一管理版本；`@sldagent/core` 被 frontend/backend 共享，避免代码复制。

### 7.5 为什么属性面板要 JSON 驱动？

`SourceCode/data/registry/field-registry.json` 同时服务前端渲染与 LLM 知识注入。新增 Symbolizer 字段或类型时，只需改 JSON，无需新增 Vue 表单组件。

### 7.6 为什么 Electron 用无边框窗口？

为了严格对齐 [`Document/UX/design.md`](Document/UX/design.md) 的暗色制图工作台风格。标题栏由前端 `AppTitleBar.vue` 自定义实现，高度 40px，窗口控制通过 IPC 调用主进程。

### 7.7 为什么开发与生产都用 WebSocket？

前后端通信协议保持一致，避免双路径代码；IPC 仅用于 Electron 原生能力（窗口控制、文件对话框）。

### 7.8 全新启动阶段补充决策

- **Symbolizer kind 命名**：采用 GeoStyler 原生命名 `Mark` / `Line` / `Fill` / `Text`，UI 通过 `symbolizer-schemas.json` 的 `userLabel` 展示中文；树 → GeoStyler 之间由 Core `SymbolizerTransformer` 显式映射。
- **树节点标签**：仅显示简化 XML 标签名（如 `NamedLayer`、`UserStyle`、`PointSymbolizer`），不显示 `sld:` 前缀、kind 或中文语义。
- **NamedLayer / UserStyle 数量**：MVP 仅允许各一个；导入多容器 SLD 时保留第一个并给出 warning。
- **Filter 编辑器**：采用节点树形式（AND / OR / NOT / 比较条件），CQL 仅作只读预览。
- **字体加载**：本地 TTF 文件，保证离线优先；文件位于 `SourceCode/frontend/public/fonts/`。
- **Sample 数据**：shapefile 源数据保留在 `SourceCode/data/sample/`，运行时统一读取预转换后的 GeoJSON。
- **属性面板分组**：Symbolizer 按 `symbolizer-schemas.json` 的 `groups` 分组折叠；Rule 按 `node-schemas.json` 的 `groups` 分组；UserStyle / FeatureTypeStyle 保持扁平。
- **XML 后处理**：因 GeoStyler 不原生支持 FeatureTypeStyle 容器与部分扩展元数据，Core 使用 `fast-xml-parser` 做 parser 分片后的 SLD XML 拼接与元数据补回。
- **校验错误定位**：MVP 定位到树节点级，字段级精确定位放到 Phase 2。
- **AI 行为**：AI 仅返回自然语言解释与预警，**不直接修改树**，不提供“应用建议”按钮。

### 7.9 Sample 数据为什么不放在 `public/sample/`？

离线场景下字体可以放在 `public/`，但示例 GeoJSON 属于业务数据，应统一收口到 `SourceCode/data/sample/`。前端通过 Vite 的 `@data` 别名与 `assetsInclude: ['**/*.geojson']` 在运行时引用，避免数据重复。

### 7.10 OpenLayers 预览的样式函数 workaround

`geostyler-openlayers-parser` 对 Mark/Line/Fill 返回 `Style` 实例，对 Text 返回 `StyleFunction`。OpenLayers 10 在某些场景下直接接收 `Style` 实例会触发 flat-style 转换并抛错（`No fill, stroke, point, or text symbolizer properties in style`）。Core 侧或前端需在应用样式前统一包装为 `StyleFunction`。

---

## 8. 开发注意事项

- 不要在源码中硬编码 API Key、LLM endpoint 等敏感信息，应通过 `SourceCode/config/config.json` 或环境变量注入；`config.json` 不提交仓库，仅保留 `config.json.template`。
- 不要手写 SLD XML 构造器，所有 SLD 生成必须经过 `geostyler-sld-parser`。
- 前后端应使用同一版本的 `geostyler-sld-parser`，由 root `package-lock.json` 统一管理。
- 预览区使用内置 Sample GeoJSON 作为 MVP 数据，后续再支持用户上传；Sample GeoJSON 仅保留在 `SourceCode/data/sample/`，不复制到 `public/sample/`。
- OpenLayers 10 对 `geostyler-openlayers-parser` 直接返回的 Mark/Line/Fill `Style` 实例存在 flat-style 转换问题，需通过 `normalizeOlStyle()` 包装为 `StyleFunction`。
- 复杂组件优先把无 UI 逻辑拆入 `services/`，把生命周期/状态复用逻辑拆入 `composables/`，保持 Vue SFC 只负责 UI 与组合。
- FeatureTypeStyle 的 `title` / `abstract` / `featureTypeName` 当前不被 GeoStyler JSON 直接支持，生成 SLD 时需要额外保留。
- 属性面板字段定义在 `SourceCode/data/registry/field-registry.json`；修改字段元数据时，需同步检查前端编辑器组件、Core `SymbolizerTransformer` 映射与 LLM prompt 是否兼容。
- Filter 节点树存储在 Rule 节点中，由 Core `FilterTransformer` 与 GeoStyler Filter 数组双向转换。

---

## 9. 相关外部资源

- GeoStyler 官方文档：https://geostyler.github.io/geostyler/latest/index.html
- GeoStyler Style 类型文档：https://geostyler.github.io/geostyler-style/docs/master/
- OGC SLD 1.0.0 Schema：[`Document/Research/sld/1.0.0/StyledLayerDescriptor.xsd`](Document/Research/sld/1.0.0/StyledLayerDescriptor.xsd)
- SLD 1.0.0 样例：[`Document/Research/sld/1.0.0/example-sld.xml`](Document/Research/sld/1.0.0/example-sld.xml)
- GeoStyler 源码参考：[`Document/Research/geostyler-main/`](Document/Research/geostyler-main/)

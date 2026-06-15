# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

**SLDAgent** 将自然语言地图样式请求转换为 OGC SLD 1.0.0 XML。

核心流水线：

```
自然语言指令
        ↓
LLM 语义解析（受 JSON Schema 约束）
        ↓
StyleParams
        ↓
ParamsNormalizer（LLM 别名映射）
        ↓
StyleBuilder
        ↓
GeoStyler Style
        ↓
geostyler-sld-parser
        ↓
SLD 1.0.0 XML
        ↓
OGC XSD 校验（xmllint / xmllint-wasm）+ Parser Roundtrip 校验
```

项目遵循 **SDD（规范驱动开发）**：`Document/` 下的需求与设计文档是编写 `Document/spec.md` 和 `Document/plan-{module}.md` 的前置输入，之后才能进入编码。

## 当前阶段

- **设计**：已完成并对齐 MVP 参数化精修方向，见 [`Document/design/`](Document/design/)。
  - 关键更新：右侧检查器原型改为左右双列——左侧可编辑 GeoStyler / 参数精修 / 规则列表，右侧只读 SLD XML。
- **P0 Spike**：全部完成，结论已反向同步到 design 文档。
  - [`spike/parser-e2e/report.md`](spike/parser-e2e/report.md) — Parser 写/读/roundtrip 与 XSD 校验。
  - [`spike/llm-json-styleparams/result.md`](spike/llm-json-styleparams/result.md) — LLM 在 JSON Schema 约束下的输出稳定性与多轮字段保留。
  - [`spike/knowledge-base-prompt/result.md`](spike/knowledge-base-prompt/result.md) — JSON 知识库加载、合并与 Prompt 注入。
  - [`spike/electron-ws-startup/result.md`](spike/electron-ws-startup/result.md) — Electron 主进程启动 Node 后端并向渲染进程暴露本地 WebSocket。
  - [`spike/xmllint-wasm-bundle/result.md`](spike/xmllint-wasm-bundle/result.md) — 项目级 `xmllint-wasm` schema bundle 自动化，用于离线 XSD 校验。
  - [`spike/openlayers-preview/result.md`](spike/openlayers-preview/result.md) — OpenLayers + `geostyler-openlayers-parser` 对 MVP 样式预览能力验证。
- **P1/P2 Spike 规划**：已创建目录与计划，待启动，见各目录下 `README.md`。
  - `spike/rule-generator/` — 后端分类/分级断点计算。
  - `spike/ol-preview/` — Vue 3 中 OpenLayers 实时预览组件（与 `openlayers-preview` 技术验证互补）。
  - `spike/filter-editor/` — Filter 编辑器与 CQL 预览。
  - `spike/sld-import-flow/` — SLD 导入前端→后端完整链路。
  - `spike/electron-file-io/` — Electron 文件对话框与本地文件 IO。
  - `spike/llm-adapter/` — 多模型 LLM 抽象与本地模型。
  - `spike/geojson-schema/` — GeoJSON 数据 schema 提取。
  - `spike/style-patch/` — `apply_patch` / JSON Patch 语义。
  - `spike/validation-error-location/` — Validation 错误精确定位。
- **源码**：[`SourceCode/`](SourceCode/) 目前只有 [`SourceCode/config/config.json`](SourceCode/config/config.json) 用于配置 LLM 连接。后端/前端骨架尚未搭建。

## 高层架构

理解整体架构需要同时阅读以下文档：

- [`Document/design/architecture.html`](Document/design/architecture.html) — 模块划分、核心类图、关键场景时序图。
- [`Document/design/interface-contracts.md`](Document/design/interface-contracts.md) — WebSocket 消息契约、`apply_patch` 批量 patches、请求/响应信封、错误码、超时约定、Electron 启动生命周期。
- [`Document/design/agent-session.md`](Document/design/agent-session.md) — 后端会话状态（`currentStyle`、`lastValidStyle`）、知识库加载、多轮 `modify` 协议、回退机制、并发控制。
- [`Document/design/style-builder.md`](Document/design/style-builder.md) — `StyleParams` 结构、LLM 字段别名归一化 `ParamsNormalizer`、Builder 工厂、GeoStyler 映射、知识库默认值。
- [`Document/design/sld-service.md`](Document/design/sld-service.md) — SLD 读/写封装、系统 `xmllint` 与 `xmllint-wasm` XSD 校验、Parser Roundtrip 校验。
- [`Document/design/filter-editor.md`](Document/design/filter-editor.md) — GeoStyler Filter 数组 ↔ UI 树模型 ↔ 只读 CQL 预览。
- [`Document/design/xmllint-packaging.md`](Document/design/xmllint-packaging.md) — `xmllint` 平台可用性、`xmllint-wasm` 打包方案、schema bundle 下载脚本、降级策略。
- [`Document/design/README.md`](Document/design/README.md) — 设计文档索引与决策速查。

关键架构决策：

1. **后端是权威状态源**：`AgentSession` 持有 `currentStyle` 与 `lastValidStyle`；前端通过 `apply_patch` 提交 UI 修改。
2. **失败即回退**：`generate` / `modify` / `apply_patch` 任一阶段失败都回退到 `lastValidStyle`；不维护多轮参数历史快照。
3. **参数化精修是精确编辑主路径**：用户通过前端参数面板、规则列表、Filter 编辑器直接修改 GeoStyler 模型，经 `apply_patch` 批量提交 patches；自然语言 `modify` 负责语义级风格调整。MVP 采用“确认后提交”模式，非即时逐字段提交。
4. **Schema 是唯一契约**：LLM 输出 → `StyleParamsValidator` → `ParamsNormalizer` → `StyleBuilder` → `SldService` 都围绕同一 `StyleParams` 类型。
5. **知识库驱动默认值与 Prompt**：启动时加载 `knowledge/root.json` + 领域文件（`default.json`、`transport.json`、`landuse.json`）；对象字段业务领域覆盖 `default`，数组字段业务领域前置，同时仅激活一个业务领域。
6. **Filter 中间表示**：后端/UI 模型使用 GeoStyler Filter 数组；UI 使用 `FilterNode` 树；CQL 用于只读预览。
7. **XSD 校验策略**：开发期使用系统 `xmllint`；生产打包使用 `xmllint-wasm` + 本地 OGC schema bundle；缺失时降级为 Parser Roundtrip + XML 语法校验。
8. **Electron/WebSocket 启动模式**：Electron 主进程启动 Node 后端，解析 stdout 中的 `READY ws://localhost:{port}` 后再加载渲染页 `file://renderer/index.html?port={port}`；渲染进程通过原生 `WebSocket` 直连后端。

## 工具使用偏好

本项目配置了 CodeGraph MCP server。优先使用 `codegraph_*` 工具回答结构性问题（符号定义、调用关系、影响范围、调用路径），避免对相同代码重复启动文件搜索 agent 或 grep 循环。

- 查找符号定义 / 调用方 / 被调用方 → `codegraph_search` / `codegraph_callers` / `codegraph_callees`
- 理解某功能区域 → `codegraph_context`
- 追踪调用流 / X 如何到达 Y → `codegraph_trace`
- 批量查看相关符号源码 → `codegraph_explore`

> 注意：截至最新会话，`.codegraph/` 索引尚未初始化。若遇到 "No CodeGraph project loaded"，请运行 `codegraph init -i` 建立索引，或继续使用 Read/Grep 处理字面文本查询。

## 技术栈

| 层级 | 技术 |
|---|---|
| 后端 | Node.js 20.6+、TypeScript 5.x、`geostyler-sld-parser`、`geostyler-style`、`chroma-js`、`ajv`、`ws`、`commander` |
| LLM | Anthropic / OpenAI Node SDK 或 `litellm`；配置位于 `SourceCode/config/config.json` |
| 前端 | Vue 3、Electron、`geostyler-openlayers-parser`、OpenLayers |
| 通信 | WebSocket（渲染进程直接连接；Electron 主进程仅管理后端生命周期） |
| 校验 | `ajv`（JSON Schema）+ 系统 `xmllint` / `xmllint-wasm`（OGC XSD） |
| 测试 | `vitest` |
| 代码质量 | `eslint`、`typescript`、`prettier` |

## 常用命令

### Spikes（当前可运行）

```bash
# Parser 端到端验证
cd spike/parser-e2e
npm install
npm test                  # write/read/roundtrip + 系统 xmllint XSD
node test-wasm-local.js   # xmllint-wasm 离线 bundle 校验

# LLM → JSON Schema → StyleParams 稳定性
cd spike/llm-json-styleparams
npm install
npm test                  # 运行全部 generate/modify 用例，输出 data.json
npm run typecheck         # tsc --noEmit

# JSON 知识库与 Prompt 注入
cd spike/knowledge-base-prompt
npm install
npm test                  # 运行 default/transport/landuse 用例，输出 data.json

# Electron + WebSocket 启动模式
cd spike/electron-ws-startup
npm install
npm start                 # 启动 Electron，后端自动拉起
npm run server            # 单独运行后端
npm run test:server       # 后端独立测试
npm run test:e2e          # Electron + 后端 + 渲染进程端到端测试

# xmllint-wasm schema bundle 自动化
cd spike/xmllint-wasm-bundle
npm install
npm run download          # 生成 schemas/ bundle
npm run test:node         # Node 环境 XSD 校验
npm run test:electron     # Electron 环境 XSD 校验
npm test                  # download + node + electron

# OpenLayers 预览能力验证
cd spike/openlayers-preview
npm install
npm test                  # Node.js 转换验证：12/12 用例
python -m http.server 8080
# 浏览器访问 http://localhost:8080/ 查看可视化渲染
```

### 后端（待 `SourceCode/backend` 搭建后启用）

```bash
cd SourceCode/backend
npm install
npm run dev          # 开发模式启动 WebSocket 后端
npm run cli          # CLI 入口
npm run build        # 编译 TypeScript
npm run test         # vitest
npm run test:unit path/to/test.ts   # 运行单个测试文件（vitest 惯例）
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
```

### 前端（待 `SourceCode/frontend` 搭建后启用）

```bash
cd SourceCode/frontend
npm install
npm run dev          # Electron + Vue 开发模式
npm run build        # 生产构建
```

## Spike 已验证约束

以下约束已在 Spike 中验证，并已反向同步到设计文档：

1. **`elseFilter` 无法 roundtrip**  
   `geostyler-sld-parser@9.0.1` 会丢弃 `Rule.elseFilter`。分类默认规则必须使用显式 Filter：  
   `['&&', ['!=', field, v1], ['!=', field, v2], ...]`。  
   见 [`Document/design/style-builder.md`](Document/design/style-builder.md) §6.2。

2. **symbolizer 内 `<Geometry>` 会导致 `readStyle` 崩溃**  
   导入含显式 `<Geometry><ogc:PropertyName>...</ogc:PropertyName></Geometry>` 的 SLD 会抛异常，导入前需剥离。  
   见 [`Document/design/sld-service.md`](Document/design/sld-service.md) §5。

3. **`xmllint-wasm` 需要完整 OGC schema bundle**  
   仅传入 `StyledLayerDescriptor.xsd` 会失败。必须 preload `xlink.xsd`、`xml.xsd`、`filter.xsd`、`expr.xsd`、`geometry.xsd`、`gml.xsd`、`feature.xsd`，并将 `schemaLocation` 改写为本地相对文件名。  
   见 [`Document/design/xmllint-packaging.md`](Document/design/xmllint-packaging.md) §4.2。

4. **LLM 会发明语义别名**  
   文本样式中模型可能输出 `font_color` 而非 schema 标准字段 `stroke_color`。`ParamsNormalizer` 在 schema 校验后将已知别名映射为标准字段。  
   见 [`Document/design/style-builder.md`](Document/design/style-builder.md) §4。

5. **知识库合并规则**  
   `default.json` 始终加载；单个业务领域文件与 `default` 合并时，对象字段由业务领域覆盖，数组字段（`few_shot_examples`、`modification_rules`、`constraints`）由业务领域前置。  
   见 [`Document/design/style-builder.md`](Document/design/style-builder.md) §8.1 与 [`Document/design/agent-session.md`](Document/design/agent-session.md) §3.5。

6. **渲染进程直接通过 WebSocket 通信**  
   Electron 主进程只负责启动/停止 Node 后端并通过 URL 查询参数传递端口；渲染进程使用原生 `WebSocket` 直连，不经过 IPC 转发。  
   见 [`Document/design/interface-contracts.md`](Document/design/interface-contracts.md) §9。

7. **OpenLayers 预览覆盖 MVP 全部 Must Have 样式**  
   `geostyler-openlayers-parser` 可稳定渲染 simple / categorized / classified / text / scale-denominator；`Mark` 的多种 `wellKnownName` 通过 SVG Icon 实现；线/面属性、虚线、透明度、旋转均正确转换。渐变、图案填充、图案线型不支持或仅部分支持；预览与 GeoServer 最终效果存在差异，需在 UI 中提示。  
   见 [`spike/openlayers-preview/result.md`](spike/openlayers-preview/result.md) 与 [`Document/design/requirements.md`](Document/design/requirements.md) §3.6。

## 本地资源

- LLM 连接配置：[`SourceCode/config/config.json`](SourceCode/config/config.json)
- SLD 1.0.0 XSD：[`Document/Research/sld/1.0.0/StyledLayerDescriptor.xsd`](Document/Research/sld/1.0.0/StyledLayerDescriptor.xsd)
- SLD 1.0.0 样例：[`Document/Research/sld/1.0.0/example-sld.xml`](Document/Research/sld/1.0.0/example-sld.xml)
- Schema bundle 下载脚本原型：[`spike/xmllint-wasm-bundle/scripts/download-sld-schemas.js`](spike/xmllint-wasm-bundle/scripts/download-sld-schemas.js)
- UX 交互原型：[`Document/UX/index.html`](Document/UX/index.html)

## 关键约束

- SLD 版本锁定为 **1.0.0**，以保证 GeoServer 兼容。
- JSON 知识库在启动时加载，不支持运行时热重载。
- 同一时刻只激活一个业务领域（`default` 加一个可选专业领域，如 `transport`、`landuse`）。
- 不维护参数变更历史；多轮编辑只保留当前 GeoStyler Style 与聊天文本。
- **不使用 RAG**；知识以预结构化 JSON 形式注入 LLM 上下文。
- **GeoStyler 是 SLD 解析与生成的唯一真相源**；前后端使用同一版本 `geostyler-sld-parser`。
- SLD XML 对用户是只读产物，不开放直接编辑；用户编辑对象是 GeoStyler Style 中间表示。

## 下一步

1. **完成待启动 Spike（按优先级）** — 降低核心模块实现风险：
   - P1：`spike/rule-generator/`、`spike/filter-editor/`、`spike/sld-import-flow/`、`spike/electron-file-io/`。
   - P2：`spike/llm-adapter/`、`spike/geojson-schema/`、`spike/style-patch/`、`spike/validation-error-location/`。
2. **编写 SDD 产物** — 基于设计文档与 Spike 结论创建 `Document/spec.md` 与 `Document/plan-{module}.md`。
3. **搭建 MVP 代码骨架** — `SourceCode/backend/`（Node/TS WebSocket 服务端 + CLI）与 `SourceCode/frontend/`（Electron + Vue）。
4. **构建核心模块** — `AgentSession`、`KnowledgeBaseLoader` / `PromptBuilder`、`StyleBuilder` 与各子 Builder、`SldService`、`FilterEditor`。
5. **接入校验管线** — 将 `xmllint-wasm` schema bundle 接入生产校验流程。

## 代码引用规范

在对话中引用文件或代码位置时，请使用 markdown 链接语法，以便在 IDE 中可点击：

- 文件：[`style-builder.md`](Document/design/style-builder.md)
- 指定行：[`style-builder.md:42`](Document/design/style-builder.md#L42)
- 行范围：[`style-builder.md:42-51`](Document/design/style-builder.md#L42-L51)
- 文件夹：[`Document/design/`](Document/design/)

路径均相对于仓库根目录。

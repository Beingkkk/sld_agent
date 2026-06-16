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

项目遵循 **SDD（规范驱动开发）**：`Document/` 下的需求与设计文档是编写 `Document/spec.md` 和 `Document/plan-{module}.md` 的前置输入，代码实现必须能追溯到对应 plan 的接口定义章节。变更必须走 `Document/changes/proposal-*.md`，禁止直接修改已锁定的 spec 或 plan。

## 当前阶段

MVP 代码骨架与核心模块已实现并提交到 `main`：

- **SDD 文档**：`Document/constitution.md`、`spec.md`、5 个 `plan-{module}.md`、`design/` 已冻结或按 proposal 流程更新。
- **后端**：`SourceCode/backend/` 已实现 WebSocket 服务、AgentSession、StyleBuilder、SldService、KnowledgeBaseLoader、PromptBuilder、LlmClient，单元测试 26 个 + e2e 流水线测试 9 个全部通过。
- **前端**：`SourceCode/frontend/` 已实现 Vue 3 + Electron 骨架、Pinia Store、WebSocket 客户端、MapPreview、Inspector、Assistant、Toolbar、StatusBar 及组件（SymbolizerEditor、ValidationPanel、FilterEditor），单元/组件/Electron 主进程测试共 49 个全部通过。
- **Spikes**：`spike/` 下已完成的 P0 结论已反向同步到设计文档；P1/P2 目录保留未跟踪，不进入版本控制。

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

若 `.codegraph/` 索引过期或缺失，运行 `npx codegraph init -i` 重建。

## 技术栈

| 层级 | 技术 |
|---|---|
| 后端 | Node.js 20.6+、TypeScript 5.x、`geostyler-sld-parser`、`geostyler-style`、`chroma-js`、`ajv`、`ws`、`commander` |
| LLM | Anthropic / OpenAI Node SDK；配置位于 `SourceCode/config/config.json`（本地文件，不提交） |
| 前端 | Vue 3、Electron、`geostyler-openlayers-parser`、`geostyler-sld-parser`、`OpenLayers`、`Pinia` |
| 通信 | WebSocket（渲染进程直接连接；Electron 主进程仅管理后端生命周期） |
| 校验 | `ajv`（JSON Schema）+ 系统 `xmllint` / `xmllint-wasm`（OGC XSD） |
| 测试 | `vitest` |
| 代码质量 | `eslint`、`typescript` |

## 常用命令

### 后端

```bash
cd SourceCode/backend
npm install
npm run dev          # tsx 开发启动（输出 READY 行）
npm run build        # 编译到 dist/
npm run test         # vitest 全部测试（含 tests/e2e）
npm run test:unit tests/unit/AgentSession.test.ts   # 单个测试文件
npx vitest run tests/e2e/integration.test.ts        # 仅运行 e2e 流水线测试
npm run typecheck    # tsc --noEmit
npm run lint         # eslint（当前缺少 ESLint 配置，会失败）
```

### 前端

```bash
cd SourceCode/frontend
npm install
npm run dev          # Vite 开发服务器
npm run build        # vue-tsc + vite build
npm run test         # vitest（含 tests/unit、src/**/*.test.ts、electron/**/*.test.ts）
npx vitest run src/components/SymbolizerEditor.test.ts   # 单个组件测试
npx vitest run electron/main.test.ts                     # Electron 主进程测试
npm run typecheck    # vue-tsc --noEmit
npm run lint         # eslint src electron（当前缺少 ESLint 配置，会失败）
npm run electron:dev # Electron 开发模式
npm run electron:build # Electron 打包
```

### 端到端开发流程

1. 复制或创建 `SourceCode/config/config.json` 并填写 LLM 端点与 API Key。
2. 启动后端：`cd SourceCode/backend && npm run build && node dist/index.js`，记录输出的端口。
3. 启动前端：`cd SourceCode/frontend && npm run dev`，浏览器访问 `http://localhost:5173/?port={后端端口}`。

### Spikes

`spike/` 目录未进入版本控制。已完成的 spike 可直接本地运行，例如：

```bash
cd spike/parser-e2e && npm install && npm test
cd spike/xmllint-wasm-bundle && npm install && npm run download && npm test
cd spike/openlayers-preview && npm install && npm test
```

## 共享代码与路径别名

- **SourceCode/shared/**：前后端共享的类型定义、`WsMessage` 契约、`FilterNode` 适配器与 CQL 转换。
  - 前端通过 `@shared` 别名引用（`vite.config.ts` 中配置为 `../shared`）。
  - 后端当前在 `SourceCode/backend/src/shared/` 中维护独立副本，两者内容应保持同步；长期应将后端也迁移到 `SourceCode/shared/`。
- **前端内部**：`@/` 别名指向 `SourceCode/frontend/src/`。

## 已知设计债与实现注意

1. **`apply_patch` 当前作用于 `StyleParams`**，而非 `GeoStyler Style`。`interface-contracts.md` 中的路径示例（如 `/rules/0/symbolizers/0/width`）描述的是对 Style 的修改，但当前实现把 patch 应用到 `StyleParams` 后再走 `StyleBuilder` 重建。这会导致部分 GeoStyler 特有字段无法通过 patch 直接编辑。需要在后续 proposal 中明确并统一语义。
2. **`SldService` 的 XSD/Roundtrip 组件已拆分**：按 [`Document/changes/proposal-0003.md`](Document/changes/proposal-0003.md) 拆分为 `SldParserWrapper`、`XsdValidator`、`RoundtripValidator`、`ValidationReporter` 独立模块；`SldService` 现为薄门面。
3. **`RuleGenerator` 近似实现**：`quantile` / `naturalBreaks` 目前退化为 `equalInterval`，因为 MVP 未接入原始要素采样值。
4. **前端组件测试已补齐**：FilterEditor、FilterNodeEditor、SymbolizerEditor、ValidationPanel、MapPreview 均已添加 `@vue/test-utils` 测试；Electron 主进程集成测试已覆盖 `main.ts` 中路径解析/启动/窗口创建逻辑。
5. **`SourceCode/backend/src/shared/` 与 `SourceCode/shared/` 重复**：修改 Filter adapter、messages、types 时需要同时同步两份副本，直到后端迁移完成。

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

## 本地资源与忽略文件

- **LLM 连接配置**：`SourceCode/config/config.json`（本地文件，不提交，已由 `.gitignore` 排除）。
- **XSD 与参考文档**：`Document/Research/`（本地目录，不提交，已由 `.gitignore` 排除）。开发中若需要 SLD 1.0.0 XSD，可从 `spike/parser-e2e/schemas-local/` 或 `spike/xmllint-wasm-bundle/` 获取。
- **Schema bundle 下载脚本原型**：[`spike/xmllint-wasm-bundle/scripts/download-sld-schemas.js`](spike/xmllint-wasm-bundle/scripts/download-sld-schemas.js)
- **UX 交互原型**：[`Document/UX/index.html`](Document/UX/index.html)

## 关键约束

- SLD 版本锁定为 **1.0.0**，以保证 GeoServer 兼容。
- JSON 知识库在启动时加载，不支持运行时热重载。
- 同一时刻只激活一个业务领域（`default` 加一个可选专业领域，如 `transport`、`landuse`）。
- 不维护参数变更历史；多轮编辑只保留当前 GeoStyler Style 与聊天文本。
- **不使用 RAG**；知识以预结构化 JSON 形式注入 LLM 上下文。
- **GeoStyler 是 SLD 解析与生成的唯一真相源**；前后端使用同一版本 `geostyler-sld-parser`。
- SLD XML 对用户是只读产物，不开放直接编辑；用户编辑对象是 GeoStyler Style 中间表示。

## 下一步

1. ~~拆分 `SldService` 内部模块~~：已完成，见 [`Document/changes/proposal-0003.md`](Document/changes/proposal-0003.md)。
2. **接入原始要素采样值**：让 `quantile` / `naturalBreaks` 真正按数据分布计算断点，而非退化为 `equalInterval`。
3. **细化 `apply_patch` 本地乐观更新语义**，明确 patch 目标是 `StyleParams` 还是 `GeoStyler Style`。
4. **统一共享代码目录**：将 `SourceCode/backend/src/shared/` 迁移到 `SourceCode/shared/`，消除重复副本。
5. **完善 Electron 本地文件 IO**：在主进程增加 `dialog.showOpenDialog` / `showSaveDialog` 处理，并补充对应集成测试。

## 代码引用规范

在对话中引用文件或代码位置时，请使用 markdown 链接语法，以便在 IDE 中可点击：

- 文件：[`style-builder.md`](Document/design/style-builder.md)
- 指定行：[`style-builder.md:42`](Document/design/style-builder.md#L42)
- 行范围：[`style-builder.md:42-51`](Document/design/style-builder.md#L42-L51)
- 文件夹：[`Document/design/`](Document/design/)

路径均相对于仓库根目录。

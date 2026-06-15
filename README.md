# SLDAgent

SLDAgent 是一个自然语言驱动的 OGC SLD 1.0.0 样式编辑器。用户通过自然语言描述地图样式需求，系统将其解析为参数化中间表示，最终生成符合 GeoServer 兼容的 SLD 1.0.0 XML。

## 核心流程

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
OGC XSD 校验 + Parser Roundtrip 校验
```

## 当前阶段

- **设计文档**：已完成，见 [`Document/design/`](Document/design/)。
- **P0 Spike**：已全部验证完成，结论已同步回设计文档。
  - [`spike/parser-e2e/`](spike/parser-e2e/)：Parser 写/读/roundtrip 与 XSD 校验。
  - [`spike/llm-json-styleparams/`](spike/llm-json-styleparams/)：LLM 在 JSON Schema 约束下的输出稳定性。
  - [`spike/knowledge-base-prompt/`](spike/knowledge-base-prompt/)：JSON 知识库加载、合并与 Prompt 注入。
  - [`spike/electron-ws-startup/`](spike/electron-ws-startup/)：Electron 主进程启动 Node 后端并向渲染进程暴露本地 WebSocket。
  - [`spike/xmllint-wasm-bundle/`](spike/xmllint-wasm-bundle/)：项目级 `xmllint-wasm` schema bundle 自动化。
  - [`spike/openlayers-preview/`](spike/openlayers-preview/)：OpenLayers + `geostyler-openlayers-parser` 对 MVP 样式预览能力验证。
- **下一步**：编写 SDD 产物（`Document/spec.md`、`Document/plan-{module}.md`），并搭建 MVP 骨架（`SourceCode/backend/`、`SourceCode/frontend/`）。

## 项目结构

```
.
├── CLAUDE.md                       # Claude Code 项目指引
├── Document/
│   ├── design/                     # 设计文档（不提交）
│   ├── Research/                   # 研究资料（不提交）
│   └── UX/                         # 交互原型
├── SourceCode/
│   └── config/
│       ├── config.json.template    # LLM 连接配置模板
│       └── config.json             # 本地运行时配置（不提交）
├── spike/                          # 技术验证目录（不提交）
└── README.md
```

## 快速开始

### 1. 配置 LLM 连接

复制配置模板并填写真实密钥：

```bash
cp SourceCode/config/config.json.template SourceCode/config/config.json
```

编辑 [`SourceCode/config/config.json`](SourceCode/config/config.json) 中的 `apiKey` 与所选 `provider`。

### 2. 运行 Spike 验证

```bash
# Parser 端到端验证
cd spike/parser-e2e
npm install
npm test
node test-wasm-local.js

# LLM → JSON Schema → StyleParams 稳定性
cd spike/llm-json-styleparams
npm install
npm test

# JSON 知识库与 Prompt 注入
cd spike/knowledge-base-prompt
npm install
npm test

# Electron + WebSocket 启动模式
cd spike/electron-ws-startup
npm install
npm run test:e2e

# xmllint-wasm schema bundle 自动化
cd spike/xmllint-wasm-bundle
npm install
npm test

# OpenLayers 预览能力验证
cd spike/openlayers-preview
npm install
npm test
```

## 技术栈

| 层级 | 技术 |
|---|---|
| 后端 | Node.js 20.6+、TypeScript 5.x、`geostyler-sld-parser`、`geostyler-style`、`chroma-js`、`ajv`、`ws`、`commander` |
| LLM | Anthropic / OpenAI Node SDK 或 `litellm` |
| 前端 | Vue 3、Electron、`geostyler-openlayers-parser`、OpenLayers |
| 通信 | WebSocket（渲染进程直连后端） |
| 校验 | `ajv`（JSON Schema）+ `xmllint` / `xmllint-wasm`（OGC XSD） |
| 测试 | `vitest` |
| 代码质量 | `eslint`、`typescript`、`prettier` |

## 关键约束

- SLD 版本锁定为 **1.0.0**，以保证 GeoServer 兼容。
- 同一时刻只激活一个业务领域（`default` 加一个可选专业领域）。
- 不维护参数变更历史；多轮编辑只保留当前 GeoStyler Style 与聊天文本。
- **不使用 RAG**；知识以预结构化 JSON 形式注入 LLM 上下文。
- **GeoStyler 是 SLD 解析与生成的唯一真相源**。
- SLD XML 对用户是只读产物，不开放直接编辑。

## 了解更多

- 项目指引与上下文：[CLAUDE.md](CLAUDE.md)
- 设计文档索引：[Document/design/README.md](Document/design/README.md)
- 接口契约：[Document/design/interface-contracts.md](Document/design/interface-contracts.md)
- 样式构建器设计：[Document/design/style-builder.md](Document/design/style-builder.md)
- SLD 服务设计：[Document/design/sld-service.md](Document/design/sld-service.md)

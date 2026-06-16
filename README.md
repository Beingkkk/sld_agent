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

## 项目状态

项目处于早期工程验证阶段。Parser roundtrip、XSD 离线校验、LLM JSON Schema 稳定性、知识库合并、Electron / WebSocket 启动等关键技术难点已通过内部 spike 验证，相关结论已沉淀到设计文档。当前正在推进 SDD 产物编写与 MVP 代码骨架搭建。

## 仓库内容

```
.
├── CLAUDE.md                       # 项目开发指引
├── Document/
│   └── UX/                         # 交互原型
├── SourceCode/
│   └── config/
│       └── config.example.json     # LLM 连接配置模板
└── README.md
```

## 快速开始

### 1. 配置 LLM 连接

复制配置模板并填写真实密钥：

```bash
cp SourceCode/config/config.example.json SourceCode/config/config.json
```

编辑 `SourceCode/config/config.json` 中的 `auth_key`、`base_url` 与 `model_name`。

### 2. 启动服务

后端与前端 MVP 骨架正在搭建中，完整启动方式将在后续版本补充。

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

- 项目开发指引：[CLAUDE.md](CLAUDE.md)
- 交互原型：[Document/UX/index.html](Document/UX/index.html)

# LLM + SLD 智能 Agent — 技术细节索引

> 文档定位：SDD 技术路径索引，存放于 `Document/design/` 作为后续 `spec.md` 与 `plan-{module}.md` 的输入。  
> 对应需求说明见：[requirements.md](requirements.md)。
>
> **重要说明**：本节中的详细技术结论、数据与实现要点已拆分并维护到 `Document/design/` 各模块。本文档仅保留**关联索引**，避免与 design 文档重复。后续开发请以 `Document/design/` 为唯一依据。

---

## 1. 总体架构

- 架构总览、模块划分、核心类图：[architecture.html](architecture.html)
- 前后端通信协议、消息契约：[interface-contracts.md](interface-contracts.md)
- 后端会话状态与生成流水线：[agent-session.md](agent-session.md)

## 2. 现有资源与资产

- GeoStyler SLD Parser 封装、XSD / Roundtrip 校验：[sld-service.md](sld-service.md)
- `StyleParams` → GeoStyler Style 映射层：[style-builder.md](style-builder.md)
- 外部依赖清单、技术栈与命令：[CLAUDE.md](../../CLAUDE.md)

## 3. 技术选型

| 主题 | 关联设计文档 |
|---|---|
| LLM 选型与抽象、JSON Schema 契约 | [style-builder.md](style-builder.md) §2、§4、§9 |
| `StyleBuilder` / `RuleGenerator` / 分类分级 | [style-builder.md](style-builder.md) §5、§6、§7 |
| Electron + Vue 前端架构、WebSocket 通信模式 | [interface-contracts.md](interface-contracts.md) §9 |
| XSD 校验策略（系统 `xmllint` / `xmllint-wasm` / 降级） | [xmllint-packaging.md](xmllint-packaging.md)、[sld-service.md](sld-service.md) §6 |
| Filter 编辑器与 CQL 预览 | [filter-editor.md](filter-editor.md) |

## 4. JSON 知识库设计

- 知识库加载、合并规则、Prompt 构建：[agent-session.md](agent-session.md) §3.5
- 三层字段映射（Schema / GeoStyler / SLD CssParameter）、默认值解析：[style-builder.md](style-builder.md) §3、§8

## 5. 数据流示例

- 生成 / 修改 / 应用 patch 的统一流水线：[agent-session.md](agent-session.md) §4
- 前后端典型交互时序：[interface-contracts.md](interface-contracts.md) §8
- `AgentSession` 与 `KnowledgeBaseLoader` / `LlmClient` / `StyleBuilder` / `SldService` 协作：[agent-session.md](agent-session.md) §10

## 6. 风险识别与应对

| 风险 | 关联设计文档 |
|---|---|
| LLM 输出不稳定 / 字段别名 / 超时 | [style-builder.md](style-builder.md) §4、§9.4；[agent-session.md](agent-session.md) §6 |
| 生成/修改阶段失败与回退 | [agent-session.md](agent-session.md) §5 |
| XSD 工具缺失时的降级校验 | [xmllint-packaging.md](xmllint-packaging.md) §6；[sld-service.md](sld-service.md) §6.3 |
| SLD 解析/写出异常（如 `<Geometry>` 节点） | [sld-service.md](sld-service.md) §5 |

## 7. Spike 结论快速索引

P0 Spike 结论已全部下沉到 design 文档。如需查看原始数据与测试脚本，可点击 spike 报告；实现时应以 design 文档为准。

| Spike | 关键结论 | 关联 design 文档 |
|---|---|---|
| [spike/parser-e2e/report.md](../../spike/parser-e2e/report.md) | `elseFilter` 不 roundtrip；显式 `<Geometry>` 节点导致 parser 崩溃 | [style-builder.md](style-builder.md) §6.2、[sld-service.md](sld-service.md) §5 |
| [spike/llm-json-styleparams/result.md](../../spike/llm-json-styleparams/result.md) | JSON Schema + `ParamsNormalizer` 输出稳定；完整 `StyleParams` 注入可多轮 100% 保留字段 | [style-builder.md](style-builder.md) §4、§9.4；[agent-session.md](agent-session.md) §6.1；[interface-contracts.md](interface-contracts.md) §4.2 |
| [spike/knowledge-base-prompt/result.md](../../spike/knowledge-base-prompt/result.md) | JSON 知识库加载、合并、注入有效；按领域提升语义准确性 | [style-builder.md](style-builder.md) §3、§8；[agent-session.md](agent-session.md) §3.5 |
| [spike/electron-ws-startup/result.md](../../spike/electron-ws-startup/result.md) | 渲染进程直连 WebSocket 最优；主进程仅管理后端生命周期 | [interface-contracts.md](interface-contracts.md) §9 |
| [spike/xmllint-wasm-bundle/result.md](../../spike/xmllint-wasm-bundle/result.md) | `xmllint-wasm` + schema bundle 体积小、校验快，适合生产打包 | [xmllint-packaging.md](xmllint-packaging.md) §4.2；[sld-service.md](sld-service.md) §6 |

## 8. 参考链接

- [GeoStyler SLD Parser](https://github.com/geostyler/geostyler-sld-parser)
- [GeoStyler OpenLayers Parser](https://github.com/geostyler/geostyler-openlayers-parser)
- [GeoStyler Style 类型定义](https://github.com/geostyler/geostyler-style)
- [chroma-js 颜色库](https://github.com/gka/chroma.js)
- [Styled Layer Descriptor (SLD) - OGC 标准](https://www.ogc.org/standards/sld)
- [JSON Schema 规范](https://json-schema.org/)

---

*文档版本：v2.0*  
*最后更新：2026-06-15*  
*变更说明：移动到 `Document/design/technical-details-index.md`，链接更新为 design 目录内的新位置。*

# Document/design — 设计文档索引

本目录存放 SLDAgent 进入编码前的详细设计文档，按 SDD 工作流作为后续 `Document/plan-*.md` 与源码实现的输入。

---

## 文档清单

| 文档 | 定位 | 关键内容 |
|---|---|---|
| [requirements.md](requirements.md) | SDD 需求真相源 | 项目背景、Must/Should/Could 功能需求、非功能需求、关键约束 |
| [technical-details-index.md](technical-details-index.md) | SDD 技术路径索引 | 索引：架构、技术选型、知识库、数据流、风险、Spike 结论映射 |
| [architecture.html](architecture.html) | 架构总览 | 模块划分、核心类图、整体架构、关键场景时序图 |
| [interface-contracts.md](interface-contracts.md) | 前后端接口契约 | WebSocket 消息类型、请求/响应格式、共享类型、错误码、超时约定 |
| [agent-session.md](agent-session.md) | 后端状态管理 | `AgentSession` 核心状态、多轮增量协议、回退机制、并发控制 |
| [style-builder.md](style-builder.md) | 样式构建层 | `StyleParams` 结构、三层字段映射、Builder 工厂与各类 Builder |
| [sld-service.md](sld-service.md) | SLD 校验服务 | `geostyler-sld-parser` 封装、XSD 校验、Parser Roundtrip、错误汇总 |
| [filter-editor.md](filter-editor.md) | Filter 编辑器 | GeoStyler Filter 数组 ↔ UI 树模型 ↔ CQL 只读预览的转换规则 |
| [xmllint-packaging.md](xmllint-packaging.md) | 校验工具打包调研 | `xmllint` 平台可用性、`xmllint-wasm` 方案、降级策略 |
| [sld-config-guide.md](sld-config-guide.md) | SLD 操作指南 | SLD 1.0.0 编写流程、元素速查、验证检查单 |

---

## 设计决策速查

1. **权威状态在后端**：`AgentSession` 持有 `currentStyle` 与 `lastValidStyle`；前端通过 `apply_patch` 提交 UI 修改。
2. **失败即回退**：任何生成/修改阶段失败都回退到 `lastValidStyle`，不维护多轮历史快照。
3. **参数化精修是精确编辑主路径**：用户通过前端参数面板、分类表格、Filter 编辑器直接修改样式参数，经 `apply_patch` 批量提交；自然语言 `modify` 负责语义级风格调整。MVP 采用“确认后提交”模式。
4. **Schema 是唯一契约**：LLM 输出 → `StyleParamsValidator` → `StyleBuilder` → `SldService` 都围绕同一 `StyleParams` 类型。
5. **Filter 中间表示**：GeoStyler Filter 数组；UI 使用 `FilterNode` 树；CQL 只读预览。
6. **XSD 校验策略**：开发期系统 `xmllint`；**打包发布主方案 `xmllint-wasm` + 自动化 schema bundle 下载脚本**；缺失时降级为 Parser Roundtrip + XML 语法校验。详见 [xmllint-packaging.md](xmllint-packaging.md) 与 [sld-service.md](sld-service.md)。

---

## Spike 结论映射

P0 Spike 已全部完成，结论已下沉到本目录各模块。后续开发应以 design 文档为唯一依据，原始 spike 报告仅作为验证背景与详细数据查阅。

| Spike | 关键结论 | 关联 design 文档 |
|---|---|---|
| [spike/parser-e2e/report.md](../../spike/parser-e2e/report.md) | `elseFilter` 不 roundtrip；显式 `<Geometry>` 节点导致 parser 崩溃 | [style-builder.md](style-builder.md) §6.2、[sld-service.md](sld-service.md) §5 |
| [spike/llm-json-styleparams/result.md](../../spike/llm-json-styleparams/result.md) | JSON Schema + `ParamsNormalizer` 输出稳定；完整 `StyleParams` 注入可 100% 保留字段 | [style-builder.md](style-builder.md) §4、§9.4；[agent-session.md](agent-session.md) §6.1；[interface-contracts.md](interface-contracts.md) §4.2 |
| [spike/knowledge-base-prompt/result.md](../../spike/knowledge-base-prompt/result.md) | JSON 知识库加载、合并、注入有效；按领域提升语义准确性 | [style-builder.md](style-builder.md) §3、§8；[agent-session.md](agent-session.md) §3.5 |
| [spike/electron-ws-startup/result.md](../../spike/electron-ws-startup/result.md) | 渲染进程直连 WebSocket 最优；主进程仅管理后端生命周期 | [interface-contracts.md](interface-contracts.md) §9 |
| [spike/xmllint-wasm-bundle/result.md](../../spike/xmllint-wasm-bundle/result.md) | `xmllint-wasm` + schema bundle 体积小、校验快，适合生产打包 | [xmllint-packaging.md](xmllint-packaging.md) §4.2；[sld-service.md](sld-service.md) §6 |

## 下一步

- [x] P0 Spike 已全部完成（SP-01 ~ SP-04），调研结论已同步到本目录各设计文档。
- [ ] 将本目录设计成果收敛为 SDD 规范的 `Document/spec.md` 与 `Document/plan-{module}.md`。
- [ ] 进入 MVP 编码阶段。

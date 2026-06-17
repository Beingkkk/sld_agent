# Proposal: 完善 Filter 可视化构造器与 LLM 配置

> **类型**：Type-B（设计落地）+ Type-C（代码缺陷修复）
> **编号**：0002
> **状态**：IMPLEMENTED
> **提出日期**：2026-06-17
> **实现日期**：2026-06-17
> **依赖**：constitution v1.0.0、spec v1.0.0、plan-filter v1.0.0、plan-backend v1.0.0、proposal-0001

---

## 1. 变更目标

1. 将 `plan-filter.md` 中定义的节点树 Filter 编辑器完整落地到源码，替换 `FilterEditor.vue` 的占位实现。
2. 修复 `SourceCode/config/config.json` 中 LLM API Key 的配置方式，确保后端 `loadConfig` 能正确读取 Key 并调用远程服务。
3. 验证后端 LLM 客户端能正确读取 Key 并调用远程服务。

---

## 2. 变更范围

### [ADDED] 新增源码

- `SourceCode/core/src/filter-transformer.ts`：FilterNode ↔ GeoStyler Filter 双向转换。
- `SourceCode/core/src/cql-writer.ts`：FilterNode → CQL 文本。
- `SourceCode/core/src/__tests__/filter-transformer.spec.ts`：转换层单元测试。
- `SourceCode/core/src/__tests__/cql-writer.spec.ts`：CQL 输出测试。
- `SourceCode/frontend/src/components/filter/`：
  - `FilterEditor.vue`：Rule 属性面板中的 Filter 编辑区。
  - `FilterTree.vue`：递归渲染 Filter 节点树。
  - `FilterNodeEditor.vue`：当前选中节点的类型/属性编辑器。
  - `CqlPreview.vue`：实时 CQL 预览。

### [MODIFIED] 调整现有代码

- `SourceCode/core/src/types.ts`：RuleNodeData.filter 类型从 `Filter | null` 改为 `FilterNode | null`；新增 `FilterNode` 相关类型。
- `SourceCode/core/src/transformer.ts`：`ruleToGeoStyler` / `ruleFromGeoStyler` 调用 `FilterTransformer` 做 Filter 双向转换。
- `SourceCode/core/src/index.ts`：导出 `FilterNode`、`FilterTransformer`、`CqlWriter`。
- `SourceCode/frontend/src/components/property/editors/FilterEditor.vue`：替换为完整实现。
- `SourceCode/frontend/src/components/property/PropertyForm.vue`：Rule 节点的 Filter 字段根据 `elseFilter` 状态传递 `disabled`，开启时置为只读。
- `SourceCode/backend/src/llm/anthropic.ts`：修正 Anthropic-compatible endpoint URL 构建，兼容 baseUrl 已含 `/v1`（Anthropic 原生）与不含 `/v1`（MiniMax 兼容端点）两种情况。
- `SourceCode/config/config.json`：保留 LLM 配置（含 API Key）作为本地运行时配置；`SourceCode/config/config.json` 已纳入 `.gitignore`，不会提交到仓库。
- `SourceCode/backend/src/config.ts`：新增 `resolveApiKey()`，优先从环境变量读取；若 `apiKeyEnvVar` 字段以 `"sk-"` 开头，则视为直接写入的 Key 并作为降级方案使用。

---

## 3. 与 Plan 的对应关系

| Plan | 实现产物 |
| :--- | :--- |
| `plan-filter.md` §2 | `FilterNode` 类型、`RuleNodeData.filter` 存储形式 |
| `plan-filter.md` §3 | `FilterTransformer`、`CqlWriter` |
| `plan-filter.md` §4 | `FilterEditor`、`FilterTree`、`FilterNodeEditor`、`CqlPreview` |
| `plan-filter.md` §8 | 新增单元测试与集成测试 |
| `plan-backend.md` §配置 | `config.json` + `loadConfig` 的 API Key 读取 |

---

## 4. 验收标准

- [x] `npm run build` 构建 core / frontend / backend / electron 全部通过。
- [x] `npm test` 通过，新增 Filter 相关测试。
- [x] 在 Electron 窗口中选中 Rule 节点，属性面板显示 Filter 编辑器。
- [x] 可添加 AND / OR / NOT / 比较节点，编辑属性名、运算符、值。
- [x] CQL 预览实时更新，格式正确（如 `name = 'school'`、`(a = 1 AND b > 2)`）。
- [x] 开启 ElseFilter 后 Filter 编辑器置为只读。
- [x] 导出 SLD XML 时 Filter 语义正确保留。
- [x] 后端启动日志显示使用 AnthropicClient（非 Mock）。
- [x] 调用后端 AI 解释接口可收到远程 LLM 的响应（或明确的错误提示）。

---

## 5. 风险与回退

- **Filter 节点树与 GeoStyler Filter 语义差异**：`*=` 在 CQL 中映射为 `LIKE`，但 GeoStyler 直接透传 `%` 通配符；测试用例覆盖此场景。
- **API Key 读取**：backend 同时支持环境变量与 `config.json` 中的 `apiKeyEnvVar` 字段直接写入 Key；`config.json` 已纳入 `.gitignore`，不会进入版本控制。
- **OpenLayers 预览对复杂 Filter 支持**：geostyler-openlayers-parser 可能不支持部分 Filter 组合；预览区对不支持的 Filter 显示 warning 但不阻断编辑。

---

## 6. 实现备注

- `FilterNode` 在树中作为 `RuleNodeData.filter` 的持久形式；GeoStyler Filter 数组仅在导出/预览时生成。
- 前端 Filter 编辑器使用本地状态编辑，点击「应用」或变更时通过 `store.updateNode(path, { filter })` 写回树。
- 为了 UI 简洁，Filter 编辑器以递归卡片形式渲染，comparison 节点单行显示。
- LLM 配置读取：`resolveApiKey()` 优先读取环境变量；若 `config.json` 的 `apiKeyEnvVar` 字段以 `"sk-"` 开头，则视为直接 Key。实际验证通过 `config.json` 直接配置完成。
- MiniMax Anthropic-compatible 端点需要 `/v1/messages` 路径；`AnthropicClient` 已自动兼容 baseUrl 是否已含 `/v1`。

---

## 7. 状态流转

```text
PROPOSED → APPROVED → IMPLEMENTING → IMPLEMENTED → 运行验收
```

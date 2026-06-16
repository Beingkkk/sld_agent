# Proposal 0004：接入原始要素采样值实现真实 quantile / naturalBreaks 分级断点

## 状态

- 提案：2026-06-16
- 范围：`SourceCode/backend/src/style/builder/StyleBuilder.ts`
- 状态：已实施

## 摘要

在 `RuleGenerator.computeBreaks()` 中消费 `DataSchema.properties[].samples`，使 `classification_method` 为 `quantile` 或 `naturalBreaks` 时基于真实采样值计算分级断点；采样缺失、非数值或不足时仍回退到 `equalInterval`，保持现有行为。

## 动机

- `classification_method` 已在 `style-params.schema.json` 中支持 `quantile` 与 `naturalBreaks`，但当前 `RuleGenerator.computeBreaks()` 对所有方法均调用 `equalIntervalBreaks()`，导致这两种方法名存实亡。
- `DataSchema` / `PropertySchema` 已具备 `samples?: unknown[]` 字段，且数据流已从前端 `wsClient.ts` 经后端 `server.ts`/`router.ts` 到达 `AgentSession.setDataSchema()` → `StyleBuilderFactory` → `ClassifiedStyleBuilder`。
- 本变更完成“原始要素采样值 → 分级断点”的最后一段链路，使分级样式结果真正反映数据分布，是 `CLAUDE.md` 列出的下一步关键债务。

## 变更内容

### 1. 新增断点算法辅助函数

在 `SourceCode/backend/src/style/builder/StyleBuilder.ts` 中新增三个纯函数：

- `extractNumericSamples(prop?: PropertySchema): number[] | undefined`
  - 从 `samples` 中过滤 `typeof === 'number' && !Number.isNaN(v)` 的值。
  - 有效数值少于 2 个或字段不存在时返回 `undefined`。
- `quantileBreaks(values: number[], classes: number): number[]`
  - 对排序后的采样值按分位数位置插值取得断点，返回 `classes + 1` 个边界。
  - 若去重后无法生成有效边界，则回退到 `equalInterval`。
- `naturalBreaks(values: number[], classes: number): number[]`
  - 实现标准 Jenks 自然断点算法（O(k·n²)，适合 GIS 常见采样规模）。
  - 返回 `classes + 1` 个边界。

### 2. 修改 `RuleGenerator.computeBreaks()`

- 查找字段对应的 `PropertySchema`。
- 提取有效数值样本。
- 若样本数 ≥ `classes`：
  - `method === 'equalInterval'` → 保持原 `equalIntervalBreaks` 逻辑。
  - `method === 'quantile'` → 调用 `quantileBreaks()`。
  - `method === 'naturalBreaks'` → 调用 `naturalBreaks()`。
- 否则回退到 `equalIntervalBreaks(min, max, classes)`。

### 3. 测试补充

扩展 `SourceCode/backend/tests/unit/StyleBuilder.test.ts`：

- `RuleGenerator.computeBreaks`
  - `quantile` 使用样本正确分桶；
  - `naturalBreaks` 在双峰数据上 split 出聚类边界；
  - 缺失/非数值/样本不足时回退 `equalInterval`；
  - 字段不存在时回退；
  - 全相同样本的退化情况。
- `ClassifiedStyleBuilder`
  - 传入带 `samples` 的 `dataSchema`，验证生成规则的 `filter` 边界来自数据驱动算法。

## 修改文件

- `SourceCode/backend/src/style/builder/StyleBuilder.ts`（编辑）
- `SourceCode/backend/tests/unit/StyleBuilder.test.ts`（编辑）
- `Document/changes/proposal-0004.md`（本文件）

## 验证

```bash
cd SourceCode/backend
npx tsc --noEmit
npx vitest run
```

结果：
- `tsc --noEmit` 无类型错误。
- 后端全部测试通过：11 个测试文件、58 个用例（变更前为 47 个用例）。
- 新增测试覆盖 `quantile`、`naturalBreaks` 与各类回退路径。

## 风险

- `samples` 为 `unknown[]`，过滤逻辑必须严格（`typeof === 'number' && !Number.isNaN()`），避免 `null`、`boolean`、`string` 等混入。
- Jenks 算法复杂度为 O(k·n²)，在采样数量极大时可能变慢；当前 GIS 场景样本规模可控，如需更大规模可后续引入采样预过滤。
- 若所有样本值相同，断点会退化为 `min == max`，与现有 `equalInterval` 行为一致。

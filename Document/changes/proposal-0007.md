# Proposal: 属性字段与 Rule 节点增加 AI 解释入口

> **类型**：Type-C（UI/交互优化）
> **编号**：0007
> **状态**：IMPLEMENTED
> **提出日期**：2026-06-17
> **实现日期**：2026-06-17
> **依赖**：proposal-0005（LLM 最小可行补丁）、proposal-0006（AI 解释面板 Markdown 与布局）

---

## 1. 问题描述

当前 AI 解释能力已接入右侧 `CodePanel`，但入口单一：

1. **属性面板缺少字段级解释入口**：用户在编辑 `Rule` / `FeatureTypeStyle` / `Symbolizer` 等节点属性时，无法直接对某个字段（如 `scaleDenominator.min`、`elseFilter`、`fillColor`）发起 AI 解释，必须切换到 AI Tab 再点击「重新解释」。
2. **树节点缺少 Rule 解释入口**：选中 Rule 后只能去右侧 AI Tab 触发解释，树节点本身没有快捷按钮。
3. **右侧面板 Tab 状态分散**：`activeTab` 目前保存在 `CodePanel.vue` 本地，外部组件（如属性面板、树节点）无法直接切换到 AI Tab。

## 2. 变更目标

- 在属性面板每个字段标签旁增加 `?` 解释按钮，点击后调用后端 `explain_property` 并自动切换到右侧 AI 解释 Tab。
- 在 SLD 树的 `Rule` 节点行增加 `?` 解释按钮，点击后选中该 Rule 并调用 `explain_rule`，自动切换到 AI Tab。
- 保持单次解释模式，不引入多轮对话；每次新解释会覆盖上一次的 AI 结果，避免旧内容堆积。
- 将右侧面板当前 Tab 状态上提到 Pinia store，使任意组件都能触发切换。

## 3. 变更范围

### [MODIFIED] 前端

- `SourceCode/frontend/src/store/index.ts`
  - 新增 `RightPanelTab` 类型（`'json' | 'xml' | 'validation' | 'ai'`）。
  - 新增状态 `activeRightTab`、`aiPropertyExplanation`、`aiPropertyContext`。
  - 新增 `setActiveRightTab(tab)` action。
  - 新增 `explainProperty(fieldName, label, value?)` action，调用 `ws/client.explainProperty`，结果写入 `aiPropertyExplanation` 并自动切到 `ai` Tab。
  - 调整 `explainSelectedRule` 与 `explainIssue`：触发时清除其他 AI 结果，并自动切换到 `ai` Tab。

- `SourceCode/frontend/src/components/code/CodePanel.vue`
  - 移除本地 `activeTab`，改用 `store.activeRightTab`。
  - AI Tab 增加「字段解释」展示区，基于 Markdown 渲染 `aiPropertyExplanation`。
  - 校验 issue 的「AI 解释」按钮不再本地切 Tab，由 store action 统一处理。

- `SourceCode/frontend/src/components/property/PropertyForm.vue`
  - 分组字段与未分组字段的标签行都增加 `?` 按钮。
  - 点击调用 `store.explainProperty(item.fieldId, item.meta.label, getFieldValue(...))`。
  - 后端未连接时按钮禁用并提示。

- `SourceCode/frontend/src/components/tree/SLDTreeNode.vue`
  - `Rule` 节点行右侧增加 `?` 按钮。
  - 点击先 `selectNode(props.path)`，再调用 `store.explainSelectedRule()`。
  - 后端未连接时禁用。

### [UNMODIFIED] 后端

- `explain_property` 已在 `server.ts` 与 `prompt-builder.ts` 实现，无需修改。

## 4. 与 Plan 的对应关系

| Plan | 对应章节 |
| :--- | :--- |
| `plan-frontend.md` | §3 属性面板、§5 AI 面板 |
| `plan-filter.md` | 字段级交互 |
| `Document/UX/design.md` | 图标按钮、hover 状态 |

## 5. 验收标准

- [ ] 属性面板每个字段标签旁出现 `?` 按钮，hover 显示「AI 解释此字段」。
- [ ] 点击字段 `?` 按钮后，右侧面板自动切换到 AI Tab，并显示该字段的 Markdown 解释。
- [ ] SLD 树中每个 `Rule` 节点 hover 时出现 `?` 按钮，点击后自动选中该 Rule 并显示 AI 解释。
- [ ] 单次解释：新请求覆盖旧结果，不保留多轮对话历史。
- [ ] 后端未连接时，所有 `?` 按钮禁用。
- [ ] `npm run typecheck` 与 `npm test` 通过。

## 6. 风险与回退

- **过多解释按钮干扰视觉**：`?` 按钮默认仅在 `group-hover` 时显示，平时隐藏，降低视觉噪音。
- **字段解释与 Rule 解释同时显示**：每次新解释会清空其他 AI 结果字段，确保 AI Tab 只展示最近一次解释。
- **回退**：移除字段标签与树节点的 `?` 按钮，并将 `activeRightTab` 迁回 `CodePanel.vue` 本地即可。

## 7. 实现备注

- `aiPropertyContext` 保存 `{ nodeType, fieldName, value, label }`，用于 AI Tab 顶部显示字段中文名与字段 ID。
- 字段 `?` 按钮使用 `@click.stop` 防止触发字段 focus 或标签点击事件。
- `Rule` 节点 `?` 按钮同样使用 `@click.stop` 防止触发节点选中事件之外的重复逻辑（selectNode 已在 handler 内显式调用）。

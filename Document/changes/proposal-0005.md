# Proposal: 补全 LLM 功能最小可行补丁

> **类型**：Type-B（功能补全）
> **编号**：0005
> **状态**：IMPLEMENTED
> **提出日期**：2026-06-17
> **实现日期**：2026-06-17
> **依赖**：proposal-0001（已落地 MVP 源码）

---

## 1. 问题描述

当前后端已实现基于 LLM 的 Rule 解释、字段解释与规则生成能力（`explain_rule`、`explain_property`、`generate_rules`），但前端完全没有接入：

1. **没有 AI 问答/解释控件**：界面三栏布局中没有任何 AI 面板、按钮或入口。
2. **WebSocket 未连接**：`main.ts` 没有调用 `connectWebSocket()`，且前端硬编码端口 `18765` 与后端默认端口 `8765` 不一致（实现后统一为 `18765`，与 `SourceCode/config/config.json` 一致）。
3. **校验未体现 LLM**：`CodePanel` 的校验 Tab 只展示本地 `ValidationEngine` 结果，没有 LLM 解释或预警。
4. **消息协议不完整**：前端 `sendMessage` 未携带 `id`，后端回包会原样返回 `undefined` 的 id，无法做请求-响应匹配。

## 2. 变更目标

以最小可行补丁形式把后端 LLM 能力接到前端：

- 修复前端 WebSocket 连接配置，使前后端能正常通信。
- 应用启动时自动连接后端，并在标题栏显示连接状态。
- 在右侧 `CodePanel` 新增「AI 解释」Tab，解释当前选中的 Rule（含 LLM 预警）。
- 在校验 Tab 中为每个 issue 增加「AI 解释」入口，调用后端解释该 issue。
- 修正 WebSocket 消息格式，使请求/响应可匹配。

本次补丁**不**实现：
- 属性字段级别的解释按钮（留到后续 proposal）。
- 自然语言生成规则（`generate_rules`）的 UI。
- 多轮对话式 AI 问答。

## 3. 变更范围

### [MODIFIED] 前端

- `SourceCode/frontend/src/ws/client.ts`
  - 确认后端与配置文件均使用 `18765` 端口，`WS_URL` 统一为 `ws://127.0.0.1:18765`。
  - `sendMessage` 为每条消息生成唯一 `id`，并返回 `{ success, id }`。
  - 新增 `waitForResponse(type, id)` 用于按 `id` 等待单次响应。
  - 保留 `onMessage` 用于订阅广播/推送类消息。

- `SourceCode/frontend/src/main.ts`
  - 应用启动时调用 `connectWebSocket()`。
  - 订阅 `backendStatus` 变化并写入 Pinia store。

- `SourceCode/frontend/src/store/index.ts`
  - 新增 `aiExplanation`（当前 Rule 解释文本）、`aiWarnings`（LLM 预警数组）、`aiLoading`（加载状态）。
  - 新增 `explainSelectedRule()` action：将当前选中 Rule 路径与树快照发给后端 `explain_rule`，接收 `rule_explanation` 响应后写入状态。
  - 新增 `explainIssue(issue)` action：将 issue 的 code / path / message 发给后端新增接口 `explain_validation`。

- `SourceCode/frontend/src/components/code/CodePanel.vue`
  - Tab 增加 `ai`：`AI 解释`。
  - AI Tab 内容：
    - 若未选中 Rule，提示「请在左侧树中选择一个 Rule」。
    - 显示解释文本（`aiExplanation`）。
    - 显示 LLM 预警列表（`aiWarnings`）。
    - 提供「重新解释」按钮触发 `explainSelectedRule()`。

- `SourceCode/frontend/src/components/code/CodePanel.vue`（validation Tab）
  - 每个 issue 右侧增加「AI 解释」按钮，点击调用 `explainIssue(issue)` 并在 AI Tab 展示结果。

- `SourceCode/frontend/src/components/titlebar/AppTitleBar.vue`
  - 标题栏右侧增加后端连接状态指示器（绿点/红点 + 文字）。

### [MODIFIED] 后端

- `SourceCode/backend/src/server.ts`
  - `handleMessage` 增加 `explain_validation` 分支。
  - 新增 `handleExplainValidation(message)`：接收 `code`、`path`、`message`（issue 文本）和 `treeSnapshot`，构造 prompt 调用 LLM，返回自然语言解释。
  - 修正 `handleExplainRule` 的 TreePath 导航逻辑：当前实现从 `treeSnapshot.root.namedLayer` 开始并按 path 索引 children，但 path 第一段 `[0]` 通常指向 NamedLayer，遍历逻辑应从 root 开始并按 path 逐段索引，避免路径偏移。

- `SourceCode/backend/src/prompt-builder.ts`
  - 新增 `explainValidation(issue, treeSnapshot, kb)` 静态方法，构造 issue 解释 prompt。

## 4. 与 Plan 的对应关系

| Plan | 对应章节 |
| :--- | :--- |
| `plan-backend.md` | §3 Agent 服务、§4 LLM 交互 |
| `plan-frontend.md` | §3 代码/校验面板、§5 AI 面板 |
| `plan-core.md` | §6 ValidationEngine（issue 模型复用） |

## 5. 验收标准

- [ ] `npm run dev` 启动后，前端标题栏显示后端连接状态（绿色/红色）。
- [ ] 在左侧树中选中一个 Rule，右侧 AI Tab 能显示后端返回的中文解释文本。
- [ ] 若 Rule 存在明显问题（如无 Symbolizer、比例尺范围错误），AI Tab 的预警列表中能看到 LLM 预警 + 程序预警。
- [ ] 校验 Tab 中点击某个 issue 的「AI 解释」按钮，AI Tab 切换到并显示针对该 issue 的解释。
- [ ] 未配置 API Key 时自动降级到 `MockLLMClient`，界面仍能看到模拟解释。
- [ ] `npm run typecheck` 与 `npm test` 通过。

## 6. 风险与回退

- **后端未启动**：`connectWebSocket` 会自动重连，标题栏显示红色离线状态，不影响其他编辑功能。
- **LLM 调用失败**：后端会返回错误响应，前端在 AI Tab 中显示「解释失败：...」而不阻断主流程。
- **无 API Key**：`MockLLMClient` 降级，返回通用模拟文本。
- **回退**：删除 `main.ts` 中的 `connectWebSocket` 调用、CodePanel 的 `ai` Tab 与相关按钮，即可回到当前状态。

## 7. 实现备注

- 前端 `explainSelectedRule` 需要把整个 `treeSnapshot`（可序列化对象）传给后端，避免后端重复构造树。
- 后端 `handleExplainRule` 的 path 导航需要与 `TreePath` 语义一致：`path.toArray()` 形如 `[0, 0, 0, 1]`，分别对应 NamedLayer、UserStyle、FeatureTypeStyle、Rule 等层级。
- 为保持最小可行，AI 解释结果暂不同步写入树节点，仅作为展示状态存在 store 中。

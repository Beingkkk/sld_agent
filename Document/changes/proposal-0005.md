# Proposal 0005：统一 `apply_patch` 目标为 `StyleParams` 并完善本地乐观更新语义

## 状态

- 提案：2026-06-16
- 范围：前后端 `apply_patch` 语义对齐、本地乐观更新、组件 patch 路径迁移
- 状态：已实施

## 摘要

将 `apply_patch` 的 patch 目标统一为 `StyleParams`（前后端一致），完善前端乐观更新语义（快照 `params`、回滚 `params`），扩展后端 patch 支持 `add`/`remove`，修复后端 `rollback()` 不恢复 `params` 的缺陷，迁移 `SymbolizerEditor` 与 `RulesPanel` 的 patch 路径到 `StyleParams`，并补充前后端单元/组件测试。

## 动机

- `CLAUDE.md` 将“`apply_patch` 当前作用于 `StyleParams`，但 `interface-contracts.md` 与前端组件假设目标是 GeoStyler Style”列为设计债。
- 前端 `SymbolizerEditor` 和 `RulesPanel` 当前 emit 的是 GeoStyler Style 路径（如 `/rules/0/symbolizers/0`），但后端实际应用到 `StyleParams`，导致路径语义不匹配。
- 后端 `AgentSession.rollback()` 只恢复 `currentStyle`，不恢复 `this.params`，失败后 `params` 与 `currentStyle` 不一致。
- 前端 `styleStore.applyPatch` 快照 `currentStyle` 而非 `params`，乐观更新逻辑与后端实际行为错位，本地乐观更新无法落地。

## 变更内容

### 1. 新增共享 patch 工具

新建 `SourceCode/shared/patch.ts`，前后端共用：

- `applyPatches<T>(target, patches)`：支持 `replace` / `add` / `remove`。
- `parsePointer(path)`：将 JSON Pointer 拆分为路径段。
- 辅助函数 `setPath` / `addAtPath` / `removeAtPath`：
  - `replace` 自动创建中间对象；
  - `add` 对数组支持 `/-` 追加与数字索引插入，对对象直接设值；
  - `remove` 对数组按索引删除，对对象 `delete` 键。

同步更新 `SourceCode/shared/index.ts` 与 `SourceCode/shared/package.json` 的 exports，使前后端均可通过 `@shared/patch` / `@sldagent/shared/patch` 导入。

### 2. 后端 `AgentSession`

- 新增私有字段 `lastValidParams?: StyleParams`。
- `buildAndValidate()` 成功时同步快照 `lastValidParams`。
- `importStyle()` 设置 `this.params` 后同步快照 `lastValidParams`。
- `rollback()` 同时恢复 `currentStyle` 与 `params`；若快照不存在则清空对应状态。
- 移除本地 `applyPatches` / `setPath` 实现，改为从 `@sldagent/shared/patch` 导入。

### 3. 前端 `styleStore`

- `applyPatch(patches)`：
  - 快照 `params.value` 与 `currentStyle.value`。
  - 使用共享 `applyPatches` 立即更新 `params.value`（乐观更新）。
  - 调用 `wsClient.applyPatch`。
  - 成功：用 `applyResult(result)` 权威更新全部状态。
  - 失败：恢复 `params.value` 与 `currentStyle.value` 到快照，重新抛出错误。
- 移除空的 `applyPatchesLocally` stub。

### 4. 组件 patch 路径迁移

- `SymbolizerEditor.vue`：从读取 `store.currentStyle` 改为读取 `store.params`；字段按 `geometry_type` 映射到 `StyleParams` 字段名；`update()` 直接 emit 单字段 patch（如 `/fill_color`）。
- `RulesPanel.vue`：从 `store.currentStyle?.rules` 读取改为 `store.params?.rules`；`addRule` 追加 `RuleParams` 形状对象，`removeRule` 按索引删除。

### 5. 接口契约文档

更新 `Document/design/interface-contracts.md` §4.3：

- 明确 `StylePatch.path` 目标为 `StyleParams`。
- 路径示例改为 `/fill_color`、`/rules/0/name`、`/categories/-`、`/rules/0/filter`。
- 说明前端乐观更新作用于 `params`，`currentStyle` 由后端响应权威更新。

### 6. 测试补充

- 后端 `AgentSession.test.ts`：新增 `applyPatch` replace/add/remove、非法路径校验失败、失败后 `params` 回滚等用例。
- 前端新建 `styleStore.test.ts`：覆盖乐观更新、成功提交、失败回滚。
- 前端 `SymbolizerEditor.test.ts`：更新为 mock `params`，断言 `StyleParams` 路径与标量值。
- 前端新建 `RulesPanel.test.ts`：覆盖规则渲染、add/remove patch 路径与 `RuleParams` 值形状。

## 修改文件

- `SourceCode/shared/patch.ts`（新增）
- `SourceCode/shared/index.ts`（编辑）
- `SourceCode/shared/package.json`（编辑）
- `SourceCode/backend/src/session/AgentSession.ts`（编辑）
- `SourceCode/frontend/src/stores/styleStore.ts`（编辑）
- `SourceCode/frontend/src/components/SymbolizerEditor.vue`（编辑）
- `SourceCode/frontend/src/components/RulesPanel.vue`（编辑）
- `Document/design/interface-contracts.md`（编辑）
- `Document/changes/proposal-0005.md`（本文件）
- `SourceCode/backend/tests/unit/AgentSession.test.ts`（编辑）
- `SourceCode/frontend/tests/unit/styleStore.test.ts`（新增）
- `SourceCode/frontend/src/components/SymbolizerEditor.test.ts`（编辑）
- `SourceCode/frontend/src/components/RulesPanel.test.ts`（新增）

## 验证

```bash
# Backend
cd SourceCode/backend
npx tsc --noEmit
npx vitest run

# Frontend
cd SourceCode/frontend
npm run typecheck
npx vitest run
```

开发过程中可单独运行：

```bash
cd SourceCode/backend
npx vitest run tests/unit/AgentSession.test.ts

cd SourceCode/frontend
npx vitest run src/components/SymbolizerEditor.test.ts
npx vitest run src/components/RulesPanel.test.ts
npx vitest run tests/unit/styleStore.test.ts
```

## 风险

- `SymbolizerEditor` 字段从 GeoStyler 属性名（`wellKnownName`、`strokeColor`）切换到 `StyleParams` 字段名（`well_known_name`、`stroke_color`），MVP 仅覆盖常见字段，未映射字段通过后续 proposal 补充。
- 乐观更新仅更新 `params`，`currentStyle` 预览会滞后到后端响应；MVP 采用“确认后提交”模式，该延迟可接受。
- `add`/`remove` 数组索引在批量 patch 单批内稳定，但不支持跨批并发编辑。
- 共享 patch 工具新增文件，需确保前后端 typecheck 均能正确解析 `@shared/patch` / `@sldagent/shared/patch`。

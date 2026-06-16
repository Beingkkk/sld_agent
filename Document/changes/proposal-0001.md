# Proposal 0001：集成 xmllint-wasm Schema Bundle 实现生产级 XSD 校验

## 状态

- 提案：2026-06-15
- 范围：`SourceCode/backend`
- 状态：已实施

## 摘要

将已有的 `xmllint-wasm` 依赖与真实的 OGC SLD 1.0.0 schema bundle 接通，使 `SldService` 默认即可执行生产级 XSD 校验，无需依赖系统 `xmllint`，也无需运行时联网。

## 动机

- `SldService.validateWithWasm()` 已实现完整的 WASM 校验流程，但生产环境缺少 schema bundle，导致 WASM 路径实际上无法走到。
- `xmllint-wasm@^5.2.0` 已列入 `SourceCode/backend/package.json`，但除非调用方显式传入 `wasmSchemaBundleDir`，否则处于闲置状态。
- 项目路线图（`sdd-verify-report-20260615.md` §7）将此项列为 MVP 之后的第一优先级收尾工作。
- Windows 与离线环境需要一个不依赖系统 `xmllint` 二进制文件的可用 XSD 校验器。

## 变更内容

### 1. 新增 Schema Bundle

将 `spike/xmllint-wasm-bundle/schemas/` 中的 8 个 OGC SLD 1.0.0 schema 文件复制到 `SourceCode/backend/resources/sld-schemas/` 并纳入版本控制：

- `StyledLayerDescriptor.xsd`
- `xlink.xsd`
- `xml.xsd`
- `filter.xsd`
- `expr.xsd`
- `geometry.xsd`
- `gml.xsd`
- `feature.xsd`

该 bundle 约 81.4 KB，且 OGC SLD 1.0.0 为冻结标准，提交到仓库可避免构建期联网，并保证 CI / 离线构建可复现。

### 2. 在 SldService 中自动解析 Bundle 路径

- 在 `SourceCode/backend/src/sld/SldService.ts` 中新增 `resolveSchemaBundleDir()` 辅助函数，按以下优先级定位 bundle：
  1. `options.wasmSchemaBundleDir`
  2. `process.env.SLD_SCHEMA_DIR`
  3. `resolve(__dirname, '../resources/sld-schemas')`（生产 `dist/` 目录结构）
  4. `resolve(__dirname, '../../resources/sld-schemas')`（开发 `src/` 目录结构，经 `tsx` 运行）
- 修改 `SldService` 构造函数，自动填充 `wasmSchemaBundleDir`。
- 修改 `validateXsd()`，使解析出的 bundle 默认触发 `xmllint-wasm`；保留 `useWasm: false` 用于强制回退系统 `xmllint`。

### 3. 测试

扩展 `SourceCode/backend/tests/unit/SldService.test.ts`，覆盖以下场景：

- 合法 SLD 通过 XSD 校验，且 `tool` 为 `'xmllint-wasm'`。
- 完整 `validate()` 报告中包含通过的 `xsd` 结果。
- 非法 SLD 未通过 XSD 校验并返回错误信息。
- `useWasm: false` 时不使用 `xmllint-wasm`（回退系统 xmllint 或 skip）。
- `skipXsd: true` 且无可用校验器时返回 `tool: 'none'` 与 `passed: true`。

## 修改文件

- `SourceCode/backend/src/sld/SldService.ts`（编辑）
- `SourceCode/backend/tests/unit/SldService.test.ts`（编辑）
- `SourceCode/backend/resources/sld-schemas/*.xsd`（8 个新增文件）
- `Document/changes/proposal-0001.md`（本文件）

## 验证

- `npm run typecheck` 通过。
- `npm run test` 通过，21 个原有测试 + 5 个新增测试全部通过。
- 编译后手动验证后端，对简单点样式执行校验返回 `tool: 'xmllint-wasm'` 且 `passed: true`。

## 风险

- `__dirname` 在某些特殊执行环境（如被 webpack/rollup 打包）下可能不一致。缓解措施：`SLD_SCHEMA_DIR` 与 `wasmSchemaBundleDir` 提供显式覆盖。
- Electron 生产包需确保 `resources/sld-schemas/` 通过 `extraResources` 被打包，这超出本提案范围，将在 Electron 打包提案中处理。
- 若 OGC schema 发生变更，已提交的 bundle 可能过时。缓解措施：SLD 1.0.0 为冻结标准；spike 中的下载脚本仍可用于手动更新。

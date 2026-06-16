# Proposal 0003：按 plan-sld-service.md 拆分 SldService 内部模块

## 状态

- 提案：2026-06-16
- 范围：`SourceCode/backend/src/sld/`
- 状态：已实施

## 摘要

将单文件 [`SldService.ts`](SourceCode/backend/src/sld/SldService.ts) 中内联的 XSD 校验、Roundtrip 校验、XML Geometry 剥离、Style 比对、校验报告生成等职责，按 [`Document/design/sld-service.md`](Document/design/sld-service.md) §3 的类图拆分为独立模块；同时消除 `sld/types.ts` 与 `shared/types.ts` 的重复类型定义。

## 动机

- [`CLAUDE.md`](CLAUDE.md) 将"`SldService` 的 XSD/Roundtrip 组件内联"列为当前设计债，需要拆分为独立模块。
- 单文件约 309 行，混合了 parser 封装、XSD 校验、roundtrip 校验、报告聚合等多种职责，不利于后续维护。
- 接入原始要素采样值、细化 `apply_patch` 等后续工作将基于更清晰的模块边界推进。

## 变更内容

### 1. 新增子模块

在 `SourceCode/backend/src/sld/` 下新增：

- `SldParserWrapper.ts` — 封装 `geostyler-sld-parser` 的 `writeStyle`/`readStyle`；在 `readStyle` 前剥离 symbolizer 内部显式 `<Geometry>` 节点；负责 `xml-formatter` 美化输出。
- `XsdValidator.ts` — 实现 wasm bundle / 系统 `xmllint` / 跳过 / 失败 的完整 XSD 校验链条；包含 `resolveSchemaBundleDir()` 路径解析。
- `RoundtripValidator.ts` — 实现 Parser Roundtrip 校验（写→读→比较 Style）；包含 `compareStyles`/`compareRules`/`compareSymbolizers`。
- `ValidationReporter.ts` — 将 `ValidationResult` 聚合成 `ValidationReport`。

### 2. 重写 SldService 为薄门面

`SldService.ts` 仅保留：

- `ISldService` 接口
- `SldService` 类（组合上述四个子模块并委托公开方法）
- `createSldService` 工厂
- 类型 re-export

公共 API 与行为完全保持不变：

- `new SldService(options)` 自动解析 schema bundle 目录。
- `validateXsd()` 默认优先走 `xmllint-wasm`。
- `validate()` 捕获 `writeStyle` 失败并生成报告。

### 3. 清理重复类型

`SourceCode/backend/src/sld/types.ts` 原定义与 `SourceCode/backend/src/shared/types.ts` 重复的：

- `SldServiceOptions`
- `WriteOptions`
- `ValidationReport`
- `ValidationResult`
- `ValidationError`

改为从 `../shared/types.js` re-export；`ISldService` 在 `SldService.ts` 中定义后由 `types.ts` re-export。

### 4. 测试拆分

新增 `SourceCode/backend/tests/unit/sld/` 子目录及测试文件：

- `SldParserWrapper.test.ts` — 4 个用例
- `XsdValidator.test.ts` — 5 个用例
- `RoundtripValidator.test.ts` — 4 个用例
- `ValidationReporter.test.ts` — 4 个用例

将 `tests/unit/SldService.test.ts` 精简为 3 个集成用例，继续覆盖公共 API 的端到端行为。

## 修改文件

- `SourceCode/backend/src/sld/SldService.ts`（重写）
- `SourceCode/backend/src/sld/types.ts`（改为 re-export）
- `SourceCode/backend/src/sld/SldParserWrapper.ts`（新增）
- `SourceCode/backend/src/sld/XsdValidator.ts`（新增）
- `SourceCode/backend/src/sld/RoundtripValidator.ts`（新增）
- `SourceCode/backend/src/sld/ValidationReporter.ts`（新增）
- `SourceCode/backend/tests/unit/SldService.test.ts`（精简）
- `SourceCode/backend/tests/unit/sld/SldParserWrapper.test.ts`（新增）
- `SourceCode/backend/tests/unit/sld/XsdValidator.test.ts`（新增）
- `SourceCode/backend/tests/unit/sld/RoundtripValidator.test.ts`（新增）
- `SourceCode/backend/tests/unit/sld/ValidationReporter.test.ts`（新增）
- `Document/changes/proposal-0003.md`（本文件）

## 验证

```bash
cd SourceCode/backend
npx tsc --noEmit
npx vitest run
```

结果：

- `tsc --noEmit` 无类型错误。
- 后端全部测试通过：11 个测试文件、47 个用例（拆分前为 7 个文件、35 个用例）。
- 前端测试未受影响：49 个用例全部通过。
- `grep -r "from .*sld/types\.js" src/ tests/` 无命中。

## 风险

- 公共 API 路径保持不变，`server.ts` 与 `AgentSession.ts` 无需修改。
- 新模块继续使用 `.js` 扩展名相对导入，符合后端现有约定。
- 首次在 `tests/unit/` 下创建模块子目录；如未来希望统一扁平风格，可再通过提案调整。

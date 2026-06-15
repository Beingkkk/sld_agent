# plan-sld-service — SLD XML 读写与校验服务

> 文档定位：SDD 模块设计，编码唯一依据。  
> 关联需求：FR-03, FR-08, FR-11, NFR-01, NFR-02。  
> 关联设计：[Document/design/sld-service.md](../design/sld-service.md)、[Document/design/xmllint-packaging.md](../design/xmllint-packaging.md)。

---

## 1. 模块目标

封装 `geostyler-sld-parser` 完成 `Style ↔ SLD XML` 双向转换；集成系统 `xmllint` 与 `xmllint-wasm` 完成 XSD 校验；提供 Parser Roundtrip 校验；汇总为统一 `ValidationReport`。

---

## 2. 职责边界

| 组件 | 职责 |
|---|---|
| `SldService` | 对外统一入口：writeStyle / readStyle / validate |
| `SldParserWrapper` | 封装 `geostyler-sld-parser` 的 writeStyle / readStyle |
| `XsdValidator` | 使用系统 xmllint 或 xmllint-wasm 做 XSD 校验 |
| `RoundtripValidator` | 将 Style 写出后再读回，比对关键字段 |
| `ValidationReporter` | 将多来源结果合并为 `ValidationReport` |

---

## 3. 目录结构

```
SourceCode/backend/src/sld/
├── SldService.ts
├── SldParserWrapper.ts
├── XsdValidator.ts
├── RoundtripValidator.ts
├── ValidationReporter.ts
├── XmlGeometryStripper.ts
└── types.ts
```

---

## 4. 接口定义

### 4.1 SldService 对外接口

```typescript
interface SldServiceOptions {
  xsdPath?: string;                    // 系统 xmllint 用本地 XSD
  xmllintPath?: string;                // 默认 'xmllint'
  skipXsd?: boolean;                   // 缺失时是否降级
  wasmSchemaBundleDir?: string;        // xmllint-wasm bundle 目录
  useWasm?: boolean;
}

interface WriteOptions {
  includeXmlDeclaration?: boolean;
  prettyPrint?: boolean;
  encoding?: string;
}

interface SldService {
  writeStyle(style: Style, options?: WriteOptions): Promise<string>;
  readStyle(xml: string): Promise<Style>;
  validate(style: Style, xml?: string): Promise<ValidationReport>;
  validateXsd(xml: string): Promise<ValidationResult>;
  validateRoundtrip(style: Style, xml?: string): Promise<ValidationResult>;
}
```

### 4.2 XsdValidator 对外接口

```typescript
interface XsdValidator {
  validate(xml: string): Promise<ValidationResult>;
}
```

### 4.3 ValidationReport

```typescript
interface ValidationReport {
  passed: boolean;
  schema?: ValidationResult;
  xsd?: ValidationResult;
  roundtrip?: ValidationResult;
  errors: ValidationError[];
}

interface ValidationResult {
  passed: boolean;
  durationMs?: number;
  tool?: string;
  message?: string;
}

interface ValidationError {
  source: 'schema' | 'xsd' | 'roundtrip' | 'builder';
  message: string;
  location?: string;
  meta?: unknown;
}
```

---

## 5. 数据流

### 5.1 完整校验

```
Style + 可选 XML
        ↓
无 XML 则 writeStyle
        ↓
XsdValidator.validate(xml)
        ↓
RoundtripValidator.validate(style, xml)
        ↓
ValidationReporter.report({ xsd, roundtrip })
        ↓
ValidationReport
```

### 5.2 读 SLD

```
XML
        ↓
stripSymbolizerGeometry(xml)
        ↓
parser.readStyle()
        ↓
Style
```

---

## 6. 关键规则

### 6.1 `<Geometry>` 剥离

- 导入 SLD 前，使用正则/XML 处理移除 symbolizer 内部的 `<Geometry>...</Geometry>` 节点。
- 仅处理 SLD 1.0.0 命名空间下的 Geometry 子节点。

### 6.2 XSD 校验策略

1. 若提供 `wasmSchemaBundleDir` 或 `useWasm=true`，使用 `xmllint-wasm`。
2. 否则检测系统 `xmllint`；可用则用系统 XSD 校验。
3. 不可用时：
   - `skipXsd=false` → 返回失败结果。
   - `skipXsd=true` → 降级为 Parser Roundtrip + XML 语法校验。

### 6.3 Schema Bundle 加载

- 读取目录下所有 `.xsd`。
- `StyledLayerDescriptor.xsd` 必须作为主 schema 放在第一位。
- 其余作为 `preload`。
- 生产期从 `process.resourcesPath/sld-schemas/` 读取。

### 6.4 Roundtrip 比对

- 不要求深等；要求：
  - 能成功 `readStyle`。
  - Rule 数量一致。
  - Symbolizer 类型一致。
  - 关键字段（颜色、线宽、filter 字段名）一致。

---

## 7. 任务清单（TDD）

- [x] RED: 编写 `SldParserWrapper.writeStyle` 测试
- [x] GREEN: 实现 `SldParserWrapper.writeStyle`
- [x] RED: 编写 `XmlGeometryStripper` 剥离测试
- [x] GREEN: 实现 `XmlGeometryStripper`（当前内联于 SldService，后续可拆分为独立模块）
- [x] RED: 编写 `SldParserWrapper.readStyle` 测试（含含 Geometry 的 SLD）
- [x] GREEN: 实现 `SldParserWrapper.readStyle`
- [x] RED: 编写 `XsdValidator` 系统 xmllint 路径测试（mock exec）
- [x] GREEN: 实现 `XsdValidator.validateWithSystem`
- [x] RED: 编写 `XsdValidator` wasm bundle 测试（mock validateXML）
- [x] GREEN: 实现 `XsdValidator.validateWithWasm`
- [x] RED: 编写 `RoundtripValidator` 通过/失败测试
- [x] GREEN: 实现 `RoundtripValidator`
- [x] RED: 编写 `ValidationReporter` 合并测试
- [x] GREEN: 实现 `ValidationReporter`
- [x] RED: 编写 `SldService.validate` 完整流程测试
- [x] GREEN: 实现 `SldService`
- [ ] REFACTOR: 统一校验错误格式化（后续继续）

---

## 8. 版本历史

| 版本 | 日期 | 说明 |
|---|---|---|
| 1.0.0 | 2026-06-15 | 初始 plan |

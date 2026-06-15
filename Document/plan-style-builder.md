# plan-style-builder — StyleParams → GeoStyler Style 映射层

> 文档定位：SDD 模块设计，编码唯一依据。  
> 关联需求：FR-02, FR-03, FR-04, FR-05, FR-13, NFR-01。  
> 关联设计：[Document/design/style-builder.md](../design/style-builder.md)。

---

## 1. 模块目标

将受 JSON Schema 约束的 `StyleParams` 转换为 `geostyler-style` 的 `Style` 对象；支持按 `style_type` 分发的 Builder 工厂、字段别名归一化、默认值解析与几何类型校验。

---

## 2. 职责边界

| 组件 | 职责 |
|---|---|
| `StyleParamsValidator` | 使用 `ajv` 按 `style-params.schema.json` 校验 LLM/UI 输出 |
| `ParamsNormalizer` | 将 LLM 语义别名（如 `font_color`）映射为标准字段 |
| `StyleBuilderFactory` | 根据 `style_type` 创建对应 Builder |
| `StyleBuilder` | 抽象基类：提供默认值解析、几何校验、规则创建助手 |
| `SimpleStyleBuilder` | 生成单一 Rule + Symbolizer |
| `CategorizedStyleBuilder` | 为每个 category 生成 Rule，默认 Rule 用显式 `!=` filter |
| `ClassifiedStyleBuilder` | 根据 breakpoints/classes/color_ramp 生成分级 Rules |
| `TextStyleBuilder` | 生成 TextSymbolizer |
| `SymbolizerBuilder` | 根据 geometry_type 构建 Mark/Line/Fill Symbolizer |
| `DefaultValueResolver` | 从知识库查询默认值，回退到硬编码兜底 |

---

## 3. 目录结构

```
SourceCode/backend/src/style/
├── builder/
│   ├── StyleBuilderFactory.ts
│   ├── StyleBuilder.ts
│   ├── SimpleStyleBuilder.ts
│   ├── CategorizedStyleBuilder.ts
│   ├── ClassifiedStyleBuilder.ts
│   ├── TextStyleBuilder.ts
│   ├── SymbolizerBuilder.ts
│   └── DefaultValueResolver.ts
├── validation/
│   ├── StyleParamsValidator.ts
│   └── style-params.schema.json
├── normalization/
│   └── ParamsNormalizer.ts
├── RuleGenerator.ts
└── types.ts
```

---

## 4. 接口定义

### 4.1 StyleParams 类型

```typescript
interface StyleParams {
  style_name: string;
  geometry_type: 'point' | 'line' | 'polygon' | 'raster';
  style_type: 'simple' | 'categorized' | 'classified' | 'text' | 'raster';
  field_name?: string;

  fill_color?: string;
  fill_opacity?: number;
  stroke_color?: string;
  stroke_width?: number;
  stroke_opacity?: number;
  stroke_dasharray?: string;
  stroke_linecap?: 'butt' | 'round' | 'square';
  stroke_linejoin?: 'miter' | 'round' | 'bevel';
  opacity?: number;

  well_known_name?: 'circle' | 'square' | 'triangle' | 'star' | 'cross' | 'x';
  size?: number;
  rotation?: number;
  line_offset?: number;

  categories?: CategoryDef[];
  classes?: number;
  classification_method?: 'equalInterval' | 'quantile' | 'naturalBreaks';
  color_ramp?: string[];
  color_scheme?: string;

  label?: string;
  font_family?: string;
  font_size?: number;
  font_weight?: 'normal' | 'bold';
  font_style?: 'normal' | 'italic' | 'oblique';
  halo_color?: string;
  halo_radius?: number;
  placement?: 'point' | 'line';
  offset?: [number, number];

  rules?: RuleParams[];
  min_scale?: number;
  max_scale?: number;
}
```

### 4.2 Builder 对外接口

```typescript
interface StyleBuilder {
  build(): Style;
}

class StyleBuilderFactory {
  static create(params: StyleParams, deps: BuilderDeps): StyleBuilder;
}

interface BuilderDeps {
  resolver: DefaultValueResolver;
  ruleGenerator?: RuleGenerator;
  dataSchema?: DataSchema;
}
```

### 4.3 ParamsNormalizer 对外接口

```typescript
class ParamsNormalizer {
  normalize(params: Record<string, unknown>): StyleParams;
}
```

### 4.4 StyleParamsValidator 对外接口

```typescript
class StyleParamsValidator {
  validate(data: unknown): { valid: true; params: StyleParams } | { valid: false; errors: ValidationError[] };
}
```

---

## 5. 数据流

```
LLM 输出 / UI patch
        ↓
StyleParamsValidator.validate()
        ↓
ParamsNormalizer.normalize()
        ↓
StyleBuilderFactory.create(params, deps)
        ↓
具体 Builder.build()
        ↓
GeoStyler Style
```

---

## 6. 关键规则

### 6.1 分类默认 Rule

- 不使用 `elseFilter: true`（parser 不 roundtrip）。
- 使用显式 `['&&', ['!=', field, v1], ['!=', field, v2], ...]`。

### 6.2 分级断点

- 若 `breakpoints` 存在，直接使用。
- 否则若 `dataSchema` 与 `field_name` 存在，由 `RuleGenerator.computeBreaks()` 计算。
- 否则抛出 `BUILDER_ERROR`。

### 6.3 文本颜色

- Schema 层面统一使用 `stroke_color` 表示文本颜色。
- Builder 内部映射到 `TextSymbolizer.color`。

### 6.4 默认值解析顺序

1. 当前领域知识库映射表。
2. `default` 领域映射表。
3. 硬编码兜底（如 Mark size=6，Line width=1，Fill color='#808080'）。

---

## 7. 任务清单（TDD）

- [x] RED: 编写 `ParamsNormalizer` 别名映射测试
- [x] GREEN: 实现 `ParamsNormalizer`
- [x] RED: 编写 `StyleParamsValidator` 通过/失败测试
- [x] GREEN: 实现 `StyleParamsValidator`
- [x] RED: 编写 `SymbolizerBuilder` 点/线/面构建测试
- [x] GREEN: 实现 `SymbolizerBuilder`
- [x] RED: 编写 `SimpleStyleBuilder` 测试
- [x] GREEN: 实现 `SimpleStyleBuilder`
- [x] RED: 编写 `CategorizedStyleBuilder` 测试（验证默认 rule filter 形式）
- [x] GREEN: 实现 `CategorizedStyleBuilder`
- [x] RED: 编写 `ClassifiedStyleBuilder` 测试（含 mock RuleGenerator）
- [x] GREEN: 实现 `ClassifiedStyleBuilder`（RuleGenerator 使用 dataSchema min/max 近似）
- [x] RED: 编写 `TextStyleBuilder` 测试
- [x] GREEN: 实现 `TextStyleBuilder`
- [x] RED: 编写 `DefaultValueResolver` 测试
- [x] GREEN: 实现 `DefaultValueResolver`
- [x] RED: 编写 `StyleBuilderFactory` 分发测试
- [x] GREEN: 实现 `StyleBuilderFactory`
- [ ] REFACTOR: 提取公共 Symbolizer/Rule 构建逻辑（后续继续）

---

## 8. 版本历史

| 版本 | 日期 | 说明 |
|---|---|---|
| 1.0.0 | 2026-06-15 | 初始 plan |

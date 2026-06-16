# Plan: Core（核心数据模型与转换层）

> 版本：v1.0.0  
> 状态：锁定  
> 依赖：spec v1.0.0、constitution v1.0.0  
> 对应需求：M-02、M-04、M-07

---

## 1. 目标与边界

Core 模块负责维护 SLD 树的数据模型、状态管理、以及树与 GeoStyler Style / SLD XML 之间的双向转换。它是整个应用的“唯一真相源”所在层。

本模块以独立 workspace package 形式存在于 `SourceCode/core/`，被 `frontend` 与 `backend` 通过 workspace 协议引用。

**边界内**：
- SLD 树类型定义与不可变更新。
- GeoStyler Style 的生成与消费。
- SLD XML 的生成与解析（调用 `geostyler-sld-parser`）。
- 跨节点业务规则校验（ElseFilter 唯一性、比例尺范围、Symbolizer 非空等）。

**边界外**：
- UI 组件（plan-frontend）。
- LLM 调用与 Agent 流程（plan-backend）。
- 文件系统对话框（plan-frontend / Electron）。

## 2. 核心类设计

### 2.1 `SLDTree`（不可变树）

```typescript
class SLDTree {
  readonly root: SLDRoot;
  
  constructor(root?: SLDRoot);
  
  // 节点操作
  // 注意：MVP 仅允许一个 NamedLayer 和一个 UserStyle；addNode 在对应层级超过一个时拒绝或替换。
  addNode(parentPath: TreePath, type: NodeType, kind?: SymbolizerKind): SLDTree;
  removeNode(path: TreePath): SLDTree;
  updateNode(path: TreePath, patch: Partial<NodeData>): SLDTree;
  moveNode(sourcePath: TreePath, targetPath: TreePath): SLDTree;
  
  // 派生数据
  toGeoStyler(): GeoStylerStyle;
  // 每个 FeatureTypeStyle 单独调用 parser.writeStyle() 生成 SLD 片段，
  // 再由 fast-xml-parser 后处理拼接为完整 SLD XML。
  toSLDXML(): string;
  static fromGeoStyler(style: GeoStylerStyle): SLDTree;
  // 先用 fast-xml-parser 解析 SLD XML 结构，按 FeatureTypeStyle 边界切分，
  // 再调用 parser.readStyle() 将每个片段转为 GeoStyler Style，最后还原为树。
  static fromSLDXML(xml: string): Promise<SLDTree>;
  
  // 校验
  validate(): ValidationIssue[];
}
```

MVP 约束：
- 根节点 `StyledLayerDescriptor` 下**仅允许一个** `NamedLayer`。
- `NamedLayer` 下**仅允许一个** `UserStyle`。
- 导入多 NamedLayer / 多 UserStyle 的 SLD 文件时，Core 在解析阶段给出 warning，并仅保留第一个。

默认新建项目结构：

```text
StyledLayerDescriptor
└── sld:NamedLayer: default_layer
    └── sld:UserStyle: default_style
        └── sld:FeatureTypeStyle: default_feature_type_style
            └── sld:Rule: default_rule
                └── sld:PointSymbolizer (kind = Mark)
```

默认 Mark Symbolizer 的字段值取自 `field-registry.json` 中的 `default` 值。

### 2.2 `TreePath` 与节点类型

```typescript
type NodeType = 
  | 'NamedLayer' 
  | 'UserStyle' 
  | 'FeatureTypeStyle' 
  | 'Rule' 
  | 'Symbolizer';

type SymbolizerKind = 'Mark' | 'Line' | 'Fill' | 'Text';

class TreePath {
  readonly segments: number[];
  constructor(segments: number[]);
  child(index: number): TreePath;
  parent(): TreePath | null;
  equals(other: TreePath): boolean;
}
```

### 2.3 `GeoStylerTransformer` 与 `SymbolizerTransformer`

```typescript
class GeoStylerTransformer {
  // 树 → GeoStyler Style（FeatureTypeStyle 扁平化：每个 FTS 生成独立 GeoStyler Style）
  static toGeoStyler(tree: SLDRoot): GeoStylerStyle;
  
  // GeoStyler Style → 树（按导入时记录的 FeatureTypeStyle 边界还原；
  // 若无法还原，则为所有 rules 包裹默认 FeatureTypeStyle）
  static fromGeoStyler(style: GeoStylerStyle, featureTypeStyleMeta?: FeatureTypeStyleMeta[]): SLDRoot;
}

class SymbolizerTransformer {
  // 树 Symbolizer 节点 → GeoStyler Symbolizer
  static toGeoStyler(kind: SymbolizerKind, data: SymbolizerNodeData): GeoStylerSymbolizer;
  
  // GeoStyler Symbolizer → 树 Symbolizer 节点
  static fromGeoStyler(symbolizer: GeoStylerSymbolizer): SymbolizerNodeData;
}
```

`SymbolizerTransformer` 是 SLD 树与 GeoStyler Style 之间的显式映射层。树节点字段采用语义化 ID（如 `markFillColor`、`lineWidth`、`textFont`），映射层按 `kind` 将其写入 GeoStyler 的扁平字段：

| Symbolizer kind | 树字段 | GeoStyler 字段 | 说明 |
| :--- | :--- | :--- | :--- |
| `Mark` | `markFillColor` | `color` | 填充颜色 |
| `Mark` | `markFillOpacity` | `fillOpacity` | 填充不透明度 |
| `Mark` | `markRadius` | `radius` | 点大小 |
| `Mark` | `markStrokeColor` | `strokeColor` | 描边颜色 |
| `Mark` | `markStrokeWidth` | `strokeWidth` | 描边宽度 |
| `Mark` | `markRotate` | `rotate` | 旋转角度 |
| `Line` | `lineColor` | `color` | 线颜色 |
| `Line` | `lineWidth` | `width` | 线宽度 |
| `Line` | `lineDasharray` | `dasharray` | 虚线模式；UI 用 `line-style` 枚举，Core 映射为数组 |
| `Line` | `lineCap` | `cap` | 线端样式 |
| `Line` | `lineJoin` | `join` | 连接样式 |
| `Fill` | `fillColor` | `color` | 填充颜色 |
| `Fill` | `fillOpacity` | `fillOpacity` | 填充不透明度 |
| `Fill` | `fillOutlineColor` | `outlineColor` | 描边颜色 |
| `Fill` | `fillOutlineWidth` | `outlineWidth` | 描边宽度 |
| `Fill` | `fillOutlineOpacity` | `outlineOpacity` | 描边不透明度 |
| `Fill` | `fillOutlineDasharray` | `outlineDasharray` | 描边虚线模式 |
| `Text` | `textLabel` | `label` | 标注字段；UI 用 `property-name` 下拉 |
| `Text` | `textFont` | `font[0]` | 字体（数组首项） |
| `Text` | `textSize` | `size` | 字号 |
| `Text` | `textColor` | `color` | 文字颜色 |
| `Text` | `textFontWeight` | `fontWeight` | 字重 |
| `Text` | `textFontStyle` | `fontStyle` | 字体样式 |
| `Text` | `textAnchor` | `anchor` | 锚点；UI 用 `point2d` `{x, y}`，Core 映射为 `[x, y]` |
| `Text` | `textOffset` | `offset` | `{x, y}` → `[x, y]` |
| `Text` | `textHaloColor` | `haloColor` | 光晕颜色 |
| `Text` | `textHaloWidth` | `haloWidth` | 光晕宽度 |

映射规则集中维护在 `SymbolizerTransformer` 中，并配套单元测试覆盖每一种 kind 的字段往返。

通用映射规则：
1. 遍历 Symbolizer 节点数据中的每个字段 ID；
2. 在 `field-registry.json` 中查找该字段的 `geoStylerPath`；
3. 若存在直接对应关系，则 `geoStylerSymbolizer[geoStylerPath] = value`；
4. 特殊字段由 `SymbolizerTransformer` 显式处理：
   - `textFont` → `font = [value]`
   - `textAnchor` → `anchor = [value.x, value.y]`
   - `textOffset` → `offset = [value.x, value.y]`
   - `lineDasharray` 为字符串枚举时映射为 number[]：`solid → []`、`dashed → [6, 4]`、`dotted → [2, 4]`；
     若已经是数组则直接透传（保留高级模式扩展）。

### 2.4 `ValidationEngine`

```typescript
interface ValidationIssue {
  path: TreePath;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

class ValidationEngine {
  validate(tree: SLDRoot): ValidationIssue[];
}
```

## 3. 接口定义

### 3.1 输入：用户操作事件

| 事件 | 字段 | 说明 |
| :--- | :--- | :--- |
| `tree_node_added` | `{ parentPath: number[], type: NodeType, kind?: SymbolizerKind }` | 在指定父节点下追加子节点。 |
| `tree_node_removed` | `{ path: number[] }` | 删除指定节点。 |
| `tree_node_updated` | `{ path: number[], patch: object }` | 更新节点字段。 |
| `tree_node_moved` | `{ sourcePath: number[], targetPath: number[] }` | 调整同层级节点顺序。 |

### 3.2 输出：树状态快照

```typescript
interface TreeStateSnapshot {
  version: '1.0.0';
  root: SLDRoot;
  selectedPath: number[] | null;
  expandedPaths: string[]; // 以 JSON 序列化的 path 作为 key
  issues: ValidationIssue[];
}
```

### 3.3 输出：转换结果

```typescript
interface TransformResult {
  geoStyler: GeoStylerStyle;
  sldXml: string;
  issues: ValidationIssue[];
}
```

## 4. 数据流

用户操作（前端）
  → `Store.update(...)` 调用 `SLDTree` 不可变方法
  → 生成新的 `TreeStateSnapshot`
  → `GeoStylerTransformer.toGeoStyler()` 为每个 FeatureTypeStyle 生成独立 GeoStyler Style
  → `geostyler-sld-parser.writeStyle()` 生成各 FeatureTypeStyle 的 SLD 片段
  → `fast-xml-parser` 后处理：组装 NamedLayer / UserStyle / 多 FeatureTypeStyle 容器，补回 title / abstract / featureTypeName 等扩展字段
  → 产出完整 SLD XML
  → `ValidationEngine.validate()` 产出校验问题
  → 前端同步刷新树、代码区、校验面板、预览

## 5. 关键决策

| 决策 | 方案 | 原因 |
| :--- | :--- | :--- |
| 树状态是否可序列化？ | 是，作为 JSON 保存到文件 / 后端上下文 | 便于导入导出与 LLM 多轮上下文。 |
| Symbolizer kind 命名 | 对齐 GeoStyler 原生类型（`Mark` / `Line` / `Fill` / `Text`），UI 层用 `userLabel` 做中文展示 | 与 parser 输入输出一致，减少转换歧义。 |
| NamedLayer / UserStyle 数量 | MVP 仅允许各一个；多容器 SLD 导入时保留第一个并 warning | 降低 UI 与状态管理复杂度。 |
| FeatureTypeStyle 在 GeoStyler 中如何处理？ | **parser 分片 + XML 后处理**：导出时每个 FTS 单独生成 SLD 片段，再用 `fast-xml-parser` 拼接为完整 SLD；导入时先用 `fast-xml-parser` 解析 XML 结构，按 FTS 边界切分后再调用 parser 读取 | GeoStyler Style 顶层无 FTS 概念，但必须保留多 FTS 容器与元数据。 |
| 扩展字段如何保留？ | 存储在 SLD 树对象中；导出时用 `fast-xml-parser` 在 parser 生成的片段基础上补充 title/abstract/featureTypeName 等节点；导入时从 XML 提取并写回树节点 | GeoStyler JSON 不直接支持 title/abstract/featureTypeName。 |
| XML 后处理库 | `fast-xml-parser` | 体积小、性能好、支持命名空间与双向转换。 |
| 树 → GeoStyler 字段映射 | 树节点字段保持语义化 ID，由 `SymbolizerTransformer` 按 kind 映射到 GeoStyler 扁平字段 | 兼容 SLD XML 语义与 GeoStyler 数据模型；映射规则集中、可单测。 |
| 校验时机？ | 每次树更新后全量校验，结果进入 Store | 保证代码区与校验面板实时一致。 |
| 模块组织 | Core 作为 monorepo workspace package | 被 frontend/backend 共享，避免代码复制。 |
| Parser 版本管理 | `geostyler-sld-parser` 等共享依赖在 root `package.json` 中统一声明，各 workspace 引用同一版本 | 保证前后端对 SLD 的理解一致（CP-5）。 |

## 6. 测试策略

- **单元测试**：`SLDTree` 的 CRUD 与不可变性、`GeoStylerTransformer` 双向转换、`ValidationEngine` 规则。
- **集成测试**：用 `example-sld.xml` 做解析 → 树 → GeoStyler → SLD XML 的端到端对比。
- ** fixtures**：`Document/Research/sld/1.0.0/example-sld.xml`、`SourceCode/data/` 下 Sample GeoJSON。

## 7. 任务清单

- [DC-001] 定义 SLD 树 TypeScript 类型与默认值工厂。
- [DC-002] 实现 `TreePath` 与节点定位工具。
- [DC-003] 实现 `SLDTree` 不可变 CRUD。
- [DC-004] 实现 `GeoStylerTransformer.toGeoStyler()`（含 FeatureTypeStyle 扁平化）。
- [DC-005] 实现 `GeoStylerTransformer.fromGeoStyler()`。
- [DC-005a] 实现 `SymbolizerTransformer`：树 Symbolizer 字段 ↔ GeoStyler 扁平字段映射。
- [DC-006] 集成 `geostyler-sld-parser` 完成 SLD XML 读写。
- [DC-007] 实现 `ValidationEngine` 与基础规则。
- [DC-008] 编写单元测试与端到端 fixtures。

## 8. 风险与依赖

- **依赖 `geostyler-sld-parser` 版本**：必须与 plan-frontend 和 plan-backend 协商统一版本。
- **扩展字段丢失风险**：生成 SLD 时若 `fast-xml-parser` 后处理遗漏，会导致 UserStyle/FTS 元数据丢失，需通过 example-sld.xml 回归测试覆盖。
- **FeatureTypeStyle 边界还原风险**：导入复杂 SLD 时，parser 分片 + XML 后处理必须严格保留 FTS 顺序与层级，需端到端 fixtures 覆盖。
- **性能风险**：树较深时全量转换可能引入延迟，必要时引入增量转换或 memoization（后续优化）。

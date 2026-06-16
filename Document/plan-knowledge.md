# Plan: Knowledge（知识库与 LLM 输入治理）

> 版本：v1.0.0  
> 状态：锁定  
> 依赖：spec v1.0.0、constitution v1.0.0、plan-backend v1.0.0  
> 对应需求：S-03（AI 解释）

---

## 1. 目标与边界

Knowledge 模块负责为后端 LLM 提供结构化、可版本化的预置知识，同时为前端属性面板提供字段元数据与 Symbolizer 模板。所有知识文件以外置 JSON 形式存放在 `SourceCode/data/`，运行时加载。

**边界内**：
- `SourceCode/data/registry/`：字段注册表、节点/Symbolizer schema、抽象编辑器类型。
- `SourceCode/data/knowledge/`：LLM 知识库（领域目录、通用约束、SLD 元素速查、Few-shot 样例）。
- `KnowledgeBase` 加载、校验、注入 Prompt。

**边界外**：
- LLM 调用实现（plan-backend `LLMClient`）。
- Prompt 模板组合逻辑（plan-backend `PromptBuilder`）。
- 前端属性面板具体 Vue 组件（plan-frontend）。

## 2. 目录结构

```text
SourceCode/data/
├── registry/
│   ├── editor-types.json          # 抽象编辑器控件类型
│   ├── field-registry.json        # 所有可编辑字段元数据
│   ├── node-schemas.json          # 节点类型字段组合
│   └── symbolizer-schemas.json    # Symbolizer 种类字段组合
└── knowledge/
    ├── root.json                  # 领域目录
    ├── default.json               # 通用样式模式与约束
    ├── sld-reference.json         # SLD 1.0.0 元素速查
    └── examples.json              # Few-shot 样例
```

## 3. 核心类设计

### 3.1 `KnowledgeBase`

```typescript
class KnowledgeBase {
  constructor(basePath: string);
  
  load(): Promise<void>;
  
  // 注册表访问
  getEditorType(type: string): EditorTypeDefinition;
  getField(id: string): FieldDefinition;
  getNodeSchema(nodeType: string): NodeSchema;
  getSymbolizerSchema(kind: string): SymbolizerSchema;
  
  // LLM 知识
  getDomainCatalog(): Domain[];
  getGeneralConstraints(): string[];
  getSLDReference(): SLDReference;
  getExamples(): Example[];
  
  // Prompt 注入
  buildFieldDictionaryPrompt(): string;
  buildSLDReferencePrompt(): string;
  buildExamplesPrompt(): string;
}
```

## 4. 知识文件设计

### 4.1 `registry/editor-types.json`

定义抽象编辑器控件，前端据此渲染 Vue 组件，LLM 据此理解字段取值类型。

### 4.2 `registry/field-registry.json`

所有可编辑字段的统一元数据，关键字段：

| 字段 | 说明 |
| :--- | :--- |
| `id` | 字段唯一标识（树节点中使用） |
| `label` | 中文标签 |
| `description` | 字段说明 |
| `editor` | 对应 editor-type |
| `group` | 属性面板分组标识，同组字段折叠展示 |
| `required` | 是否必填 |
| `default` | 默认值 |
| `options` | enum 类型可选值 |
| `editorProps` | 传给编辑器的额外 props（min/max/step） |
| `geoStylerPath` | 对应 GeoStyler Style 字段名；由 Core `SymbolizerTransformer` 按 kind 解析 |
| `sldCssParameter` / `sldElement` | 对应 SLD XML 概念，用于文档与 LLM 理解 |

### 4.3 `registry/node-schemas.json`

定义 `UserStyle`、`FeatureTypeStyle`、`Rule` 的字段列表。

### 4.4 `registry/symbolizer-schemas.json`

定义 `Mark`、`Line`、`Fill`、`Text` 四种 Symbolizer 的字段列表、展示名称与分组折叠定义。每个 Symbolizer 的 `groups` 数组描述属性面板的折叠分组。

### 4.5 `knowledge/default.json`

LLM 通用约束：
- `styleCatalog`：simple / categorized / classified / text 四种样式模式
- `constraints`：业务规则（如 ElseFilter 唯一性、比例尺范围、文本可读性）
- `modificationRules`：多轮修改时的保留/更新策略

### 4.6 `knowledge/sld-reference.json`

SLD 1.0.0 完整元素速查，供 LLM 理解导入的任意 SLD XML。

### 4.7 `knowledge/examples.json`

Few-shot 样例，帮助 LLM 将自然语言映射为树操作。

## 5. 与 LLM 的集成

`PromptBuilder` 调用 `KnowledgeBase` 的方法，将以下内容注入 prompt：

1. **字段词典**：从 `field-registry.json` 生成“字段名 → 含义 → 类型 → 映射”表格。
2. **SLD 速查**：从 `sld-reference.json` 生成元素层级说明。
3. **通用约束**：从 `default.json` 生成规则清单。
4. **Few-shot**：从 `examples.json` 生成示例。

## 6. 与前端的集成

前端启动时通过 backend 或直接加载 `SourceCode/data/registry/*.json`（作为静态资源），用于：
- 根据 `node-schemas.json` / `symbolizer-schemas.json` 生成属性面板布局。
- 根据 `field-registry.json` 获取字段标签、默认值、校验规则。
- 根据 `editor-types.json` 映射到 Vue 编辑器组件。

## 7. 关键决策

| 决策 | 方案 | 原因 |
| :--- | :--- | :--- |
| 知识文件位置 | `SourceCode/data/` 外置 JSON | 可热更新、可版本化、非代码。 |
| 字段注册表 | 统一 `field-registry.json` | 一份真相源，同时服务前端渲染与 LLM 理解。 |
| 编辑器抽象 | `editor-types.json` 定义控件类型 | 新增字段类型无需新增 Vue 组件，只需配置。 |
| Symbolizer kind | 对齐 GeoStyler（Mark/Line/Fill/Text） | 减少转换层复杂度；UI 使用 `userLabel` 展示友好名称。 |
| 领域知识 | 当前仅保留 `default` 通用领域 | 满足 MVP 基础参数编辑；交通/土地利用后续扩展。 |

## 8. 任务清单

- [DK-001] 创建 `SourceCode/data/registry/` 与 `SourceCode/data/knowledge/` 目录。
- [DK-002] 编写 `editor-types.json`。
- [DK-003] 编写 `field-registry.json`。
- [DK-004] 编写 `node-schemas.json`。
- [DK-005] 编写 `symbolizer-schemas.json`。
- [DK-006] 编写 `knowledge/root.json`、`default.json`、`sld-reference.json`、`examples.json`。
- [DK-007] 后端实现 `KnowledgeBase` 加载与校验。
- [DK-008] 后端实现 `PromptBuilder` 注入字段词典、SLD 速查、约束、样例。
- [DK-009] 前端实现 `PropertyForm` 根据 registry 动态渲染。
- [DK-010] 前端实现通用编辑器组件：`StringEditor`, `NumberEditor`, `ColorEditor`, `EnumEditor`, `BooleanEditor`, `TextareaEditor`, `OpacityEditor`, `ScaleRangeEditor`, `Point2DEditor`, `NumberArrayEditor`, `CqlEditor`, `FontEditor`。

## 9. 风险与依赖

- **JSON 与代码不同步**：若 registry 更新了但前端组件未实现对应 editor，会渲染失败。需增加未知 editor 的 fallback。
- **LLM context 长度**：字段词典 + SLD 速查 + 示例可能较长，需监控 token 消耗，必要时精简或分片。
- **字段 ID 稳定性**：字段 ID 变更会影响前后端与 LLM 的理解，一旦确定尽量避免修改。
- **GeoStyler 字段映射准确性**：`geoStylerPath` 必须与 `geostyler-style` 类型一致，否则转换失败。

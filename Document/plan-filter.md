# Plan: Filter（节点树 Filter 编辑器）

> 版本：v1.0.0  
> 状态：锁定  
> 依赖：spec v1.0.0、constitution v1.0.0、plan-core v1.0.0、plan-frontend v1.0.0  
> 对应需求：S-01

---

## 1. 目标与边界

Filter 模块为 Rule 提供可视化节点树编辑器，让用户以 AND / OR / NOT / 比较条件的方式组合筛选规则，并实时预览对应 CQL 文本与 GeoStyler Filter。

**边界内**：
- Filter 节点树数据模型与不可变更新。
- 节点树 ↔ GeoStyler Filter 数组的双向转换。
- 节点树 → CQL 文本生成。
- 可视化节点树 UI 组件（递归树、节点编辑器、工具栏、CQL 预览）。
- 在 Rule 属性面板中的集成。

**边界外**：
- 属性字段自动补全（需要数据 schema，MVP 可先用简单文本输入）。
- 复杂 SLD 函数表达式（如 `PropertyIsBetween`、`PropertyIsLike` 的通配符细节）。
- Filter 的 LLM 自然语言生成（后续扩展）。

---

## 2. 数据模型

### 2.1 Filter 节点树

```typescript
interface FilterNode {
  /** 节点唯一标识，用于 UI 定位与不可变更新 */
  id: string;

  /** 节点类型 */
  type: 'and' | 'or' | 'not' | 'comparison';

  /** 比较运算符，仅 comparison 节点有效 */
  operator?: '==' | '!=' | '<' | '<=' | '>' | '>=' | '*=';

  /** 属性名，仅 comparison 节点有效 */
  propertyName?: string;

  /** 比较值，仅 comparison 节点有效 */
  value?: string | number;

  /** 子节点，and/or/not 节点有效 */
  children?: FilterNode[];
}
```

规则：
- `and` / `or` 节点必须包含至少一个子节点。
- `not` 节点必须且只能包含一个子节点。
- `comparison` 节点为叶子节点，无 `children`。

### 2.2 树中的存储位置

Rule 节点数据中的 `filter` 字段直接保存 `FilterNode | null`：

```typescript
interface RuleNodeData {
  name?: string;
  title?: string;
  abstract?: string;
  elseFilter?: boolean;
  scaleDenominator?: { min?: number; max?: number };
  filter?: FilterNode | null;
}
```

当 `elseFilter` 为 `true` 时，`filter` 被忽略，UI 中 Filter 编辑器置为只读或隐藏。

---

## 3. 转换层

### 3.1 FilterNode → GeoStyler Filter

```typescript
class FilterTransformer {
  static toGeoStyler(node: FilterNode): GeoStylerFilter;
}
```

映射规则：

| FilterNode | GeoStyler Filter |
| :--- | :--- |
| `{ type: 'and', children: [...] }` | `["&&", ...children]` |
| `{ type: 'or', children: [...] }` | `["\|\|", ...children]` |
| `{ type: 'not', children: [child] }` | `["!", child]` |
| `{ type: 'comparison', operator: '==', propertyName: 'a', value: 'b' }` | `["==", "a", "b"]` |
| `{ type: 'comparison', operator: '*=', propertyName: 'a', value: '%x%' }` | `["*=", "a", "%x%"]` |

### 3.2 GeoStyler Filter → FilterNode

解析 GeoStyler Filter 数组，递归构建 `FilterNode`。

注意：GeoStyler Filter 中函数表达式（如 `fnc_*`）在 MVP 中暂不支持，解析时标记为 `unsupported` 节点或以 CQL 文本兜底。

### 3.3 FilterNode → CQL

```typescript
class CqlWriter {
  static write(node: FilterNode): string;
}
```

示例：

| FilterNode | CQL |
| :--- | :--- |
| `comparison == name 'school'` | `name = 'school'` |
| `and [== a 1, > b 2]` | `(a = 1 AND b > 2)` |
| `or [and [...], not (...)]` | `((...) OR (NOT ...))` |
| `comparison *= name '%学校%'` | `name LIKE '%学校%'` |

CQL 仅用于预览与导出展示，不作为树的持久形式。

---

## 4. UI 组件

### 4.1 `FilterEditor`

Rule 属性面板中的 Filter 区域：

```vue
<FilterEditor v-model="rule.filter" />
```

包含：
- 顶部开关：`ElseFilter` 开关。
- 左侧/上方：`FilterTree` 节点树。
- 右侧/下方：`FilterNodeEditor` 当前选中节点编辑器。
- 底部：`CqlPreview` 实时 CQL 文本。

### 4.2 `FilterTree`

递归渲染 `FilterNode`：
- `and` / `or` / `not` 节点显示为逻辑门卡片，可展开/折叠。
- `comparison` 节点显示为单行条件：`[属性名] [运算符] [值]`。
- 支持选中节点、添加子节点、删除节点。

### 4.3 `FilterNodeEditor`

根据选中节点类型渲染：
- 逻辑节点：显示类型下拉（and / or / not）。
- 比较节点：
  - `propertyName`：文本输入（后续可接入属性字段下拉）。
  - `operator`：下拉选择 `==`、`!=`、`<`、`<=`、`>`、`>=`、`*=`。
  - `value`：文本/数字输入。

### 4.4 `FilterToolbar`

按钮：
- 添加 AND 节点
- 添加 OR 节点
- 添加 NOT 节点
- 添加比较条件
- 删除选中节点

约束：
- 选中 `comparison` 节点时，只能添加同级逻辑节点或删除自身。
- 根节点不能被删除，只能清空为 `null`。

---

## 5. 与 Core / Frontend 的接口

### 5.1 与 Core

Core 导出：
- `FilterTransformer.toGeoStyler(node)`
- `FilterTransformer.fromGeoStyler(filter)`
- `CqlWriter.write(node)`

### 5.2 与 Frontend

- Rule 属性面板通过 `store.updateNode(path, { filter: newFilterNode })` 更新树。
- `CodePanel` 中 GeoStyler JSON 显示转换后的 `filter` 数组。
- CQL 预览调用 `CqlWriter.write(rule.filter)`。

---

## 6. 数据流

用户点击 Rule → 属性面板加载 `FilterEditor`
  → `FilterTree` 渲染当前 `filter` 节点树
  → 用户添加/编辑/删除节点
  → `store.updateNode(path, { filter })`
  → Core `SLDTree` 返回新树
  → `FilterTransformer.toGeoStyler()` 生成 GeoStyler filter 数组
  → `geostyler-sld-parser` 生成 SLD XML
  → `CqlWriter.write()` 更新 CQL 预览
  → `ValidationEngine` 校验 Filter 合法性

---

## 7. 关键决策

| 决策 | 方案 | 原因 |
| :--- | :--- | :--- |
| 树中 Filter 存储形式 | `FilterNode` 对象树 | 便于 UI 递归编辑与不可变更新。 |
| GeoStyler 转换时机 | 生成 GeoStyler Style / SLD XML 时实时转换 | 保持树模型与 UI 一致，GeoStyler 仅作为输出格式。 |
| CQL 角色 | 只读预览，不作为存储 | CQL 解析复杂，MVP 阶段避免双向解析带来的歧义。 |
| 支持的运算符 | `==`、`!=`、`<`、`<=`、`>`、`>=`、`*=` | 覆盖 MVP 常见比较与 LIKE 场景。 |
| 属性字段补全 | MVP 用文本输入 `propertyName`，后续接入数据 schema | 降低前端复杂度，先保证核心编辑可用。 |
| ElseFilter 与 Filter 关系 | 开启 ElseFilter 时忽略 filter | 符合 SLD 语义与宪法约束。 |

---

## 8. 测试策略

- **单元测试**：
  - `FilterTransformer` 各种节点组合的 toGeoStyler / fromGeoStyler 往返。
  - `CqlWriter` 输出格式（括号、引号、LIKE 转换）。
  - Filter 节点 CRUD 不可变性。
- **集成测试**：
  - 在 Rule 中编辑 Filter → 生成 GeoStyler JSON → 生成 SLD XML，验证 Filter 语义保留。
- **边界测试**：
  - 空 Filter（`null`）
  - 单一比较节点
  - 深层嵌套 AND/OR/NOT
  - 不支持的 GeoStyler 函数表达式

---

## 9. 任务清单

- [DFI-001] 定义 `FilterNode` TypeScript 类型与工厂函数。
- [DFI-002] 实现 `FilterTransformer.toGeoStyler()`。
- [DFI-003] 实现 `FilterTransformer.fromGeoStyler()`。
- [DFI-004] 实现 `CqlWriter.write()`。
- [DFI-005] 实现 `FilterTree` 递归组件。
- [DFI-006] 实现 `FilterNodeEditor`。
- [DFI-007] 实现 `FilterToolbar`。
- [DFI-008] 实现 `FilterEditor` 并集成到 Rule 属性面板。
- [DFI-009] 编写单元测试与集成测试。

---

## 10. 风险与依赖

- **CQL 与 GeoStyler 语义差异**：如 `*=` 在不同 parser 中对通配符的处理可能不同，需用 fixtures 回归测试。
- **复杂函数表达式**：MVP 不支持的 GeoStyler 函数导入后可能丢失，需在导入时给出 warning。
- **属性字段补全缺失**：用户需手动输入属性名，易出错；后续应接入 Sample 数据 schema。
- **与 Core 耦合**：Filter 节点树存储在 Rule 节点中，Core 的 `SLDTree` 类型需引用 `FilterNode`。

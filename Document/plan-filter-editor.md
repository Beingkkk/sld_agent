# plan-filter-editor — Filter 可视化构造器与 CQL 预览

> 文档定位：SDD 模块设计，编码唯一依据。  
> 关联需求：FR-09, FR-13。  
> 关联设计：[Document/design/filter-editor.md](../design/filter-editor.md)。

---

## 1. 模块目标

提供 Rule 过滤条件的可视化构造能力：使用 `FilterNode` 树作为 UI 模型，GeoStyler Filter 数组作为后端/存储模型，并提供只读 CQL 预览。

---

## 2. 职责边界

| 组件 | 职责 |
|---|---|
| `filterAdapter` | GeoStyler Filter ↔ FilterNode 双向转换 |
| `cqlAdapter` | GeoStyler Filter → CQL 字符串 |
| `FilterEditor`（Vue） | 容器组件，协调树与预览 |
| `FilterTree`（Vue） | 递归渲染 FilterNode 树 |
| `ComparisonEditor` | 比较节点编辑器 |
| `LogicalEditor` | AND/OR 节点编辑器 |
| `NotEditor` | NOT 节点编辑器 |
| `CqlPreview` | 只读 CQL 展示 |

---

## 3. 目录结构

```
SourceCode/shared/
└── filter/
    ├── types.ts
    ├── filterAdapter.ts
    └── cqlAdapter.ts

SourceCode/frontend/src/components/filter/
├── FilterEditor.vue
├── FilterTree.vue
├── ComparisonEditor.vue
├── LogicalEditor.vue
├── NotEditor.vue
└── CqlPreview.vue
```

---

## 4. 接口定义

### 4.1 共享类型

```typescript
export type ComparisonOperator =
  | '==' | '!=' | '<' | '<=' | '>' | '>='
  | 'like' | 'ilike' | 'between' | 'in';

export interface ComparisonNode {
  id: string;
  type: 'comparison';
  operator: ComparisonOperator;
  property: string;
  value: string | number | boolean | string[] | number[];
}

export interface LogicalNode {
  id: string;
  type: 'logical';
  operator: 'and' | 'or';
  children: FilterNode[];
}

export interface NotNode {
  id: string;
  type: 'not';
  child: FilterNode;
}

export type FilterNode = ComparisonNode | LogicalNode | NotNode;
```

### 4.2 Adapter 对外接口

```typescript
export function toFilterNode(filter: Filter): FilterNode;
export function toGeoStylerFilter(node: FilterNode): Filter;
export function toCql(filter: Filter): string;
export function validateComparison(node: ComparisonNode, schema?: DataSchema): string | null;
```

### 4.3 Vue 组件 props

```typescript
// FilterEditor.vue
interface Props {
  filter: Filter;
  dataSchema?: DataSchema;
}

const emit = defineEmits<{
  (e: 'update:filter', value: Filter): void;
}>();
```

---

## 5. 数据流

```
后端 Rule.filter (GeoStyler Filter 数组)
        ↓
toFilterNode()
        ↓
FilterNode 树（UI 状态）
        ↓
用户编辑
        ↓
toGeoStylerFilter()
        ↓
随 apply_patch 提交到后端
        ↓
toCql() 实时预览
```

---

## 6. 关键规则

### 6.1 操作符支持

- P1：`==`, `!=`, `<`, `<=`, `>`, `>=`, `between`, `in`, `like`。
- P2：`ilike`, `isNull`, `isNotNull`。

### 6.2 CQL 字符串转义

- 字符串值用单引号包裹，内部单引号转义为两个单引号。
- 布尔值输出 `true`/`false`。

### 6.3 字段类型校验

- 数值比较操作符仅适用于 `number`/`integer`/`date`。
- `like` 仅适用于 `string`。

### 6.4 默认节点

- 新建 Filter 时默认创建 `['==', '', '']`。

---

## 7. 任务清单（TDD）

- [x] RED: 编写 `filterAdapter` GeoStyler → FilterNode 测试
- [x] GREEN: 实现 `toFilterNode`
- [x] RED: 编写 `filterAdapter` FilterNode → GeoStyler 测试
- [x] GREEN: 实现 `toGeoStylerFilter`
- [x] RED: 编写 `cqlAdapter` 各操作符测试
- [x] GREEN: 实现 `toCql`
- [x] RED: 编写字段类型校验测试
- [x] GREEN: 实现 `validateComparison`
- [ ] RED: 编写 `FilterEditor` 集成测试（Vue Test Utils）
- [x] GREEN: 实现 `FilterEditor.vue`（基础版本）
- [ ] REFACTOR: 提取可复用的 Filter 操作逻辑（后续继续）

---

## 8. 版本历史

| 版本 | 日期 | 说明 |
|---|---|---|
| 1.0.0 | 2026-06-15 | 初始 plan |

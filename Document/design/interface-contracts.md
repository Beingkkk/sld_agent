# 接口契约（自动生成 / 初始化）

> 生成来源：`Document/plan-*.md` 的「接口定义」章节  
> 生成命令：`/sdd-contract`  
> 版本：v1.0.0

---

## 1. 数据流：Frontend → Backend（WebSocket）

| 消息类型 | 方向 | 字段 | 类型 | 可空 | 来源 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `explain_rule` | 前端 → 后端 | `treeSnapshot` | `TreeStateSnapshot` | 否 | plan-frontend §4.2 |
|  |  | `path` | `number[]` | 否 | plan-frontend §4.2 |
| `rule_explanation` | 后端 → 前端 | `text` | `string` | 否 | plan-backend §3.1 |
|  |  | `warnings` | `string[]` | 是 | plan-backend §3.1 |
| `explain_property` | 前端 → 后端 | `nodeType` | `NodeType` | 否 | plan-frontend §4.2 |
|  |  | `fieldName` | `string` | 否 | plan-frontend §4.2 |
|  |  | `value` | `unknown` | 是 | plan-frontend §4.2 |
| `property_explanation` | 后端 → 前端 | `text` | `string` | 否 | plan-backend §3.1 |
| `generate_rules` | 前端 → 后端 | `dataSchema` | `GeoStylerData` | 否 | plan-backend §3.1 |
|  |  | `attribute` | `string` | 否 | plan-backend §3.1 |
|  |  | `method` | `enum` | 否 | plan-backend §3.1 |
|  |  | `classes` | `number` | 否 | plan-backend §3.1 |
|  |  | `colorRamp` | `string[]` | 否 | plan-backend §3.1 |
| `generated_rules` | 后端 → 前端 | `rules` | `GeoStylerRule[]` | 否 | plan-backend §3.1 |

## 2. 数据流：Frontend → Electron Main（IPC）

| 通道 | 方向 | 字段 | 类型 | 可空 | 来源 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `dialog:openSld` | 渲染 → 主进程 → 渲染 | `filePath` | `string` | 否 | plan-frontend §4.3 |
|  |  | `content` | `string` | 否 | plan-frontend §4.3 |
| `dialog:saveSld` | 渲染 → 主进程 | `filePath` | `string` | 否 | plan-frontend §4.3 |
|  |  | `content` | `string` | 否 | plan-frontend §4.3 |

## 3. 跨模块共享类型

| 类型 | 定义位置 | 消费模块 | 说明 |
| :--- | :--- | :--- | :--- |
| `SLDTree` | plan-core §2.1 | frontend, backend | 不可变树。 |
| `TreePath` | plan-core §2.2 | frontend, backend | 节点路径。 |
| `GeoStylerTransformer` | plan-core §2.3 | frontend, backend | 双向转换器。 |
| `ValidationEngine` | plan-core §2.4 | frontend, backend | 校验引擎。 |
| `TransformResult` | plan-core §3.3 | frontend | 转换结果。 |
| `ValidationIssue` | plan-core §2.4 | frontend | 校验问题。 |

## 4. 已知不一致 / 待确认

| 字段 | 前端 | 后端 | 状态 |
| :--- | :--- | :--- | :--- |
| `treeSnapshot` | 完整快照 | 仅用于重建 `SLDTree` | ✅ 一致 |
| `path` | `number[]` | `number[]` | ✅ 一致 |

## 5. 变更记录

- 2026-06-16：初始化，来源 plan-core / plan-frontend / plan-backend v1.0.0。

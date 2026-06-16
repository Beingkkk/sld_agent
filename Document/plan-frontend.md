# Plan: Frontend（Vue 3 用户界面与预览）

> 版本：v1.0.0  
> 状态：锁定  
> 依赖：spec v1.0.0、constitution v1.0.0、plan-core v1.0.0  
> 对应需求：M-01、M-02、M-03、M-05、M-06、S-01、S-02

---

## 1. 目标与边界

Frontend 模块负责三栏桌面界面：左侧 SLD 树、中间属性编辑 + 地图预览、右侧代码 + 校验。所有业务状态来自 Core 的 `TreeStateSnapshot`，前端本身不持有样式真相。

本模块以 workspace package 形式存在于 `SourceCode/frontend/`，通过 workspace 协议依赖 `SourceCode/core/`。

**UX 对齐要求**：前端实现必须严格对齐 [`Document/UX/design.md`](Document/UX/design.md) 与 [`Document/UX/prototype.html`](Document/UX/prototype.html)，包括色彩系统、字体、三栏比例、组件状态、交互反馈与暗色主题。

**边界内**：
- 三栏布局与响应式折叠。
- SLD 树组件（渲染、选中、展开、右键菜单、拖拽排序）。
- 动态属性表单（UserStyle / FeatureTypeStyle / Rule / Symbolizer）。
- 代码展示（GeoStyler JSON / SLD XML / 校验结果）。
- OpenLayers 实时预览。
- 导入/导出 SLD 文件对话框（通过 Electron IPC 调用原生对话框）。
- 与后端的 **WebSocket** 通信。

**边界外**：
- LLM 语义解析与 Agent 逻辑（plan-backend）。
- SLD XML 的底层解析与生成（plan-core）。
- 文件系统持久化实现细节（Electron main 进程）。

## 2. 核心组件设计

### 2.1 `AppLayout`（三栏布局）

```vue
<!-- 伪代码 -->
<AppLayout>
  <template #tree><SLDTreePanel /></template>
  <template #editor><EditorPanel /></template>
  <template #code><CodePanel /></template>
</AppLayout>
```

### 2.2 `SLDTreePanel`

- 渲染 `SLDTreeNode` 递归列表。
- 节点标题**仅显示简化 XML 标签名**（如 `NamedLayer`、`UserStyle`、`PointSymbolizer`），不额外显示 GeoStyler kind 或中文语义。
- 不同节点类型通过图标和颜色区分（见 [`Document/UX/design.md`](Document/UX/design.md) §4.2）。
- 维护 `selectedPath`、`expandedPaths`。
- 右键菜单：`Add Rule`、`Add Symbolizer`、`Delete`。
- 拖拽：仅允许同层级（FeatureTypeStyle 之间 / Rule 之间 / Symbolizer 之间）排序。
- 受 Core 约束，NamedLayer 与 UserStyle 节点不允许新增第二个。

Symbolizer 节点显示的 XML 标签与 GeoStyler kind 的对应关系：

| GeoStyler kind | 树上显示的 XML 标签 |
| :--- | :--- |
| `Mark` | `PointSymbolizer` |
| `Line` | `LineSymbolizer` |
| `Fill` | `PolygonSymbolizer` |
| `Text` | `TextSymbolizer` |

### 2.3 `EditorPanel`

- 上半部分：`PropertyForm`（根据 `selectedPath` 的节点类型动态渲染）。
- 下半部分：`MapPreview`（OpenLayers 地图）。
- 可选悬浮 `LLMPropertyChat` 卡片：触发源为属性面板内当前选中的字段，用于解释该字段含义与用法。

### 2.4 `PropertyForm`（JSON 驱动 + 分组）

`PropertyForm` 不再按节点类型硬编码子组件，而是根据运行时加载的 registry 动态生成，并支持按语义分组折叠。

渲染流程：

```text
selectedPath
  → 判断节点类型（UserStyle / FeatureTypeStyle / Rule / Symbolizer）
  → 从 node-schemas.json 或 symbolizer-schemas.json 获取字段列表与分组定义
  → 遍历字段 ID，从 field-registry.json 读取字段元数据（含 `group`）
  → 按 group 聚合字段，渲染可折叠的分组面板
  → 从 editor-types.json 获取对应编辑器组件
  → 渲染通用编辑器并绑定到 Store
```

核心组件：

| 组件 | 职责 |
| :--- | :--- |
| `PropertyForm` | 根据节点类型获取 schema；`symbolizer-schemas.json` 按 `groups` 渲染折叠分组，`node-schemas.json` 按 `fields` 渲染默认分组。 |
| `FormFieldRenderer` | 根据字段 `editor` 类型分发到具体编辑器组件。 |
| `PropertyGroup` | 可折叠分组容器，聚合 symbolizer schema 中定义的字段。 |
| `StringEditor` / `NumberEditor` / `ColorEditor` / `EnumEditor` / `BooleanEditor` / `TextareaEditor` / `OpacityEditor` / `ScaleRangeEditor` / `Point2DEditor` / `NumberArrayEditor` / `FontEditor` / `FilterEditor` / `LineStyleEditor` / `PropertyNameEditor` | 通用编辑器控件，由 `editor-types.json` 定义。 |

字段值写回 Store 时，按 `field.valuePath` 写入树节点字段；树 → GeoStyler 的转换由 Core `SymbolizerTransformer` 负责，前端不直接处理 GeoStyler 字段映射。

### 2.4.1 字段配置来源

前端在应用启动时加载以下外置 JSON：

- `SourceCode/data/registry/editor-types.json`
- `SourceCode/data/registry/field-registry.json`
- `SourceCode/data/registry/node-schemas.json`
- `SourceCode/data/registry/symbolizer-schemas.json`

### 2.4.2 Rule 面板中的 Filter 与 CQL

- Rule 的 Filter 通过 `filter-tree` editor（`FilterEditor`）进行可视化编辑。
- Rule 面板中同时展示当前 Filter 的 **CQL 文本预览**，该文本框**只读**，用于帮助用户理解可视化条件对应的 CQL 表达式。
- 若用户需要修改 Filter，必须回到可视化构造器；CQL 预览不直接接受输入。

```typescript
interface MapPreviewProps {
  geoStylerStyle: GeoStylerStyle;
  previewGeometryType: 'Mark' | 'Line' | 'Fill' | 'Text';
}
```

- 使用单个 OpenLayers `VectorLayer` + `VectorSource`。
- 预览数据来自 `SourceCode/data/sample/` 下的内置 **GeoJSON**（由 shapefile 预转换），MVP 阶段直接读取本地文件，不上传。
- `previewGeometryType` 默认由当前选中节点推导：
  - 选中 Symbolizer → 使用其 `kind`。
  - 选中 Rule → 回退到该 Rule 下第一个 Symbolizer 的 `kind`；无 Symbolizer 时默认 `Fill`。
  - 选中 FeatureTypeStyle / UserStyle / NamedLayer / 根节点 → 使用用户最近一次手动选择；从未手动选择时默认 `Fill`。
- **保留手动切换按钮**（点 / 线 / 面 / 文本），便于用户临时查看其他几何类型的效果。
- Text Symbolizer 预览使用内置点 Sample 数据；若数据中存在 `name` 字段则用作 label，否则仅显示占位提示（不渲染文本）。
- Raster Symbolizer 预览不在 MVP 范围内（见 §6 决策）。
- 使用 `geostyler-openlayers-parser` 将 GeoStyler Style 转为 OpenLayers Style；不匹配当前几何类型的 Rule 会被 parser 自然忽略。

### 2.6 `CodePanel`

- 标签页：`GeoStyler JSON`、`SLD XML`、`Validation`。
- 代码只读，使用等宽字体与语法高亮（可引入 `prismjs` 或 `highlight.js`）。
- 校验面板展示 `ValidationIssue[]`。

## 3. 状态管理（Pinia）

```typescript
interface FrontendState {
  tree: SLDTree;
  selectedPath: TreePath | null;
  expandedPaths: Set<string>;
  transformResult: TransformResult | null;
  issues: ValidationIssue[];
  backendStatus: 'idle' | 'connecting' | 'connected' | 'error';
}
```

Actions：
- `selectNode(path)`
- `toggleExpanded(path)`
- `addNode(parentPath, type, kind)`
- `removeNode(path)`
- `updateNode(path, patch)`
- `moveNode(sourcePath, targetPath)`
- `importSLD(xml)` → 调用 Core `SLDTree.fromSLDXML`
- `exportSLD()` → 调用 Core `tree.toSLDXML`

## 4. 接口定义

### 4.1 与 Core 的接口

Frontend 直接导入 Core 包中的类：
- `SLDTree`
- `TreePath`
- `GeoStylerTransformer`
- `ValidationEngine`
- `TransformResult`
- `ValidationIssue`

### 4.2 与后端的 WebSocket 消息

| 方向 | 消息类型 | 载荷 | 说明 |
| :--- | :--- | :--- | :--- |
| 前端 → 后端 | `explain_rule` | `{ treeSnapshot, path }` | 请求解释当前 Rule。 |
| 后端 → 前端 | `rule_explanation` | `{ text, warnings? }` | 返回自然语言解释与可选预警。 |
| 前端 → 后端 | `explain_property` | `{ nodeType, fieldName, value }` | 请求属性字段解释。 |
| 后端 → 前端 | `property_explanation` | `{ text }` | 返回属性说明。 |

### 4.3 与 Electron Main 的 IPC

| 通道 | 方向 | 载荷 | 说明 |
| :--- | :--- | :--- | :--- |
| `dialog:openSld` | 渲染 → 主进程 → 渲染 | `{ filePath, content }` | 打开 SLD 文件。 |
| `dialog:saveSld` | 渲染 → 主进程 | `{ filePath, content }` | 保存 SLD 文件。 |

## 5. 数据流

用户点击树节点
  → `store.selectNode(path)`
  → `PropertyForm` 根据节点类型渲染
  → 同步根据选中节点推导 `previewGeometryType`（Symbolizer.kind 或回退到第一个 Symbolizer）
  → 用户修改字段
  → `store.updateNode(path, patch)`
  → Core `SLDTree.updateNode()` 返回新树
  → `GeoStylerTransformer` + `geostyler-sld-parser` 生成 GeoStyler JSON / SLD XML
  → `ValidationEngine.validate()` 更新 issues
  → `MapPreview` 接收 GeoStyler Style 与 `previewGeometryType`，刷新 OpenLayers
  → `CodePanel` 刷新代码与校验列表

## 6. 关键决策

| 决策 | 方案 | 原因 |
| :--- | :--- | :--- |
| 状态管理 | Pinia | Vue 3 官方推荐，DevTools 支持好。 |
| 拖拽库 | `@vueuse/gesture` 或原生 HTML5 Drag & Drop | 原生足够，避免引入过重库。 |
| 代码高亮 | `highlight.js` | 轻量，支持 JSON/XML。 |
| OpenLayers 包装 | 直接封装 `MapPreview` 组件 | 控制力强，便于与 geostyler-openlayers-parser 集成。 |
| 预览数据切换 | 自动推导 + **保留手动切换按钮**（点/线/面/文本）；手动选择会覆盖自动推导，并在选中更高级节点时保留 | 兼顾自动化与临时查看需求。 |
| 预览数据来源 | 读取 `SourceCode/data/sample/` 内置 **GeoJSON**（shapefile 预转换） | 离线优先，OpenLayers 原生支持 GeoJSON。 |
| 主题方案 | MVP 仅暗色主题，不实现亮/暗切换 | 降低实现成本，符合 UX 原型。 |
| 字体加载 | 本地 TTF 文件，离线优先 | 符合宪法 CP-3；避免外部 CDN 依赖。 |
| 树节点标签 | 显示简化 XML 标签名（如 `NamedLayer`、`PointSymbolizer`），不显示 `sld:` 前缀、kind 或中文语义 | 满足专业用户对 SLD 层级的直观认知；图标/颜色区分类型；与 UX 原型一致。 |
| NamedLayer / UserStyle 数量 | MVP 仅允许各一个 | 降低多容器管理的 UI 与状态复杂度。 |
| AI 面板 | 右侧面板底部独立卡片，琥珀色左边框，可折叠；**AI 不直接修改树** | 与 UX 原型一致；符合宪法 CP-4。 |
| LLM 属性问答 | 可选悬浮卡片，解释属性面板内当前字段 | 与 UX 设计对齐，不挤占固定布局。 |
| Text Symbolizer 预览 | 纳入 MVP；若 sample 数据有 `name` 字段则渲染 label，否则仅显示占位提示 | 常见组合（点 + 标注）需要预览支持。 |
| Raster Symbolizer 预览 | 放到 Phase 2 | 需要栅格渲染与专用 Sample 数据，超出 MVP 范围。 |
| 项目结构 | monorepo workspace，`frontend` 依赖 `core` package | 共享数据模型与转换逻辑，统一 parser 版本。 |
| UX 对齐 | 严格对齐 [`Document/UX/design.md`](Document/UX/design.md) 与 [`Document/UX/prototype.html`](Document/UX/prototype.html) | 保证实现与原型一致，避免实现偏离设计。 |
| 前后端通信 | 开发与生产均使用 **WebSocket**；IPC 仅用于 Electron 原生能力（窗口/文件对话框） | 协议一致，减少双路径；IPC 保留给必须原生的能力。 |
| 属性面板 | **JSON 驱动 + 分组折叠**：从 `SourceCode/data/registry/*.json` 加载字段、分组、编辑器类型，动态渲染 | 新增字段或 Symbolizer 类型无需改 Vue 代码；同一份 registry 服务 LLM。 |

## 6.1 错误处理与降级策略

| 场景 | 行为 |
| :--- | :--- |
| WebSocket 断开 | 状态栏显示“后端未连接”与重连按钮；前端仍可离线编辑树，重连后无需恢复。 |
| LLM 调用失败 | AI 面板显示“解释服务暂不可用”，不阻塞核心编辑。 |
| `geostyler-sld-parser` 解析失败 | 校验面板报 error；导入操作失败并显示可读的解析错误。 |
| Sample 数据缺失或字段不存在 | 预览区显示占位提示，不抛异常；Text label 缺失时不渲染文本。 |
| 拖拽到非法位置 | 视觉拒绝（无放置指示线），不更新 Store。 |

## 7. 测试策略

- **单元测试**：Pinia store actions、表单字段映射、TreePath 工具。
- **组件测试**：使用 Vue Test Utils 测试 `PropertyForm` 根据节点类型切换。
- **集成测试**：导入 example-sld.xml → 树渲染 → 修改字段 → 代码区更新。

## 8. 任务清单

- [DF-001] 初始化 Vue 3 + TypeScript + Tailwind 项目骨架。
- [DF-002] 配置 Pinia store 与 Core 模块依赖。
- [DF-003] 实现三栏布局 `AppLayout`，严格对齐 UX 原型（色彩、字体、比例、间距）。
- [DF-004] 实现 `SLDTreePanel` 与递归节点渲染。
- [DF-005] 实现右键菜单与节点增删。
- [DF-006] 实现同层级拖拽排序。
- [DF-007] 加载 `SourceCode/data/registry/*.json` 作为静态资源。
- [DF-008] 实现通用编辑器组件：String / Number / Color / Enum / Boolean / Textarea / Opacity / ScaleRange / Point2D / NumberArray / Font / Filter / **LineStyle / PropertyName**。
- [DF-009] 实现 JSON 驱动的 `PropertyForm`、`FormFieldRenderer` 与 `PropertyGroup` 分组折叠。
- [DF-010] 实现 `MapPreview`：自动推导 + 手动切换 Sample 数据；Text 预览使用 `name` 字段。
- [DF-011] 实现 `CodePanel`（JSON/XML/校验标签页）。
- [DF-012] 实现导入/导出 IPC 调用。
- [DF-013] 接入后端 WebSocket 消息（explain_rule / explain_property）。
- [DF-014] 编写组件与集成测试。

## 9. 风险与依赖

- **OpenLayers 打包体积**：按需引入 `ol` 子模块，避免全量导入。
- **Core 模块稳定性**：Frontend 高度依赖 Core 类型与转换逻辑，需等 Core 单元测试通过后再深度集成。
- **拖拽体验**：原生 HTML5 DnD 在 Electron 中可能行为不一致，需单独测试。
- **Filter 可视化构造器**：属于 Should Have，若时间不足可降级为 CQL 文本输入。

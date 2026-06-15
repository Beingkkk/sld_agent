# SLDAgent 需求规格说明书

> 文档定位：SDD 需求真相源（Source of Truth）。所有模块设计与代码实现必须能追溯到本文档的某一条需求。  
> 上游输入：[`Document/design/requirements.md`](design/requirements.md)（已评审并冻结为本文档）。  
> 下游产物：所有 `Document/plan-{module}.md`。

---

## 1. 文档元数据

| 项 | 内容 |
|---|---|
| 文档名称 | SLDAgent 需求规格说明书 |
| 版本 | 1.0.0-MVP |
| 状态 | FROZEN（SDD 锁定后禁止直接修改，变更需走 `Document/changes/proposal-*.md`） |
| 编写日期 | 2026-06-15 |
| 目标读者 | 开发者、测试、产品经理 |

---

## 2. 项目背景与目标

### 2.1 核心问题

GIS 样式（Symbology）通常需要专业人员手动编写 SLD/XML，或使用 QGIS、GeoServer 等工具导出。非专业用户无法将“蓝色渐变虚线”、“按人口密度分级显示”这类自然语言需求直接落地为可机读、可验证的 SLD 文件。

### 2.2 产品目标

构建一个**桌面智能 Agent**，将自然语言需求转换为符合 OGC SLD 1.0.0 标准的 XML 文件，并提供可视化参数精修、实时预览与多轮对话修正能力。

### 2.3 核心价值

- **降低门槛**：用户无需理解 SLD 规范。
- **可复现**：LLM 输出受 JSON Schema 约束，结果稳定。
- **可扩展**：新增样式类型只需扩展 Schema 与 Builder 映射。
- **可审计**：需求、参数、SLD 三者通过结构化参数形成可追溯链路。

---

## 3. 用户画像

| 角色 | 典型诉求 | 痛点 |
|---|---|---|
| 数据分析师 | 快速为图层设置美观样式 | 不熟悉 SLD/XML 语法 |
| WebGIS 开发者 | 需要与 GeoServer/MapServer 兼容的样式文件 | 手写 SLD 繁琐、易错 |
| 业务人员 | 用业务语言描述样式 | 无法与 GIS 工具直接对话 |
| 地图设计师 | 需要精细控制符号、颜色、分级、过滤规则 | 现有工具交互繁琐，迭代慢 |

---

## 4. 功能需求

### 4.1 Must Have（P0）

| ID | 需求 | 验收标准 | 关联模块 |
|---|---|---|---|
| FR-01 | 自然语言输入 | 支持中文/英文描述，如“蓝色渐变虚线”、“按人口密度分级显示” | backend, frontend |
| FR-02 | 结构化参数输出 | LLM 输出必须符合 `StyleParams` JSON Schema | backend |
| FR-03 | SLD 文件生成 | 后端调用 `geostyler-sld-parser` 写出标准 SLD 1.0.0 XML | backend |
| FR-04 | 常见几何类型支持 | 至少支持 Point、LineString、Polygon | backend |
| FR-05 | 常见样式类型支持 | 支持 Simple、Categorized、Classified、Text | backend, frontend |
| FR-06 | 输出文件保存 | 将 SLD XML 写入用户指定路径并返回路径 | frontend, electron |
| FR-07 | 资源浏览 | 浏览本地文件系统，选择 GeoJSON/SLD/XML | frontend, electron |
| FR-08 | SLD 导入 | 读取外部 SLD，解析为可编辑 GeoStyler Style | backend, frontend |
| FR-09 | 规则管理 | 对 Style Rule 增删改查、排序、启用/禁用 | frontend |
| FR-10 | 实时预览 | 将当前 GeoStyler Style 渲染到地图画布 | frontend |
| FR-11 | 验证状态展示 | 展示 JSON Schema/XSD/Roundtrip 校验结果 | backend, frontend |
| FR-12 | 多轮对话修正 | 用户追加指令，Agent 基于当前状态增量修改 | backend |

### 4.2 Should Have（P1）

| ID | 需求 | 验收标准 | 关联模块 |
|---|---|---|---|
| FR-13 | 属性驱动样式 | 根据数据 schema 字段生成分类/分级样式 | backend |
| FR-14 | 颜色方案推荐 | LLM 按场景推荐配色（高对比、色盲友好等） | backend |
| FR-15 | 图例生成 | 基于当前 SLD 生成图例图片或矢量图例 | frontend |
| FR-16 | 设置面板 | 模型选择、知识库域切换、XSD 路径、GeoServer 连接 | frontend |
| FR-17 | 最近文件 | 记录最近打开/生成的 SLD 与数据源 | frontend, electron |
| FR-18 | 撤销/重做 | 对关键操作提供撤销/重做能力 | frontend |

### 4.3 Could Have（P2）

| ID | 需求 | 说明 |
|---|---|---|
| FR-19 | QML/QGS 导入 | 支持导入 QGIS 样式作为初始样式 |
| FR-20 | 批量导出 | 一次性导出多个图层或多种格式 |
| FR-21 | 协作共享 | 保存样式到共享目录或版本控制 |

---

## 5. 关键场景

### 5.1 自然语言生成样式

1. 用户在左侧 Assistant 输入框输入指令。
2. 后端 `AgentSession` 加载当前领域知识库并调用 LLM。
3. LLM 输出 `StyleParams` JSON。
4. `ParamsNormalizer` 归一化别名，`StyleBuilder` 构建 GeoStyler Style。
5. `SldService` 写出 SLD XML 并执行 XSD + Roundtrip 校验。
6. 后端通过 `generation_result` 推送权威状态；前端更新 Map Preview、Inspector、Rules 面板。

### 5.2 参数化精修

1. 用户在 Inspector / Rules 面板修改参数。
2. 前端本地乐观更新，用户点击“应用”。
3. 前端批量发送 `apply_patch`（JSON Patch 子集）。
4. 后端原子性应用 patch，重新写出 SLD 并校验。
5. 成功后前端提交乐观更新；失败后撤销。

### 5.3 SLD 导入

1. 用户选择本地 `.sld` 文件。
2. 前端读取文件并调用 `geostyler-sld-parser` 解析为 GeoStyler Style。
3. 前端通过 `import_style` 将 Style 提交后端再次校验。
4. 成功后进入编辑状态，显示在 Inspector / Rules / Preview 中。

### 5.4 SLD 导出

1. 用户点击“导出 SLD”。
2. 后端通过 `export` 生成 SLD XML 并返回校验报告。
3. 前端弹出保存对话框，落盘到用户选择路径。

---

## 6. 非功能需求

| ID | 需求 | 指标 |
|---|---|---|
| NFR-01 | Schema 校验严格 | LLM 输出必须通过 JSON Schema，否则返回错误 |
| NFR-02 | 可测试性 | 每种样式类型至少有一个端到端测试 |
| NFR-03 | 可解释性 | Agent 返回 `explanation` 说明生成原因 |
| NFR-04 | 依赖可控 | 优先使用 Node/TypeScript 生态库 |
| NFR-05 | 可离线运行 | StyleBuilder 与 parser 生成阶段不依赖网络；LLM 可配置本地或云端 |
| NFR-06 | 响应性能 | LLM 首轮响应 ≤ 10s（云端） |
| NFR-07 | 界面响应 | 参数修改后预览更新延迟 ≤ 300ms |
| NFR-08 | 可访问性 | 关键操作支持键盘导航；颜色对比度符合 WCAG AA |

---

## 7. 关键约束

### 7.1 技术约束

- SLD 版本锁定为 **1.0.0**。
- 后端使用 Node.js/TypeScript；前端使用 Vue 3 + Electron。
- SLD 解析/生成统一使用 `geostyler-sld-parser`。
- 知识库以 JSON 文件前置加载，不支持运行时热加载。
- 前后端通信使用 WebSocket；Electron 主进程仅管理后端生命周期。

### 7.2 业务约束

- 每次只激活一个业务领域（`default` + 一个可选专业领域）。
- 不维护参数变更历史快照。
- 不使用 RAG，知识以预结构化 JSON 注入 LLM 上下文。
- SLD XML 对用户只读，不开放直接编辑。

### 7.3 UI/UX 约束

- 深色科技感桌面应用，布局固定：左侧 Assistant、中间 Map Preview、右侧 Inspector、顶部 Toolbar、底部 StatusBar。
- 不引入 GeoStyler React UI，Vue 3 自行实现界面。

---

## 8. 验收标准总则

1. 所有 P0 功能需求必须通过单元/集成/端到端测试。
2. 生成的 SLD XML 必须通过 OGC SLD 1.0.0 XSD 校验（开发期系统 `xmllint`，生产期 `xmllint-wasm`）。
3. 生成的 SLD XML 必须能通过 `geostyler-sld-parser` roundtrip（可再编辑）。
4. 任一生成/修改阶段失败必须回退到 `lastValidStyle`，不得产生无效状态。
5. 多轮修改必须保留用户未要求变更的字段（覆盖率 100%）。

---

## 9. 术语表

| 术语 | 说明 |
|---|---|
| SLD | Styled Layer Descriptor，OGC 样式描述规范 |
| GeoStyler Style | `geostyler-style` 定义的 JSON 格式样式中间表示 |
| StyleParams | 本项目定义的、LLM 输出与前端参数面板共同使用的结构化参数 |
| Rule | SLD/GeoStyler 中的样式规则，包含 Filter、ScaleDenominator、Symbolizer |
| Symbolizer | 描述具体几何渲染方式的元素（Mark/Line/Fill/Text/Raster） |
| Filter | 用于条件渲染的过滤表达式 |
| CQL | Common Query Language，Filter 的类 SQL 文本表示 |

---

## 10. 版本历史

| 版本 | 日期 | 说明 | 变更提案 |
|---|---|---|---|
| 1.0.0-MVP | 2026-06-15 | 初始版本，冻结 MVP 范围 | - |

---

*本文档由 `Document/design/requirements.md` 收敛而来，是 SLDAgent SDD 工作的需求真相源。*

# LLM + SLD 智能 Agent — 需求输入

> 文档定位：SDD 需求真相源，存放于 `Document/design/` 作为后续 `spec.md` 与 `plan-{module}.md` 的输入。  
> 对应技术实现细节索引见：[technical-details-index.md](technical-details-index.md)  
> 对应交互原型见：[Document/UX/index.html](../UX/index.html)

---

## 1. 项目背景与核心目标

在 GIS 可视化工作流中，样式（Symbology）通常需要专业人员手动编写 SLD 或借助 QGIS、GeoServer 等工具导出。对于非专业用户，"蓝色渐变虚线"、"按人口分级设色"这类自然语言需求无法直接落地为可机读的 SLD。

本项目拟构建一个**智能 Agent**，通过三层解耦实现"自然语言 → 结构化参数 → SLD 文件"的端到端转换：

```
自然语言需求
      ↓
[LLM 语义解析]
      ↓
结构化参数（受 JSON Schema 约束）
      ↓
[StyleBuilder 映射为 GeoStyler Style]
      ↓
[Node.js/TypeScript 后端调用 geostyler-sld-parser]
      ↓
SLD 1.0.0 XML 文件
```

### 1.1 核心价值

- **降低门槛**：用户无需理解 SLD 规范即可生成标准样式。
- **可复现**：LLM 输出被 Schema 严格约束，结果稳定、可验证。
- **可扩展**：新增样式类型只需扩展 Schema 与 StyleBuilder 映射，无需重写 LLM 提示工程。
- **可审计**：需求、参数、SLD 三者通过结构化参数形成可追溯链路。

---

## 2. 需求分析

### 2.1 用户画像

| 角色 | 典型诉求 | 痛点 |
|---|---|---|
| 数据分析师 | 快速为图层设置美观样式 | 不熟悉 SLD/XML 语法 |
| WebGIS 开发者 | 需要与 GeoServer/MapServer 兼容的样式文件 | 手写 SLD 繁琐、易错 |
| 业务人员 | 用业务语言描述样式（如"高风险区域标红"） | 无法与 GIS 工具直接对话 |
| 地图设计师 | 需要精细控制符号、颜色、分级、过滤规则 | 现有工具交互繁琐，迭代慢 |

### 2.2 功能需求（Must Have）

| 编号 | 需求 | 说明 | 原型对应 |
|---|---|---|---|
| FR-01 | 自然语言输入 | 支持中文/英文描述，例如"蓝色渐变虚线"、"按人口密度分级显示" | 左侧 Assistant 输入框 |
| FR-02 | 结构化参数输出 | LLM 必须输出符合 JSON Schema 的参数对象 | Inspector / GeoStyler JSON 标签 |
| FR-03 | SLD 文件生成 | Node.js/TypeScript 后端直接调用 `geostyler-sld-parser`，将 GeoStyler Style 写出为标准 SLD 1.0.0 XML | Inspector / SLD XML 标签 |
| FR-04 | 常见几何类型支持 | 至少支持 Point、LineString、Polygon | 道路/土地利用/POI 示例 |
| FR-05 | 常见样式类型支持 | Simple、Categorized（唯一值）、Classified（分级） | Rules 面板 |
| FR-06 | 输出文件保存 | 将 SLD 写入指定路径并返回路径 | Toolbar「导出 SLD」 |
| FR-07 | 资源浏览 | 浏览本地文件系统，选择待样式化的数据文件或已有 SLD | 见 §2.5 |
| FR-08 | SLD 导入 | 读取外部 SLD 文件，解析为可编辑结构，作为 LLM 修改上下文 | Toolbar「导入 SLD」 |
| FR-09 | 规则管理 | 对 Style 中的 Rule 进行增删改查、排序、启用/禁用 | Rules 面板 |
| FR-10 | 实时预览 | 将当前 SLD 渲染到地图画布，支持平移、缩放、复位 | 中间 Map Preview |
| FR-11 | 验证状态展示 | 显示 XML 语法、XSD、GeoStyler Parser 等校验结果 | Validation Panel + StatusBar |
| FR-12 | 多轮对话修正 | 用户可追加指令，如"把虚线改成点划线"，Agent 基于当前状态增量修改 | 聊天历史 + 输入框 |

### 2.3 功能需求（Should Have）

| 编号 | 需求 | 说明 | 原型对应 |
|---|---|---|---|
| FR-13 | 属性驱动样式 | 支持根据图层字段生成分类/分级样式 | Rule 生成器 |
| FR-14 | 颜色方案推荐 | LLM 可根据场景推荐配色（如高对比、色盲友好） | 快捷提示 / AI 建议 |
| FR-15 | 图例生成 | 基于当前 SLD 生成图例图片或矢量图例 | 预览区扩展 |
| FR-16 | 设置面板 | 模型选择、知识库域切换、XSD 路径、GeoServer 连接配置 | Toolbar「设置」 |
| FR-17 | 最近文件 | 记录最近打开/生成的 SLD 与数据源 | 启动页 / 菜单 |
| FR-18 | 撤销/重做 | 对关键操作提供撤销/重做能力 | 编辑操作栈 |

### 2.4 功能需求（Could Have）

| 编号 | 需求 | 说明 |
|---|---|---|
| FR-19 | QML/QGS 导入 | 支持导入 QGIS 样式作为初始样式 |
| FR-20 | 批量导出 | 一次性导出多个图层或多种格式的样式 |
| FR-21 | 协作共享 | 保存样式到共享目录或版本控制 |

---

## 3. 详细功能场景

### 3.1 资源浏览（FR-07）

**目标**：让用户在 Electron 桌面环境中浏览并选择本地资源。

**支持的资源类型（MVP）**：
- 数据文件：`.geojson`
- 样式文件：`.sld`、`.xml`
- 工作区文件：`.slda`（项目自定义工作区文件，可选）

> 决策：MVP 仅原生支持 GeoJSON 与 SLD。Shapefile、QML、Mapbox Style 等其它格式的导入/导出借助 GeoStyler parser 生态扩展，不作为核心路径。

**浏览行为**：
1. 用户可通过「打开文件」对话框选择单个数据文件或 SLD 文件。
2. 选择 GeoJSON/Shapefile 后，前端解析 schema（字段名、字段类型、示例要素）并回传给后端，供 LLM 理解。
3. 选择 SLD 后，调用 `geostyler-sld-parser` 解析为 GeoStyler Style，进入编辑状态。
4. 浏览界面显示文件基本信息：名称、路径、几何类型、字段数、记录数。

**异常处理**：
- 文件格式不支持 → 提示用户并给出支持格式清单。
- 编码错误 / 解析失败 → 显示具体错误信息，允许重新选择。

### 3.2 SLD 导入（FR-08）

**目标**：将已有 SLD 纳入当前工作区，作为自然语言修改的基础。

**流程**：
1. 用户点击 Toolbar「导入 SLD」。
2. 弹出文件选择器，过滤 `.sld`、`.xml`。
3. 前端读取文件内容，使用 `geostyler-sld-parser` 解析为 GeoStyler Style JSON。
4. 若解析成功：
   - 将 GeoStyler Style 显示在 Inspector 的 JSON/SLD 标签中。
   - 将 Rules 显示在 Rules 面板中。
   - 更新地图预览（通过 `geostyler-openlayers-parser`）。
   - 将 GeoStyler Style JSON 通过 WebSocket 发送给 Node 后端，作为 LLM 多轮修改的上下文。
5. 若解析失败：
   - 在 Validation Panel 中标记失败原因。
   - 提示用户是否仍要作为原始文本导入。

**约束**：
- 导入的 SLD 版本以 1.0.0 为主；对 1.1.0 做兼容尝试，不保证完整。
- 导入不直接覆盖当前未保存的生成结果，除非用户确认。

### 3.3 SLD 导出（FR-06）

**目标**：将当前样式保存为标准 SLD 1.0.0 XML 文件。

**流程**：
1. 用户点击 Toolbar「导出 SLD」。
2. 默认文件名：`{layerName}-{styleName}.sld`。
3. 弹出保存对话框，允许用户选择目录和文件名。
4. 若目标文件已存在，弹出覆盖确认对话框；用户确认后方可继续。
5. 前端将当前 GeoStyler Style JSON 通过 WebSocket 发送给 Node 后端。
6. 后端直接调用 `geostyler-sld-parser.writeStyle()` 生成 SLD XML。
7. 导出前自动执行 XSD 校验（系统 `xmllint`）与 Parser 反向读取校验；若校验失败，提示用户并允许「仅导出 XML」或「取消」。
8. 导出成功后，在 StatusBar 显示"已导出至 {path}"，并在最近文件列表中记录。

**导出选项（Should Have）**：
- 是否包含 XML 声明 `<?xml version="1.0" encoding="UTF-8"?>`
- 是否格式化缩进
- 字符编码（默认 UTF-8）

### 3.4 规则设置（FR-09）

**目标**：提供对 SLD Rule 的精细化管理界面。

**Rule 列表（Rules 面板）**：
- 显示每个 Rule 的名称、激活的 Symbolizer 类型、过滤条件摘要、比例尺范围。
- 支持点击选中、拖拽排序、删除、复制。
- 提供「添加 Rule」按钮，默认复制最后一条 Rule 或创建空白 Rule。

**Rule 编辑器**：
- **基本属性**：Rule 名称、标题、描述。
- **比例尺范围**：MinScaleDenominator / MaxScaleDenominator，支持输入数字或从地图当前比例尺一键填充。
- **过滤器（Filter）**：
  - 提供可视化过滤条件构造器（等于、不等于、大于、小于、包含、介于等）。
  - 支持组合条件（AND / OR / NOT）。
  - 支持直接编辑 CQL/OGC Filter 文本。
- **Symbolizer 参数**（以 GeoStyler Style 字段为准）：
  - 点（Mark）：`wellKnownName`、`size`、`fill`、`stroke`、`strokeWidth`、`rotation`。
  - 线（Line）：`color`、`width`、`opacity`、`lineCap`、`lineJoin`、`dasharray`。
  - 面（Fill）：`color`、`outlineColor`、`outlineWidth`、`graphicFill`。
  - 文本（Text）：`label`（字段或常量）、`font`、`size`、`color`、`halo`、`placement`、`offset`。
  - 栅格（Raster）：`colorMap`、`contrast`、`brightness`（可选扩展）。

**与 LLM 的联动**：
- 用户在 Rule 编辑器中的修改实时同步到 Inspector。
- 用户可在 Assistant 中发送"把 Rule 2 的线宽改成 3px"，Agent 基于当前 Rule 状态做增量修改。

### 3.5 自然语言多轮对话修改（FR-12）

**目标**：让用户像与同事对话一样迭代样式。

**会话模型**：
- 每次用户输入被视为一次 `turn`。
- 系统维护当前样式状态（GeoStyler Style JSON）。
- LLM 收到的是：用户指令 + 当前 GeoStyler Style 摘要 + 可选的原始数据 schema。

**多轮能力示例**：
- T1: "给道路图层一个蓝色虚线样式。"
- T2: "线宽改成 3px，颜色再深一点。"
- T3: "只在大于 1:10000 的比例尺下显示。"
- T4: "给高速公路单独加一个红色粗线规则。"

**约束**：
- 系统不维护历史参数快照（见 §5.2 业务约束），但保留聊天历史文本供用户查看。
- 每轮生成后必须重新执行 XSD 校验（系统 `xmllint`）与 Parser 反向读取校验，校验失败时回退到上一有效状态并提示用户。

### 3.6 实时预览与验证状态展示（FR-10 / FR-11）

**实时预览**：
- 使用 OpenLayers + `geostyler-openlayers-parser` 渲染当前 GeoStyler Style。
- **MVP 以内置示例几何（点/线/面）作为默认预览数据**。
- 支持切换底图（暗色/浅色/无）。
- 地图控件：平移、缩放、框选放大、复位、显示当前比例尺。
- 预览范围：支持 Simple、Categorized、Classified、Text、ScaleDenominator（见 [`spike/openlayers-preview/result.md`](../../../spike/openlayers-preview/result.md)）。
- 不支持或仅近似支持的特性：渐变（Gradient）、图案填充（GraphicFill）、图案线型（GraphicStroke）、复杂 Filter（`!` / `in`）；Halo 为近似效果。
- 需在 UI 中明确提示：预览仅供参考，最终渲染效果以 GeoServer/QGIS 等外部工具加载导出的 `.sld` 为准。

**真实数据预览（Should Have）**：
- 若用户导入 GeoJSON 数据文件，前端解析 schema（字段名、字段类型、示例要素）。
- 将 schema 通过 WebSocket 发送给后端，作为 LLM 生成属性驱动样式的上下文。
- 使用真实要素替换内置示例几何进行预览。
- 大数据量时采取视口采样或要素数上限策略，避免前端卡顿。

**验证状态**：
- **XML 语法校验**：检查 SLD XML 是否合法（如标签闭合、编码正确）。
- **XSD 校验**：使用系统 `xmllint` 调用本地 OGC SLD 1.0.0 XSD 进行严格校验。
- **Parser 可读性校验**：使用 `geostyler-sld-parser` 检查能否正向/反向解析。
- **GeoServer 渲染测试（Could Have）**：本版本不依赖 GeoServer。导出的 `.sld` 文件由用户自行导入 GeoServer/QGIS 等外部工具验证。后续版本稳定后可接入 OpenLayers 实时渲染或可选的 GeoServer `GetLegendGraphic` 验证。

**状态展示**：
- Validation Panel 中以图标 + 文字显示各项状态。
- StatusBar 中显示总体健康状态（Agent Ready / Validation Passed / Error）。
- 任一校验失败时，在 Inspector 中提示错误行或错误字段。

---

## 4. 非功能需求

| 编号 | 需求 | 指标建议 |
|---|---|---|
| NFR-01 | Schema 校验严格 | LLM 输出必须通过 JSON Schema 校验，否则返回错误 |
| NFR-02 | 可测试性 | 每个样式类型至少有一个端到端测试 |
| NFR-03 | 可解释性 | Agent 应能说明"为什么生成该 SLD" |
| NFR-04 | 依赖可控 | 优先使用 Node/TypeScript 生态内库，减少外部服务依赖 |
| NFR-05 | 可离线运行 | StyleBuilder 与 `geostyler-sld-parser` 生成阶段不依赖网络；LLM 调用可配置为本地或云端 |
| NFR-06 | 响应性能 | LLM 首轮响应时间 ≤ 10s（云端）；本地模型以实际硬件为准 |
| NFR-07 | 界面响应 | 用户编辑 Symbolizer 参数后，预览更新延迟 ≤ 300ms |
| NFR-08 | 可访问性 | 关键操作支持键盘导航；颜色对比度符合 WCAG AA |

---

## 5. 关键假设与约束

### 5.1 技术约束

- **SLD 版本锁定为 1.0.0**：技术选型阶段以稳定可靠为第一位，优先兼容 GeoServer 等主流服务器。
- **前后端分离**：后端使用 Node.js/TypeScript（LLM/Schema/知识库/GeoStyler parser），前端使用 Vue 3 + Electron 桌面壳。
- **SLD 解析/生成权威来源统一为 GeoStyler**：前后端均使用 `geostyler-sld-parser`。
- **专业知识外置**：JSON 文件作为前置规则资源，启动时加载，不支持运行时热加载。
- **通信协议统一**：前后端统一使用 WebSocket；Electron 主进程可将 WebSocket 封装为 IPC 供渲染进程透明使用。

### 5.2 业务约束

- **每次只激活一个业务领域**：默认使用 `default` 通用领域，用户可切换为单个业务领域（如交通、土地利用），不允许多领域同时激活。
- **无参数变更历史**：暂不在系统中维护 SLD 参数的多轮变更历史。
- **RAG 明确不使用**：知识以预结构化 JSON 注入 LLM 上下文，不采用向量检索。

### 5.3 UI/UX 约束

- **风格统一**：深色科技感桌面应用，参考 [Document/UX/index.html](../UX/index.html)。
- **布局固定**：左侧 Assistant、中间 Map Preview、右侧 Inspector、顶部 Toolbar、底部 StatusBar。
- **不引入 GeoStyler React UI**：仅复用其 parser/类型/工具逻辑，Vue 3 自行实现界面。

### 5.4 质量目标

| 目标 | 说明 |
|---|---|
| 产出稳定可靠 | 生成的 SLD 1.0.0 XML 严格符合 OGC 标准，能被 GeoServer 直接接受并正确渲染 |
| 系统简单可维护 | 整体架构不过度复杂，便于一人团队开发与运维 |
| 易于迭代 | 能方便地加入新样式模板或调整现有生成逻辑 |

---

## 6. 已确认决策与待讨论问题

### 6.1 已确认决策

| 问题 | 决策 |
|---|---|
| 1. MVP 支持哪些文件格式？ | 仅原生支持 **GeoJSON + SLD**。Shapefile、QML、Mapbox Style 等其它格式借助 GeoStyler parser 生态扩展。 |
| 2. 导出时文件已存在怎么办？ | **弹窗提示**，用户确认后方可覆盖。 |
| 3. Filter 编辑器采用哪种方案？ | **方案 C（双模式）裁剪版**：可视化构造器支持单层比较条件 + AND/OR 组合，CQL 作为只读预览。 |
| 4. 预览是否必须真实数据？ | **MVP 使用内置示例几何**。真实数据预览作为 Should Have，需用户提供 GeoJSON 文件并解析 schema。 |
| 5. GeoServer 渲染验证是否接入？ | **本版本不依赖 GeoServer**。导出 SLD 供外部工具验证，后续版本可接入 OpenLayers 实时渲染或可选 GeoServer 验证。 |
| 6. SLD 生成/解析权威来源？ | **统一使用 GeoStyler parser 生态**。Node.js/TypeScript 后端直接调用 `geostyler-sld-parser`，不再使用 pySLD 或 Node 桥接。 |
| 7. 分类/分级算法在哪一层实现？ | **后端实现**。Node/TS 后端参考 GeoStyler RuleGenerator 思路，根据数据 schema 计算断点并生成 GeoStyler Style 的 Rules。 |

### 6.2 已确认：Filter 编辑器（问题 3）

已采用 **方案 C 的裁剪版**：

- 默认可视化构造器处理单层比较条件（等于、不等于、大于、小于、包含、介于等）。
- 支持 AND / OR 组合。
- CQL 作为**只读预览**；后续版本再开放 CQL 编辑。
- 中间表示采用 **GeoStyler Filter 数组**（如 `['==', 'landuse', 'residential']`、`['&&', ...]`）。
- CQL 预览初期采用手写轻量映射，后续可引入 `geostyler-cql-parser`。

此方案覆盖 80% 常用场景，同时不会阻塞 MVP 开发。

### 6.3 真实数据预览所需能力

若未来支持真实数据预览，需要具备：

1. **前端 GeoJSON 解析**：使用 `geostyler-geojson-parser` 或原生 `JSON.parse` + GeoJSON FeatureCollection 校验。
2. **Schema 提取**：字段名、字段类型（string/number/boolean/integer）、采样值、值域范围。
3. **Schema 回传后端**：通过 WebSocket 发送给 Node Agent，注入 LLM 上下文。
4. **后端分类/分级计算**：Node 后端根据 schema 使用 RuleGenerator 计算断点/唯一值，生成 GeoStyler Style Rules。
5. **地图渲染**：将 GeoJSON 转为 OpenLayers VectorSource，应用当前 SLD 样式。
6. **性能策略**：要素数超过阈值（如 5000）时提示用户或仅渲染视口内要素。
7. **隐私保障**：真实数据不离开本地 Electron 进程，不上传云端。

---

*文档版本：v1.4*  
*最后更新：2026-06-15*  
*变更说明：移动到 `Document/design/requirements.md`，链接更新为 design 目录内的新位置。*

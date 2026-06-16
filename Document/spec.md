# SLDAgent 产品规格（Spec）

> 版本：v1.0.0  
> 状态：锁定  
> 对应原型：[`Document/UX/prototype.html`](Document/UX/prototype.html)  
> 对应设计：[`Document/UX/design.md`](Document/UX/design.md)、[`Document/Research/调研方案.md`](Document/Research/调研方案.md)、[`Document/Research/调研设计.md`](Document/Research/调研设计.md)

---

## 1. 目标与范围

SLDAgent MVP 是一个 Electron 桌面应用，允许用户通过可视化树形编辑器创建、编辑并导出符合 OGC SLD 1.0.0 的样式文件。MVP 聚焦“手动编辑 + 实时预览”，AI 辅助作为增强体验稍后接入。

## 2. 目标用户

- GIS 开发者：需要快速生成或调整 SLD 样式。
- 数据可视化工程师：希望以低代码方式理解 SLD 层级关系。

## 3. 功能需求（MoSCoW）

### Must Have

| 编号 | 需求 | 验收标准 |
| :--- | :--- | :--- |
| **M-01** | 三栏主界面 | 左侧树、中间属性/预览、右侧代码/校验稳定渲染，窗口最小 1200×800。 |
| **M-02** | SLD 树编辑 | 支持 NamedLayer → UserStyle → FeatureTypeStyle → Rule → Symbolizer 五级树；**MVP 仅允许一个 NamedLayer**；Symbolizer kind 对齐 GeoStyler 原生类型（Mark / Line / Fill / Text）；支持增删改、折叠/展开、拖拽排序。 |
| **M-03** | 节点属性面板 | 根据选中节点类型动态渲染分组表单项：UserStyle/FeatureTypeStyle/Rule/Symbolizer（Mark/Line/Fill/Text）；字段元数据来自外置 JSON registry。 |
| **M-04** | 实时代码映射 | 树更新后同步刷新 GeoStyler JSON 与 SLD XML；代码区只读。 |
| **M-05** | 实时地图预览 | 使用 OpenLayers + 内置 Sample GeoJSON（预转换自 `SourceCode/data/sample/` 下的 shapefile）渲染当前样式；支持按选中节点自动推导与手动切换点/线/面数据。 |
| **M-06** | 导入/导出 SLD | 支持打开已有 SLD XML 并解析为树；支持导出 SLD XML 到文件。 |
| **M-07** | 基础校验 | 校验规则：Rule 下至少 1 个 Symbolizer；同一 FeatureTypeStyle 内只能有 1 个 ElseFilter；最小比例尺 < 最大比例尺。 |

### Should Have

| 编号 | 需求 | 验收标准 |
| :--- | :--- | :--- |
| **S-01** | Filter 可视化构造器 | 支持以条件节点方式组合 CQL 条件，并实时生成 CQL 文本。 |
| **S-02** | 比例尺滑块 | 在 Rule 面板提供最小/最大比例尺范围输入与同步提示。 |
| **S-03** | 节点级 AI 解释 | 点击 Rule 旁 💡 按钮，后端 LLM 返回自然语言解释。 |

### Won't Have（MVP 外）

- 用户自定义 Sample 数据上传。
- 栅格（Raster）Symbolizer 编辑。
- 与 GeoServer / WMS 的在线集成。
- 多人协作与版本管理。

## 4. 非功能需求

| 编号 | 需求 | 目标 |
| :--- | :--- | :--- |
| **N-01** | 离线可用 | 除 AI 解释外，核心编辑与预览不依赖网络。 |
| **N-02** | 响应延迟 | 树更新到代码/预览刷新 ≤ 300ms（开发机）。 |
| **N-03** | 跨平台 | 可在 Windows 10/11 运行，打包为单个安装包。 |
| **N-04** | 可维护性 | 前后端共享同一 `geostyler-sld-parser` 版本，lock 文件统一。 |

## 5. 数据模型（GeoStyler Style 扩展）

MVP 以 `geostyler-style` 为中间模型，Symbolizer kind 采用 GeoStyler 原生命名（`Mark` / `Line` / `Fill` / `Text`）。**MVP 的 SLD 树仅允许一个 NamedLayer 和一个 UserStyle**，后续再支持多 NamedLayer / 多 UserStyle。SLD 树与 GeoStyler Style 之间通过 Core 中的显式映射层转换，以兼容 SLD XML 语义字段与 GeoStyler 扁平字段之间的差异。

同时扩展以下字段以保留 SLD 元数据：

- `UserStyle.name`、`UserStyle.abstract`、`UserStyle.isDefault`
- `FeatureTypeStyle.title`、`FeatureTypeStyle.abstract`、`FeatureTypeStyle.featureTypeName`
- `Rule.elseFilter`、`Rule.abstract`

扩展字段在 GeoStyler JSON 中保留，生成 SLD 时由自定义后处理写入。

## 6. 关键术语

| 术语 | 说明 |
| :--- | :--- |
| **SLD** | OGC Styled Layer Descriptor，基于 XML 的地图样式规范。 |
| **GeoStyler Style** | GeoStyler 生态定义的与格式无关的 JSON 样式模型。 |
| **FeatureTypeStyle** | SLD 中控制绘制顺序（Z-Order）的容器，一个 UserStyle 可含多个。 |
| **Rule** | SLD 执行单元，包含 Filter、比例尺、Symbolizer 列表。 |
| **Symbolizer** | 具体渲染符号：Mark（点）、Line（线）、Fill（面）、Text（文本标注）、Raster（栅格）。 |

## 7. 验收场景

1. 用户新建项目 → 默认生成一个包含一个 FeatureTypeStyle、一个 Rule、一个 Mark Symbolizer 的树 → 右侧立即显示对应 GeoStyler JSON 与 SLD XML。
2. 用户修改 Symbolizer 颜色 → 地图预览在 300ms 内更新颜色。
3. 用户开启 Rule 的 ElseFilter 后再开启第二个 Rule 的 ElseFilter → 校验面板报错。
4. 用户导入 `Document/Research/sld/1.0.0/example-sld.xml` → 树结构正确解析并展示三个 FeatureTypeStyle。
5. 用户导出 SLD → 文件内容可通过 `xmllint` 基本校验。

## 8. 参考文档

- 架构设计：[`Document/Research/调研方案.md`](Document/Research/调研方案.md)
- 树结构与类型：[`Document/Research/调研设计.md`](Document/Research/调研设计.md)
- 技术选型：[`Document/Research/GeoStyler复用报告.md`](Document/Research/GeoStyler复用报告.md)
- UI/UX：[`Document/UX/design.md`](Document/UX/design.md)
- 原型：[`Document/UX/prototype.html`](Document/UX/prototype.html)

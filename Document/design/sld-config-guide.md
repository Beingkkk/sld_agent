# SLD 配置指南

> 文档定位：面向本项目的 SLD 编写与校验操作指南，存放于 `Document/design/` 作为 SDD 输入与样式规则维护参考。  
> 目标读者：Agent 开发者、样式规则维护者、测试人员。

---

## 1. 版本说明

本指南基于 **SLD 1.0.0**（OGC 标准）编写，本地官方 XSD 资源路径：

```
Document/Research/sld/1.0.0/StyledLayerDescriptor.xsd
Document/Research/sld/1.0.0/example-sld.xml
```

选择 SLD 1.0.0 的原因：

- **稳定可靠**：GeoServer、QGIS、MapServer 等主流服务器广泛支持。
- **pySLD 兼容**：pySLD 生成的 SLD 默认采用 SLD 1.0.0 元素名称。

---

## 2. SLD 编写八步流程

以下是经确认的标准 SLD 1.0.0 编写流程，可直接作为 Agent 生成与人类 review 的检查单。

### 第 1 步：明确数据源结构与几何类型

确认内容：

- 几何类型：`point`、`line`、`polygon`、`raster` 等。
- 属性字段：字段名、字段类型（字符串/数值/日期）、取值范围。

影响：

- 决定 `<Geometry>` 中引用的属性名（如 `<ogc:PropertyName>GEOMETRY</ogc:PropertyName>`）。
- 决定后续 `<Filter>`、分类、分级时可用的字段。

**示例**：

```xml
<Geometry>
  <ogc:PropertyName>GEOMETRY</ogc:PropertyName>
</Geometry>
```

### 第 2 步：确定可视化目标与规则层级

明确要表达的信息：

- 单一符号（Simple）
- 唯一值分类（Categorized）
- 数值分级（Classified）
- 条件过滤（Filtered Rule）
- 多比例尺规则

**规则顺序原则**：SLD 从上到下依次评估，先匹配的规则优先绘制。应将高优先级规则放在前面。

```xml
<FeatureTypeStyle>
  <Rule> <!-- 高优先级：重要要素 -->
    <Filter>...</Filter>
    <PointSymbolizer>...</PointSymbolizer>
  </Rule>
  <Rule> <!-- 默认规则 -->
    <PointSymbolizer>...</PointSymbolizer>
  </Rule>
</FeatureTypeStyle>
```

### 第 3 步：定义比例尺范围（如需）

使用 `<MinScaleDenominator>` 和 `<MaxScaleDenominator>` 控制规则生效的缩放级别。

**注意**：比例尺分母越大，显示越宏观；分母越小，显示越精细。

```xml
<Rule>
  <MinScaleDenominator>1000</MinScaleDenominator>
  <MaxScaleDenominator>50000</MaxScaleDenominator>
  <LineSymbolizer>...</LineSymbolizer>
</Rule>
```

### 第 4 步：编写要素过滤器（可选）

只对部分要素应用规则时使用 `<Filter>`。

**注意**：过滤器字段名、类型必须与数据源严格一致。

```xml
<Filter>
  <ogc:PropertyIsGreaterThan>
    <ogc:PropertyName>POPULATION</ogc:PropertyName>
    <ogc:Literal>10000</ogc:Literal>
  </ogc:PropertyIsGreaterThan>
</Filter>
```

常用操作符：

| 操作符 | 说明 |
|---|---|
| `<ogc:PropertyIsEqualTo>` | 等于 |
| `<ogc:PropertyIsNotEqualTo>` | 不等于 |
| `<ogc:PropertyIsGreaterThan>` | 大于 |
| `<ogc:PropertyIsLessThan>` | 小于 |
| `<ogc:PropertyIsLike>` | 字符串模糊匹配 |
| `<ogc:And>` / `<ogc:Or>` / `<ogc:Not>` | 逻辑组合 |

### 第 5 步：设计符号器与样式参数

根据几何类型选择符号器：

| 几何类型 | 符号器 | 主要参数 |
|---|---|---|
| 点 | `<PointSymbolizer>` | `fill`、`fill-opacity`、`stroke`、`stroke-width`、`size`、`rotation` |
| 线 | `<LineSymbolizer>` | `stroke`、`stroke-width`、`stroke-dasharray`、`stroke-linecap` |
| 面 | `<PolygonSymbolizer>` | `fill`、`fill-opacity`、`stroke`、`stroke-width` |
| 文本 | `<TextSymbolizer>` | `font-family`、`font-size`、`font-style`、`label`（`<PropertyName>`） |

**示例：线样式**：

```xml
<LineSymbolizer>
  <Stroke>
    <CssParameter name="stroke">#0066FF</CssParameter>
    <CssParameter name="stroke-width">2</CssParameter>
    <CssParameter name="stroke-dasharray">5 3</CssParameter>
  </Stroke>
</LineSymbolizer>
```

### 第 6 步：设置静态值或动态映射

参数值可以是：

- **静态值**：`<CssParameter name="fill">#FF0000</CssParameter>`
- **属性映射**：`<CssParameter name="fill"><ogc:PropertyName>COLOR_FIELD</ogc:PropertyName></CssParameter>`

颜色支持：十六进制、`rgb()`、颜色名称。

### 第 7 步：组装 XML 并声明命名空间

标准 SLD 1.0.0 根节点模板：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <NamedLayer>
    <Name>layer_name</Name>
    <UserStyle>
      <Name>style_name</Name>
      <FeatureTypeStyle>
        <Rule>
          <Name>rule_name</Name>
          <!-- 过滤器、比例尺、符号器 -->
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>

</StyledLayerDescriptor>
```

层级结构：

```
StyledLayerDescriptor
  └── NamedLayer
        └── UserStyle
              └── FeatureTypeStyle
                    └── Rule
                          ├── Filter (可选)
                          ├── MinScaleDenominator / MaxScaleDenominator (可选)
                          └── Symbolizer(s)
```

### 第 8 步：验证与测试

1. **XML 语法校验**：确保标签闭合、编码正确。
2. **XSD 校验**：使用本地标准 SLD 1.0.0 XSD：`Document/Research/sld/1.0.0/StyledLayerDescriptor.xsd`。
3. **GeoServer / QGIS 加载测试**：检查渲染效果、过滤器逻辑、字段匹配。
4. **回归比对**：与"金标准" SLD 进行差异比对。

**常见调试问题**：

| 现象 | 可能原因 |
|---|---|
| 符号器未生效 | 几何类型错误（如给线数据画面符号） |
| 过滤器无结果 | 字段名不匹配、类型错误、字符串未加引号 |
| 比例尺冲突 | 规则比例尺范围重叠或遗漏 |
| GeoServer 拒绝加载 | 元素名称不符合 SLD 1.0.0 规范 |

---

## 3. 标准元素速查表

### 3.1 符号器

| 元素 | 用途 |
|---|---|
| `<PointSymbolizer>` | 点要素 |
| `<LineSymbolizer>` | 线要素 |
| `<PolygonSymbolizer>` | 面要素 |
| `<TextSymbolizer>` | 标注 |
| `<RasterSymbolizer>` | 栅格数据 |

### 3.2 常用 CssParameter

#### 点 / 面通用

| name | 说明 |
|---|---|
| `fill` | 填充颜色 |
| `fill-opacity` | 填充透明度 |
| `stroke` | 描边颜色 |
| `stroke-width` | 描边宽度 |
| `stroke-opacity` | 描边透明度 |

#### 线专用

| name | 说明 |
|---|---|
| `stroke` | 线颜色 |
| `stroke-width` | 线宽 |
| `stroke-dasharray` | 虚线模式，如 `5 3` |
| `stroke-linecap` | 线端样式：`butt`、`round`、`square` |
| `stroke-linejoin` | 线连接样式：`miter`、`round`、`bevel` |

#### 文本专用

| name | 说明 |
|---|---|
| `font-family` | 字体 |
| `font-size` | 字号 |
| `font-style` | 样式：`normal`、`italic`、`oblique` |
| `font-weight` | 粗细：`normal`、`bold` |

---

## 4. 完整示例：蓝色渐变虚线（SLD 1.0.0）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
  xmlns="http://www.opengis.net/sld"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <NamedLayer>
    <Name>RoadLayer</Name>
    <UserStyle>
      <Name>BlueGradientDashedLine</Name>
      <FeatureTypeStyle>
        <Rule>
          <Name>main</Name>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#0066FF</CssParameter>
              <CssParameter name="stroke-width">2</CssParameter>
              <CssParameter name="stroke-dasharray">5 3</CssParameter>
              <CssParameter name="stroke-opacity">0.8</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>

</StyledLayerDescriptor>
```

---

## 5. 与 JSON 知识库的映射关系

本项目的 JSON 知识库通过 `schema_field` → `css_name` 映射，将 LLM 友好的抽象参数转换为 SLD 1.0.0 的 `<CssParameter>`。

| JSON 知识库字段 | SLD 1.0.0 输出 |
|---|---|
| `stroke_color` | `<CssParameter name="stroke">#0066FF</CssParameter>` |
| `stroke_width` | `<CssParameter name="stroke-width">2</CssParameter>` |
| `stroke_dasharray` | `<CssParameter name="stroke-dasharray">5 3</CssParameter>` |
| `fill_color` | `<CssParameter name="fill">#FF0000</CssParameter>` |
| `opacity` | `<CssParameter name="fill-opacity">0.8</CssParameter>` |

**注意**：渐变（Gradient）在标准 SLD 1.0.0 中需通过 `<ColorMap>` 或 `<GraphicFill>` 实现，pySLD 会根据参数自动处理。JSON 知识库中应明确标注哪些参数需要特殊符号器支持。

---

## 6. 验证检查单

在将 SLD 提交到 GeoServer 或作为回归用例之前，按以下清单检查：

- [ ] 根节点版本为 `version="1.0.0"`
- [ ] 命名空间声明完整（`sld`、`ogc`、`xlink`、`xsi`）
- [ ] 使用 `<FeatureTypeStyle>` 元素
- [ ] 使用 `<PolygonSymbolizer>` / `<LineSymbolizer>` / `<PointSymbolizer>` 元素
- [ ] 使用 `<CssParameter>` 元素
- [ ] `<Geometry>` 中引用的字段名存在于数据源
- [ ] `<Filter>` 中字段类型与值匹配（字符串需 `<ogc:Literal>`，数值无需引号）
- [ ] 比例尺分母方向正确（分母越大越宏观）
- [ ] 通过本地 XSD 校验（`Document/Research/sld/1.0.0/StyledLayerDescriptor.xsd`）
- [ ] 在 GeoServer / QGIS 中加载并渲染通过

---

## 7. 小结

标准 SLD 1.0.0 编写顺口流程：

```
数据 → 目标 → 规则顺序 → 比例尺 → 过滤 → 符号器细节 → XML 组装 → 测试
```

按此流程逐步检查，即可生成 GeoServer 可直接接受并正确渲染的 SLD 文件。

---

*文档版本：v1.3*  
*最后更新：2026-06-15*  
*变更说明：移动到 `Document/design/sld-config-guide.md`，链接更新为 design 目录内的新位置。*

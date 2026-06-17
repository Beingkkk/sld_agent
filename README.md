# SLDAgent

> 智能 SLD（Styled Layer Descriptor）样式编辑器桌面应用  
> 基于 Electron + Vue 3 + Node.js/TypeScript + GeoStyler 生态

SLDAgent 是一款面向 GIS 制图人员、地图开发者和数据可视化工程师的桌面端 SLD 样式编辑工具。它将复杂的 SLD 规范抽象为**可视化的节点树**，并通过**实时预览**与**AI 解释层**降低样式编写门槛，让专业地图样式的创建、调试与交付更高效、更直观。

---

## ✨ 产品核心功能

### 1. 可视化 SLD 树编辑

告别手写 XML。SLDAgent 将 SLD 文档结构呈现为清晰的层级节点树：

- `NamedLayer → UserStyle → FeatureTypeStyle → Rule → Symbolizer`
- 支持节点的增删改、展开折叠与排序
- 结构变化实时同步到生成的 SLD XML

**解决痛点**：传统 SLD 编辑依赖 XML 手写或通用 IDE，结构层级深、标签冗余、易出错。

### 2. JSON 驱动的属性面板

每个 Symbolizer 与 Rule 的表单字段均由外部 JSON 注册表定义：

- 字段类型、默认值、约束条件集中配置
- 新增 Symbolizer 字段无需改动前端组件
- 前后端共用同一套字段定义，保证数据理解一致

**解决痛点**：样式字段分散在多个组件中，扩展成本高，且前后端对字段语义容易不一致。

### 3. 实时地图预览

基于 OpenLayers 与 Sample GeoJSON 数据，样式修改后立即在地图中呈现：

- 点、线、面、标注 Symbolizer 实时渲染
- 自动处理 GeoStyler 到 OpenLayers 的样式兼容问题

**解决痛点**：样式编辑与效果查看分离，需要反复导出、刷新、切换工具验证。

### 4. 代码与模型双栏对照

右侧工作区同时展示：

- **GeoStyler JSON**：标准中间模型，便于理解与复用
- **SLD XML**：最终产物，可直接用于 GeoServer 等地图服务

编辑任意一侧的源头（树节点）都会同步更新两侧代码，降低学习成本。

### 5. 节点化 Filter 规则编辑器

为 Rule 设置过滤条件时，无需记忆 CQL 语法：

- 以 AND / OR / NOT / 比较条件组合过滤树
- 实时生成对应的 SLD Filter 与只读 CQL 预览

**解决痛点**：CQL/Filter 语法门槛高，复杂条件难以组合与维护。

### 6. AI 样式解释与辅助决策

后端 Agent 集成 LLM，为制图过程提供自然语言支持：

- 解释某个 Symbolizer 字段的含义与最佳实践
- 提示当前样式可能存在的显示问题或规范冲突
- **AI 仅作建议，不直接修改样式树**，用户始终掌握最终决策权

**解决痛点**：SLD 规范复杂，新手难以上手；专家也需在规范细节与显示效果之间反复权衡。

### 7. 离线优先的桌面体验

- 本地字体、本地示例数据、本地 Parser 与 Agent
- Electron 无边框窗口 + 自定义标题栏，贴合专业制图工作台风格
- 无需公网依赖，保护数据隐私

**解决痛点**：Web 工具依赖网络与账号，离线环境或涉密场景无法使用。

---

## 🛠 技术栈

| 层级 | 技术 |
| --- | --- |
| 桌面壳 | Electron + 无边框窗口 + 自定义标题栏 |
| 前端 | Vue 3 + TypeScript + Vite + Pinia + OpenLayers 10 |
| 后端 | Node.js + TypeScript + WebSocket |
| 核心库 | `geostyler-sld-parser` / `geostyler-openlayers-parser` / `fast-xml-parser` |
| 核心模块 | `@sldagent/core`：SLD 树、Transformer、ValidationEngine、FilterTransformer |
| 包管理 | npm workspaces（monorepo） |

---

## 🏗 顶层架构

```text
┌─────────────────────────────────────────────────────────────┐
│                    Electron + Vue 3 前端                     │
│  ┌──────────────┐  ┌──────────────────────┐  ┌──────────┐  │
│  │   SLD 树编辑  │  │   属性面板 + 地图预览 │  │ 代码 + AI │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         └─────────────────┼───────────────────┘            │
│                           │                                │
│              SourceCode/data/registry/*.json               │
│              （字段定义 / Symbolizer schema / 编辑器类型）   │
└───────────────────────────┬────────────────────────────────┘
                            │ WebSocket
┌───────────────────────────┼────────────────────────────────┐
│              Node.js / TypeScript Agent 后端                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  LLM 语义解析  │  │ StyleBuilder │  │ geostyler-sld-   │  │
│  │  知识库注入    │  │ RuleGenerator│  │ parser write/read│  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────────────────────────────┐                  │
│  │ SourceCode/data/knowledge/*.json       │                  │
│  │ （SLD 速查 / 约束 / Few-shot 样例）     │                  │
│  └──────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

数据流以 **GeoStyler Style** 为唯一中间模型：前端 Store 维护样式树，所有变更同步触发属性面板、地图预览与代码/XML 显示；后端 LLM 仅返回解释文本与预警，不直接修改树。

---

## 📦 目录结构

```text
Document/                  # 设计文档与规范
├── constitution.md        # 技术约束与红色条款
├── spec.md                # MVP 产品规格
├── plan-*.md              # 各模块设计文档
├── UX/                    # UX 设计规范与可交互原型
└── Research/              # 调研报告、SLD 标准样例
SourceCode/                # 源码 monorepo
├── core/                  # @sldagent/core
├── frontend/              # @sldagent/frontend（Vue 3）
├── backend/               # @sldagent/backend（Node/TS Agent）
├── electron/              # @sldagent/electron
├── data/                  # 外置 JSON 资源、示例数据、字体
└── config/                # 配置模板
```

---

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18
- npm ≥ 9

### 安装依赖

```bash
npm install
```

### 开发模式（同时启动 frontend + backend）

```bash
npm run dev
```

### 独立启动

```bash
npm run dev:frontend   # 仅前端 Vite dev server
npm run dev:backend    # 仅后端 WebSocket Agent
```

### 常用命令

```bash
npm run typecheck      # 类型检查
npm test               # 运行所有测试
npm run build          # 构建所有 workspace
npm run lint           # 代码检查
npm run dist           # 打包 Electron 应用
```

---

## 🧩 SLD 生成链路

树 → 每个 `FeatureTypeStyle` 单独构造 GeoStyler Style → `geostyler-sld-parser.writeStyle()` 生成各 FTS 的 SLD 片段 → `fast-xml-parser` 后处理拼接为完整 SLD XML，并补回 `UserStyle` / `FeatureTypeStyle` / `Rule` 的扩展元数据。

导入时反向：先用 `fast-xml-parser` 解析 SLD XML 结构，按 `<FeatureTypeStyle>` 边界切分，再对每个片段调用 parser 读取为 GeoStyler JSON，最后还原为树。

---

## 📚 关键文档

| 文档 | 路径 |
| --- | --- |
| 项目宪法与约束 | [Document/constitution.md](Document/constitution.md) |
| 产品规格 | [Document/spec.md](Document/spec.md) |
| 核心模块设计 | [Document/plan-core.md](Document/plan-core.md) |
| 前端设计 | [Document/plan-frontend.md](Document/plan-frontend.md) |
| 后端设计 | [Document/plan-backend.md](Document/plan-backend.md) |
| Filter 编辑器设计 | [Document/plan-filter.md](Document/plan-filter.md) |
| UX 设计规范 | [Document/UX/design.md](Document/UX/design.md) |
| 可交互原型 | [Document/UX/prototype.html](Document/UX/prototype.html) |

---

## 🤝 贡献指南

本项目采用 **SDD（Specification-Driven Development）** 规范驱动开发：

1. **禁止无 plan 直接编码**：所有代码变更需先有对应设计文档。
2. **禁止直接修改已锁定的 spec 或 plan**：需求变更需创建 `Document/changes/proposal-{NNNN}.md` 提案。
3. **公共接口先行**：新增公共接口必须在对应 plan 的「接口定义」章节中描述。
4. **测试伴随**：新增代码必须伴随测试。

---

## 📄 许可证

[MIT](LICENSE)

---

> SLDAgent — 让 SLD 样式编辑更智能、更直观。

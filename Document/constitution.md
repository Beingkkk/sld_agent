# SLDAgent 宪法（Constitution）

> 版本：v1.0.0  
> 生效日期：2026-06-16  
> 修改流程：需经项目负责人书面同意，并在 `Document/changes/` 中创建 Type-A 提案。

---

## 1. 项目愿景

SLDAgent 是一个面向 GIS 专业人员与开发者的桌面端 SLD（Styled Layer Descriptor）智能样式编辑器。通过可视化树形编辑、实时预览与 AI 辅助，降低手写 SLD XML 的门槛，让样式设计成为“所见即所得”的高效工作流。

## 2. 核心设计原则

| 编号 | 原则 | 说明 |
| :--- | :--- | :--- |
| **CP-1** | **GeoStyler 为中间模型** | 前后端统一以 `geostyler-style` 为数据基准，最终 SLD XML 必须由 `geostyler-sld-parser` 生成，禁止手写 XML 构造器。 |
| **CP-2** | **单向数据流** | 树状态 Store 是唯一真相源。任何 UI 操作先更新 Store，再由 Transformer 同步生成 GeoStyler JSON 与 SLD XML。 |
| **CP-3** | **离线优先** | MVP 必须能在无外部地图服务的情况下完成核心编辑与预览；依赖的 Sample 数据内置在本地。 |
| **CP-4** | **AI 仅作副驾驶** | LLM 只输出自然语言解释与建议，不直接修改树状态；最终决策权在用户。 |
| **CP-5** | **前后端同构解析** | 前端与后端使用同一版本的 `geostyler-sld-parser`，由单一 lock 文件统一管理。 |

## 3. 技术栈约束

- **前端框架**：Vue 3 + TypeScript
- **样式方案**：Tailwind CSS
- **地图渲染**：OpenLayers + `geostyler-openlayers-parser`
- **SLD 解析**：`geostyler-sld-parser`
- **后端运行时**：Node.js >= 20.6.0 + TypeScript
- **桌面封装**：Electron
- **前后端通信**：开发与生产均使用 WebSocket；IPC 仅用于窗口控制与文件对话框

## 4. 红色条款（不可违反）

1. 禁止无 plan 直接编码。
2. 禁止 plan 与代码不一致。
3. 禁止未经 proposal 直接修改已锁定的 spec 或 plan。
4. 禁止需求变更不更新 spec。
5. 禁止先实现后补测试。
6. 禁止在源码中硬编码 API Key、LLM endpoint 等敏感信息。
7. 禁止引入 GeoStyler React UI 主包或 Ant Design。

## 5. 文档效力层级

```text
constitution.md > spec.md > plan-{module}.md > changes/proposal-*.md > source code
```

- `constitution.md`：极少变更，项目级最高约束。
- `spec.md`：需求真相源，所有功能必须能追溯至此。
- `plan-{module}.md`：模块设计唯一依据，锁定后不可直接修改。
- `changes/proposal-*.md`：活跃变更，必须经过审阅与归档。

## 6. 质量门禁

- 所有公共接口必须在 plan 中定义。
- 新增代码必须伴随单元测试或集成测试。
- 提交前必须通过类型检查与格式化检查。
- 每次归档前必须运行 `/sdd-verify`。

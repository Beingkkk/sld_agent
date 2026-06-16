# Plan: Backend（Node.js/TypeScript Agent）

> 版本：v1.0.0  
> 状态：锁定  
> 依赖：spec v1.0.0、constitution v1.0.0、plan-core v1.0.0  
> 对应需求：M-06（导入解析）、S-03（AI 解释）

---

## 1. 目标与边界

Backend 模块是 Node.js/TypeScript 编写的轻量 Agent，负责：
- 接收前端 WebSocket 请求，提供自然语言解释与智能预警。
- 将 LLM 输出映射为 GeoStyler Style 参数（为后续自然语言生成样式做准备）。
- 提供分类/分级（RuleGenerator）等计算密集型辅助。
- 封装 `geostyler-sld-parser` 作为可复用服务。

本模块以 workspace package 形式存在于 `SourceCode/backend/`，通过 workspace 协议依赖 `SourceCode/core/`。

MVP 阶段，Backend **不直接修改树状态**，仅输出文本建议与计算结果；真正的样式修改仍由用户在前端确认后写入 Store。

**边界内**：
- WebSocket 服务与消息路由。
- LLM 调用与提示词工程。
- 知识库加载与注入。
- `StyleBuilder`：将 LLM 抽象参数转为 GeoStyler Style。
- `RuleGenerator`：分类/分级断点计算与配色生成。
- SLD 解析/写出的后端封装。
- JSON Schema 校验（ajv）。

**边界外**：
- UI 渲染（plan-frontend）。
- 树状态持久化（plan-core / frontend）。
- 文件系统对话框（Electron main 进程）。

## 2. 核心类设计

### 2.1 `AgentServer`

```typescript
class AgentServer {
  constructor(options: AgentServerOptions);
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // 消息路由
  private handleMessage(clientId: string, message: AgentMessage): Promise<AgentResponse>;
}
```

### 2.2 `LLMClient`

```typescript
interface LLMClient {
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
}

class AnthropicClient implements LLMClient {
  constructor(config: { apiKeyEnvVar: string; model: string; maxTokens: number });
  complete(prompt: string): Promise<string>;
}
```

### 2.3 `PromptBuilder`

```typescript
class PromptBuilder {
  // 场景 1：解释当前 Rule
  static explainRule(context: RuleContext): string;
  
  // 场景 2：智能预警
  static warnRule(context: RuleContext): string;
  
  // 场景 3：解释属性字段
  static explainProperty(nodeType: NodeType, fieldName: string, value: unknown): string;
  
  // 场景 4：自然语言生成样式（后续）
  static generateStyle(userPrompt: string, dataSchema: DataSchema): string;
}
```

### 2.4 `StyleBuilder`

```typescript
class StyleBuilder {
  // 将 LLM 输出的抽象参数对象转换为 GeoStyler Style
  static build(params: StyleParams): GeoStylerStyle;
}
```

### 2.5 `RuleGenerator`

```typescript
interface ClassificationOptions {
  attribute: string;
  method: 'equalInterval' | 'quantile' | 'naturalBreaks';
  classes: number;
  colorRamp: string[];
}

class RuleGenerator {
  // 分级
  static classify(data: GeoStylerData, options: ClassificationOptions): Rule[];
  
  // 唯一值分类
  static categorize(data: GeoStylerData, attribute: string, colorRamp: string[]): Rule[];
  
  // 生成配色
  private static generateColors(ramp: string[], count: number): string[];
}
```

### 2.6 `KnowledgeBase`

```typescript
class KnowledgeBase {
  constructor(basePath: string); // basePath = SourceCode/data/
  load(): Promise<void>;
  
  // 注册表访问
  getEditorType(type: string): EditorTypeDefinition;
  getField(id: string): FieldDefinition;
  getNodeSchema(nodeType: string): NodeSchema;
  getSymbolizerSchema(kind: string): SymbolizerSchema;
  
  // LLM 知识
  getDomainCatalog(): Domain[];
  getGeneralConstraints(): string[];
  getSLDReference(): SLDReference;
  getExamples(): Example[];
  
  // Prompt 注入
  buildFieldDictionaryPrompt(): string;
  buildSLDReferencePrompt(): string;
  buildExamplesPrompt(): string;
}
```

## 3. 接口定义

### 3.1 WebSocket 消息

| 方向 | 消息类型 | 载荷 | 响应 |
| :--- | :--- | :--- | :--- |
| 前端 → 后端 | `explain_rule` | `{ treeSnapshot, path }` | `rule_explanation` |
| 后端 → 前端 | `rule_explanation` | `{ text, warnings? }` | - |
| 前端 → 后端 | `explain_property` | `{ nodeType, fieldName, value }` | `property_explanation` |
| 后端 → 前端 | `property_explanation` | `{ text }` | - |
| 前端 → 后端 | `generate_rules` | `{ dataSchema, attribute, method, classes, colorRamp }` | `generated_rules` |
| 后端 → 前端 | `generated_rules` | `{ rules: GeoStylerRule[] }` | - |

### 3.2 与 Core 的接口

Backend 直接导入 Core 包中的类：
- `SLDTree`
- `GeoStylerTransformer`
- `ValidationEngine`

### 3.3 配置文件

运行时读取 `config.json`（开发期默认 `SourceCode/config/config.json`；生产期由 Electron 主进程通过环境变量 `SLDAGENT_CONFIG_PATH` 指定，不提交到仓库；模板为 `config.json.template`）。

```json
{
  "llm": {
    "provider": "anthropic",
    "baseUrl": "https://api.anthropic.com/v1",
    "model": "claude-sonnet-4-6",
    "apiKeyEnvVar": "SLDAGENT_LLM_API_KEY",
    "maxTokens": 2048
  },
  "server": {
    "port": 8765,
    "host": "127.0.0.1"
  }
}
```

- `provider` 标识接口协议族，默认 Anthropic 兼容接口。
- `baseUrl` 允许指向其他 Anthropic 兼容 endpoint（如 Kimi / MiniMaxi 的 Anthropic 兼容地址）。
- API Key 通过 `apiKeyEnvVar` 指定的环境变量注入，禁止写入配置文件或源码。

## 4. 数据流

前端发送 `explain_rule`
  → `AgentServer` 路由到 `ExplainRuleHandler`
  → 从 `treeSnapshot` 重建 `SLDTree`
  → 提取 Rule 上下文（Filter、Symbolizers、Scale）
  → `PromptBuilder.explainRule()` 组合提示词（含 KnowledgeBase 示例）
  → `LLMClient.complete()` 调用 LLM
  → 返回 `rule_explanation` 文本
  → 前端展示在 AI 辅助面板

## 5. 关键决策

| 决策 | 方案 | 原因 |
| :--- | :--- | :--- |
| 后端语言 | Node.js/TypeScript | 与 `geostyler-sld-parser` 同构，避免 Python-Node 桥接。 |
| LLM 接入 | Anthropic 兼容接口；API Key 通过环境变量注入；`config.json` 运行时读取、不提交仓库 | 默认 Claude 系列效果较稳定；兼容 endpoint 可替换。 |
| 是否直接修改树 | MVP 不修改，只返回建议 | 降低风险，符合 CP-4“AI 仅作副驾驶”。 |
| 分类/分级 | 后端计算断点与配色 | 数据量大时后端更适合；结果可直接转为 GeoStyler Rules。 |
| 知识库 | `SourceCode/data/registry/*.json` + `SourceCode/data/knowledge/*.json`，启动时加载 | 统一字段注册表同时服务前端渲染与 LLM 理解，SLD 速查支持外部 SLD 解析。 |
| 项目结构 | monorepo workspace，`backend` 依赖 `core` package | 共享数据模型与转换逻辑，统一 parser 版本。 |

## 6. 测试策略

- **单元测试**：`PromptBuilder` 输出格式、`StyleBuilder` 参数映射、`RuleGenerator` 断点计算。
- **集成测试**：WebSocket 端到端调用 `explain_rule` 并验证响应格式。
- **Mock 测试**：LLM 调用使用固定返回 mock，避免消耗 token。

## 7. 任务清单

- [DB-001] 初始化 Node.js/TypeScript 后端项目骨架。
- [DB-002] 配置 WebSocket 服务与消息路由。
- [DB-003] 实现 `LLMClient` 与 Anthropic 适配器。
- [DB-004] 实现 `KnowledgeBase`：加载 `SourceCode/data/registry/*.json` 与 `SourceCode/data/knowledge/*.json`。
- [DB-005] 实现 `PromptBuilder`：注入字段词典、SLD 速查、通用约束、Few-shot 样例。
- [DB-006] 实现 `StyleBuilder` 基础映射。
- [DB-007] 实现 `RuleGenerator` 分级与分类算法。
- [DB-008] 集成 `geostyler-sld-parser` 后端封装。
- [DB-009] 实现 JSON Schema 校验（ajv）。
- [DB-010] 编写单元测试与 WS 集成测试。

## 8. 风险与依赖

- **LLM API 可用性**：MVP 需保证 API Key 配置；离线场景下 AI 功能降级为空或本地规则预警。
- **提示词稳定性**：LLM 输出需通过 JSON Schema 或正则约束，避免前端解析失败。
- **前后端版本一致性**：`geostyler-sld-parser` 版本需与 Core/Frontend 统一。
- **数据隐私**：Sample GeoJSON 为本地数据，不上传；后续若支持用户数据需明确隐私策略。
- **性能**：RuleGenerator 处理大数据集时可能阻塞事件循环，必要时改为 Worker 或异步流式返回。

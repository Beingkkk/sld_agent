# plan-backend-core — 后端核心与会话管理

> 文档定位：SDD 模块设计，编码唯一依据。  
> 关联需求：FR-01, FR-02, FR-03, FR-12, FR-16, NFR-01, NFR-03, NFR-06。  
> 关联设计：[Document/design/agent-session.md](../design/agent-session.md)、[Document/design/interface-contracts.md](../design/interface-contracts.md)。

---

## 1. 模块目标

实现后端 WebSocket 服务、Agent 会话状态管理、LLM 调用编排、知识库加载与 Prompt 构建、以及错误回退机制。

---

## 2. 职责边界

| 组件 | 职责 |
|---|---|
| `WsServer` | 启动 WebSocket 服务，管理客户端连接，将消息路由到对应 `AgentSession` |
| `MessageRouter` | 解析 `WsMessage`，按 `type` 分发到 `AgentSession` 方法，封装响应/错误 |
| `AgentSession` | 维护当前权威 Style、lastValidStyle、聊天历史、领域状态；协调 KB/LLM/Builder/SLD 完成生成/修改/导入/导出/校验 |
| `KnowledgeBaseLoader` | 加载 `knowledge/root.json` + 领域文件，按规则合并 |
| `PromptBuilder` | 根据当前领域、geometry_type、style_type、完整 StyleParams、用户指令构造 LLM prompt |
| `LlmClient` | 封装 Anthropic/OpenAI 兼容 SDK 调用，处理超时与重试 |
| `RuleGenerator` | 根据 DataSchema 计算分类/分级断点 |

---

## 3. 目录结构

```
SourceCode/backend/
├── src/
│   ├── index.ts              # 启动入口
│   ├── server.ts             # WsServer
│   ├── router.ts             # MessageRouter
│   ├── session/
│   │   ├── AgentSession.ts
│   │   └── types.ts
│   ├── knowledge/
│   │   ├── KnowledgeBaseLoader.ts
│   │   ├── PromptBuilder.ts
│   │   └── types.ts
│   ├── llm/
│   │   ├── LlmClient.ts
│   │   └── types.ts
│   ├── style/
│   │   └── RuleGenerator.ts
│   └── errors.ts
├── knowledge/                # 运行时加载的知识库 JSON
│   ├── root.json
│   ├── default.json
│   ├── transport.json
│   └── landuse.json
├── tests/
│   └── unit/
│       ├── AgentSession.test.ts
│       ├── KnowledgeBaseLoader.test.ts
│       ├── PromptBuilder.test.ts
│       └── MessageRouter.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 4. 接口定义

### 4.1 WsServer 对外接口

```typescript
interface WsServerOptions {
  port: number | 0;           // 0 表示随机端口
  knowledgeDir: string;
  configPath?: string;
  staticSchemaDir?: string;   // xmllint-wasm schema bundle 目录
}

interface WsServer {
  start(): Promise<{ url: string; port: number }>;
  stop(): Promise<void>;
}
```

### 4.2 MessageRouter 对外接口

```typescript
interface MessageRouter {
  handle(raw: string, session: AgentSession): Promise<WsMessage>;
}
```

### 4.3 AgentSession 对外接口

```typescript
interface AgentSessionOptions {
  id: string;
  knowledgeBase: KnowledgeBase;
  sldService: SldService;
  llmClient: LlmClient;
}

class AgentSession {
  constructor(options: AgentSessionOptions);

  async generate(request: GenerateRequest): Promise<GenerationResult>;
  async modify(request: ModifyRequest): Promise<GenerationResult>;
  async applyPatch(request: ApplyPatchRequest): Promise<GenerationResult>;
  async importStyle(request: ImportStyleRequest): Promise<GenerationResult>;
  async export(request: ExportRequest): Promise<ExportResult>;
  async validate(style?: Style): Promise<ValidationReport>;
  getDomains(): DomainsResult;
  async setDomain(domain: string): Promise<void>;
  setDataSchema(schema: DataSchema): void;
  getState(): SessionState;
}
```

### 4.4 KnowledgeBaseLoader 对外接口

```typescript
interface KnowledgeBase {
  domains: DomainInfo[];
  activeDomain: string;
  // 当前激活领域的合并后片段
  styleCatalog: StyleCatalogItem[];
  parameterDictionary: Record<string, ParameterDef>;
  constraints: string[];
  fewShotExamples: FewShotExample[];
  modificationRules: string[];
}

interface KnowledgeBaseLoader {
  load(rootDir: string, activeDomain?: string): Promise<KnowledgeBase>;
}
```

### 4.5 PromptBuilder 对外接口

```typescript
interface PromptBuilder {
  buildGeneratePrompt(ctx: PromptContext): string;
  buildModifyPrompt(ctx: PromptContext): string;
}

interface PromptContext {
  knowledgeBase: KnowledgeBase;
  currentParams?: StyleParams;
  instruction: string;
  geometryType?: string;
  styleType?: string;
  preserve?: string[];
  dataSchema?: DataSchema;
}
```

### 4.6 LlmClient 对外接口

```typescript
interface LlmClientOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  defaultTimeoutMs?: number;
  maxTimeoutMs?: number;
}

interface LlmClient {
  complete(prompt: string, options?: { timeoutMs?: number }): Promise<string>;
}
```

---

## 5. 数据流

### 5.1 generate 成功

前端 WS `generate`
  → `MessageRouter` 解析并校验请求
  → `AgentSession.generate()`
    → `withLock` 获取会话锁
    → `PromptBuilder.buildGeneratePrompt()` 构造 prompt
    → `LlmClient.complete()` 调用 LLM
    → 解析 JSON 并用 `StyleParamsValidator` 校验
    → `ParamsNormalizer.normalize()` 别名归一化
    → `StyleBuilderFactory.create().build()` 生成 GeoStyler Style
    → `SldService.writeStyle()` 写出 SLD XML
    → `SldService.validate()` 执行 XSD + Roundtrip
    → 更新 `currentStyle` / `lastValidStyle`
    → 记录成功 Turn
  → WS `generation_result`

### 5.2 generate 失败回退

任一阶段失败
  → 记录失败 Turn
  → `currentStyle = structuredClone(lastValidStyle)`
  → 释放锁
  → WS `error`

### 5.3 modify 增量修改

与 generate 类似，但 prompt 包含完整 `currentParams`，merge 时强制保留 `preserve` 字段。

### 5.4 apply_patch 确认后提交

前端 WS `apply_patch { patches }`
  → `AgentSession.applyPatch()`
    → `withLock`
    → 按顺序将 patches 应用到当前 `currentStyle`
    → `StyleBuilder` 补全/规范化（如需）
    → `SldService.writeStyle()` + `validate()`
    → 成功后更新 `currentStyle` / `lastValidStyle`
  → WS `generation_result` 或 `error`

---

## 6. 并发与回退

- `generate`/`modify`/`applyPatch`/`importStyle` 必须通过 `withLock` 串行执行。
- `validate`/`export`/`getDomains`/`setDomain` 可并发。
- 失败时回退到 `lastValidStyle`；无 `lastValidStyle` 时 `currentStyle` 置为 `undefined`。

---

## 7. 错误处理

| 阶段 | 错误码 | 行为 |
|---|---|---|
| 请求解析 | `INVALID_REQUEST` | 直接返回错误，不修改状态 |
| 并发冲突 | `INVALID_REQUEST` (busy) | 直接返回错误 |
| LLM 调用 | `LLM_ERROR` | 回退，返回错误 |
| Schema 校验 | `SCHEMA_VALIDATION_FAILED` | 回退，返回错误 |
| StyleBuilder | `BUILDER_ERROR` | 回退，返回错误 |
| SLD 写出 | `SLD_PARSE_ERROR` | 回退，返回错误 |
| XSD 校验 | `XSD_VALIDATION_FAILED` | 回退，返回错误 |
| Roundtrip | `ROUNDTRIP_VALIDATION_FAILED` | 回退，返回错误 |

---

## 8. 任务清单（TDD）

- [x] RED: 编写 `KnowledgeBaseLoader` 加载/合并失败测试
- [x] GREEN: 实现 `KnowledgeBaseLoader`
- [x] RED: 编写 `PromptBuilder` 各场景 prompt 内容断言测试
- [x] GREEN: 实现 `PromptBuilder`
- [x] RED: 编写 `AgentSession.generate` 成功/失败回退测试（mock LLM/Builder/SldService）
- [x] GREEN: 实现 `AgentSession`
- [x] RED: 编写 `MessageRouter` 消息分发与错误包装测试
- [x] GREEN: 实现 `MessageRouter`
- [x] RED: 编写 `WsServer` 启动/停止/READY 行测试
- [x] GREEN: 实现 `WsServer`
- [ ] REFACTOR: 统一错误类型与日志（后续补充结构化日志）

---

## 9. 决策与假设

- 每次只激活一个业务领域。
- Prompt 中注入完整 `StyleParams` 以提升多轮字段保留率。
- LLM 输出必须先通过 JSON Schema 校验，再做别名归一化。
- 后端不直接写文件；导出落盘由前端完成。

---

## 10. 版本历史

| 版本 | 日期 | 说明 |
|---|---|---|
| 1.0.0 | 2026-06-15 | 初始 plan，对齐 interface-contracts v0.3 |

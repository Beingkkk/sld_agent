# plan-frontend — Vue 3 + Electron 前端

> 文档定位：SDD 模块设计，编码唯一依据。  
> 关联需求：FR-01, FR-06 ~ FR-12, FR-16 ~ FR-18, NFR-07, NFR-08。  
003e 关联设计：[Document/design/interface-contracts.md](../design/interface-contracts.md)、[Document/design/filter-editor.md](../design/filter-editor.md)。

---

## 1. 模块目标

实现桌面应用用户界面：左侧 Assistant 聊天、中间 Map Preview、右侧 Inspector（含 GeoStyler/参数/SLD/Rules 标签）、顶部 Toolbar、底部 StatusBar。通过原生 WebSocket 直连后端。

---

## 2. 职责边界

| 组件 | 职责 |
|---|---|
| `main.ts` | Electron 主进程入口：启动/停止后端、加载渲染页、管理窗口 |
| `preload.ts` | 安全桥接（按需，MVP 先用原生 WebSocket） |
| `App.vue` | 根布局 |
| `AssistantPanel` | 自然语言输入与聊天历史 |
| `MapPreview` | OpenLayers 实时预览 |
| `InspectorPanel` | 右侧检查器：参数面板、规则列表、GeoStyler JSON、SLD XML |
| `RulesPanel` | Rule 增删改查、排序、启用/禁用 |
| `SymbolizerEditor` | 点/线/面/文本 Symbolizer 参数表单 |
| `FilterEditor` | 见 `plan-filter-editor.md` |
| `ValidationPanel` | 校验结果展示 |
| `Toolbar` | 导入/导出/设置/撤销重做 |
| `StatusBar` | 后端状态、校验摘要、当前比例尺 |
| `WsClient` | WebSocket 连接与请求封装 |
| `StyleStore` | Pinia 全局状态：currentStyle、lastValidStyle、params、sldXml、validation |
| `FileService` | 文件选择/保存对话框、最近文件记录 |

---

## 3. 目录结构

```
SourceCode/frontend/
├── electron/
│   ├── main.ts
│   └── preload.ts
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── components/
│   │   ├── AssistantPanel.vue
│   │   ├── MapPreview.vue
│   │   ├── InspectorPanel.vue
│   │   ├── RulesPanel.vue
│   │   ├── SymbolizerEditor.vue
│   │   ├── ValidationPanel.vue
│   │   ├── Toolbar.vue
│   │   └── StatusBar.vue
│   ├── composables/
│   │   ├── useWsClient.ts
│   │   └── useMapPreview.ts
│   ├── stores/
│   │   └── styleStore.ts
│   ├── services/
│   │   ├── wsClient.ts
│   │   └── fileService.ts
│   └── styles/
│       └── main.css
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── electron-builder.yml
```

---

## 4. 接口定义

### 4.1 WsClient 对外接口

```typescript
interface WsClientOptions {
  url: string;
  onMessage?: (msg: WsMessage) => void;
  onClose?: () => void;
  onError?: (err: Error) => void;
}

interface WsClient {
  connect(): Promise<void>;
  disconnect(): void;
  send<T = unknown>(type: string, payload: unknown, timeoutMs?: number): Promise<T>;
}
```

### 4.2 StyleStore 对外接口

```typescript
interface StyleState {
  currentStyle?: Style;
  sldXml?: string;
  params?: StyleParams;
  validation?: ValidationReport;
  explanation?: string;
  chatHistory: ChatMessage[];
  busy: boolean;
  connected: boolean;
}

interface StyleStoreActions {
  generate(instruction: string, geometryType: string): Promise<void>;
  modify(instruction: string): Promise<void>;
  applyPatch(patches: StylePatch[]): Promise<void>;
  importStyle(style: Style): Promise<void>;
  exportSld(): Promise<string>;  // `export` 是 JS 保留字，使用 exportSld
  setDomain(domain: string): Promise<void>;
}
```

### 4.3 FileService 对外接口

```typescript
interface FileService {
  openGeoJson(): Promise<{ path: string; content: string } | undefined>;
  openSld(): Promise<{ path: string; content: string } | undefined>;
  saveSld(defaultName: string, xml: string): Promise<string | undefined>;
  getRecentFiles(): string[];
}
```

---

## 5. 数据流

### 5.1 生成样式

```
用户输入指令
  → AssistantPanel
  → styleStore.generate()
  → WsClient.send('generate')
  → 后端处理
  ← WsClient 收到 generation_result
  → StyleStore 更新 state
  → MapPreview / InspectorPanel / RulesPanel / ValidationPanel 响应式更新
```

### 5.2 参数化精修

```
用户在 Inspector 修改参数
  → 本地 optimistic 更新 StyleStore.currentStyle
  → 用户点击“应用”
  → styleStore.applyPatch(patches)
  → WsClient.send('apply_patch')
  ← 成功：提交 optimistic 更新
  ← 失败：撤销 optimistic 更新并提示
```

### 5.3 导出 SLD

```
用户点击导出
  → styleStore.export()
  → WsClient.send('export')
  ← 收到 sldXml + validation
  → FileService.saveSld()
  → 落盘
```

---

## 6. 关键规则

### 6.1 WebSocket 启动

- Electron 主进程启动后端并解析 `READY ws://localhost:{port}`。
- 渲染页 URL 为 `file://.../index.html?port={port}`。
- `WsClient` 从 URL 查询参数读取端口后连接。

### 6.2 乐观更新

- `apply_patch` 采用乐观更新，失败时撤销。
- `generate`/`modify` 不乐观更新，等待后端响应。

### 6.3 Map Preview

- 使用 `geostyler-openlayers-parser` 将 `currentStyle` 转为 OpenLayers Style。
- MVP 使用内置示例几何（点/线/面）。
- 明确提示“预览仅供参考，最终效果以 GeoServer/QGIS 为准”。

### 6.4 UI 布局

- 左侧 Assistant：宽度 320px，可折叠。
- 中间 Map Preview：自适应。
- 右侧 Inspector：宽度 420px，可折叠。
- 顶部 Toolbar：高度 48px。
- 底部 StatusBar：高度 28px。

---

## 7. 任务清单（TDD）

- [x] RED: 编写 `WsClient` 连接/请求/超时测试（mock WebSocket）
- [x] GREEN: 实现 `WsClient`
- [x] RED: 编写 `StyleStore` generate/applyPatch/export 状态变化测试
- [x] GREEN: 实现 `StyleStore`
- [x] RED: 编写 `fileService` 调用 Electron API 测试（mock）
- [x] GREEN: 实现 `FileService`
- [ ] RED: 编写 `MapPreview` OpenLayers 初始化测试
- [x] GREEN: 实现 `MapPreview.vue`
- [ ] RED: 编写 `InspectorPanel` 标签切换测试
- [x] GREEN: 实现 `InspectorPanel.vue`
- [ ] RED: 编写 `RulesPanel` 增删改查测试
- [x] GREEN: 实现 `RulesPanel.vue`
- [ ] RED: 编写 Electron 主进程启动/停止后端测试
- [x] GREEN: 实现 `electron/main.ts`
- [ ] REFACTOR: 统一组件 props/emits 命名（后续继续）

---

## 8. 版本历史

| 版本 | 日期 | 说明 |
|---|---|---|
| 1.0.0 | 2026-06-15 | 初始 plan |

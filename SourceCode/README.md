# SLDAgent — 源码说明

本项目是 SLDAgent 的 MVP 实现，包含后端（Node/TypeScript）与前端（Vue 3 + Electron）两部分。

---

## 目录结构

```
SourceCode/
├── backend/          # Node/TypeScript WebSocket 后端
├── frontend/         # Vue 3 + Electron 桌面应用
├── config/           # LLM 与运行时配置（config.json）
└── shared/           # 前后端共享类型与 Filter adapter
```

## 快速开始

### 1. 安装依赖

```bash
cd SourceCode/backend
npm install

cd ../frontend
npm install
```

### 2. 配置 LLM

编辑 `SourceCode/config/config.json`，填入可用的 LLM 端点与 API Key。

### 3. 启动后端

```bash
cd SourceCode/backend
npm run build
node dist/index.js
```

启动后会输出 `READY ws://localhost:{port}`。

### 4. 启动前端（开发模式）

```bash
cd SourceCode/frontend
npm run dev
```

浏览器访问 `http://localhost:5173/?port={后端端口}`。

## 常用命令

### Backend

```bash
npm run dev          # tsx 开发启动
npm run build        # 编译到 dist/
npm run test         # vitest 单元测试
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

### Frontend

```bash
npm run dev          # Vite 开发服务器
npm run build        # 生产构建
npm run typecheck    # vue-tsc --noEmit
npm run electron:dev # Electron 开发模式
npm run electron:build # Electron 打包
```

## 已实现功能

- 自然语言生成样式（WebSocket `generate`）
- 多轮增量修改（WebSocket `modify`）
- 参数化精修（WebSocket `apply_patch`）
- SLD 导入/导出/校验（`import_style` / `export` / `validate`）
- JSON 知识库加载与领域合并
- 前端 Assistant / Map Preview / Inspector / Toolbar / StatusBar 骨架

## 设计文档

见 `Document/` 目录：

- [Document/spec.md](../Document/spec.md)
- [Document/plan-backend-core.md](../Document/plan-backend-core.md)
- [Document/plan-style-builder.md](../Document/plan-style-builder.md)
- [Document/plan-sld-service.md](../Document/plan-sld-service.md)
- [Document/plan-filter-editor.md](../Document/plan-filter-editor.md)
- [Document/plan-frontend.md](../Document/plan-frontend.md)
- [Document/sdd-verify-report-20260615.md](../Document/sdd-verify-report-20260615.md)

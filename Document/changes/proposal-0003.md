# Proposal: electron:dev 一键并发启动前后端与 Electron

> **类型**：Type-A（缺陷修复 / 体验优化）  
> **编号**：0003  
> **状态**：IMPLEMENTED  
> **提出日期**：2026-06-17  
> **实现日期**：2026-06-17  
> **依赖**：proposal-0001（已落地 MVP 源码）、plan-monorepo v1.0.0

---

## 1. 问题描述

当前执行：

```bash
npm run electron:dev
```

会报：

```
(node:12124) electron: Failed to load URL: http://localhost:5173/ with error: ERR_CONNECTION_REFUSED
```

原因是根 `package.json` 的 `electron:dev` 仅构建并启动 Electron 主进程：

```json
"electron:dev": "npm run build --workspace=@sldagent/electron && node SourceCode/electron/scripts/dev.cjs"
```

而 [SourceCode/electron/src/main.ts:68](SourceCode/electron/src/main.ts#L68) 在开发模式下会加载 `http://localhost:5173/`，需要前端 Vite dev server 已经就绪。当前脚本没有自动拉起 `@sldagent/frontend` 与 `@sldagent/backend`，导致必须手动开多个终端分别启动。

## 2. 变更目标

让 `npm run electron:dev` 成为**一条命令**，自动按以下顺序完成：

1. 构建 `@sldagent/electron`。
2. 并发启动 `@sldagent/backend`（WebSocket Agent）。
3. 并发启动 `@sldagent/frontend`（Vite dev server，端口 5173）。
4. 等待 `http://localhost:5173` 可访问后，再启动 Electron。
5. 任一进程退出时，通过 `concurrently --kill-others` 结束其余进程，避免端口残留。

## 3. 变更范围

### [MODIFIED] 根 `package.json`

- 更新 `scripts.electron:dev`。
- 新增 `devDependencies.wait-on`，用于在 Electron 启动前等待 Vite 端口就绪。

## 4. 与 Plan 的对应关系

| Plan | 对应章节 |
| :--- | :--- |
| `plan-monorepo.md` | §3 常用命令 / §4 代码组织，明确 dev 脚本职责 |

## 5. 验收标准

- [x] 执行 `npm run electron:dev` 后，终端显示 backend、frontend、electron 三个进程并发输出。
- [x] Electron 窗口成功加载 `http://localhost:5173/`，不再报 `ERR_CONNECTION_REFUSED`。
- [x] `Ctrl+C` 退出后，backend 与 frontend 进程被一并终止，5173 / 18765 端口无残留。

## 6. 风险与回退

- **wait-on 未安装**：新增 devDependency 后需重新 `npm install`；若安装失败可改为手写 Node 轮询脚本，不引入新依赖。
- **端口占用**：若 5173 已被占用，Vite 因 `strictPort: true` 会启动失败，`wait-on` 超时，electron 不会启动。用户需自行释放端口或修改 `SourceCode/frontend/vite.config.ts` 的 `port`。
- **回退**：将 `scripts.electron:dev` 改回原命令即可。

## 7. 实现备注

- 复用根目录已安装的 `concurrently` 做进程编排。
- Electron 启动命令仍复用 `SourceCode/electron/scripts/dev.cjs`，保留其对 `ELECTRON_RUN_AS_NODE` 的处理。

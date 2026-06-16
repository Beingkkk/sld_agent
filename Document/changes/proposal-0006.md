# Proposal 0006：MapPreview 加载 SourceCode/data 示例 Shapefile 数据

## 状态

- 提案：2026-06-16
- 范围：后端 `SampleDatasetService` / `AgentSession` / 路由协议，前端 `wsClient` / `styleStore` / `useMapPreview` / `MapPreview.vue`
- 状态：提案中

## 摘要

将 `MapPreview.vue` 当前使用的硬编码 EPSG:3857 示例几何替换为 `SourceCode/data` 下 SLD Cookbook 示例 Shapefile 数据，后端扫描并解析 shapefile 后通过 WebSocket 提供 GeoJSON，前端根据当前样式的 `geometry_type` 自动匹配、重投影并缩放视图；无匹配或后端不可用时回退到硬编码示例几何。

## 动机

- MVP 中 `MapPreview.vue` 使用三个硬编码几何（点、线、面）预览样式，无法真实反映 SLD 在实际数据上的效果。
- 项目已在 `SourceCode/data` 下提供 SLD Cookbook 示例 shapefile（`sld_cookbook_point`、`sld_cookbook_line`、`sld_cookbook_polygon`），目前未被利用。
- 渲染进程受浏览器安全模型限制，无法直接遍历本地文件系统；由后端作为权威状态源提供数据集，可保持架构一致性并复用现有 WebSocket 通道。
- 浏览器开发模式与 Electron 模式共用同一后端，测试环境可保持一致。

## 变更内容

### 1. 后端 `SampleDatasetService`

新建 `SourceCode/backend/src/services/SampleDatasetService.ts`：

- 扫描 `SourceCode/data` 下 `sld_cookbook_*` 目录，识别 `.shp` / `.dbf` / `.prj` 文件。
- 使用 `shapefile` 库解析矢量数据，输出 GeoJSON `FeatureCollection` 与 EPSG:4326 bbox。
- 支持通过 `SLD_DATA_DIR` 环境变量覆盖默认数据目录。
- 当目录不存在或解析失败时返回明确错误，供上层回退处理。

### 2. 后端协议扩展

扩展 WebSocket 请求/响应类型（定义于 `SourceCode/shared/messages.ts` 与 `SourceCode/shared/types.ts`）：

| 方向 | 类型 | Payload | 说明 |
|---|---|---|---|
| 请求 | `list_sample_datasets` | `Record<string, never>` | 获取所有示例数据集元数据 |
| 请求 | `get_sample_dataset` | `{ id: string }` | 获取指定数据集的 GeoJSON 与范围 |
| 响应 | `sample_datasets_list` | `{ datasets: SampleDatasetInfo[] }` | 数据集元数据列表 |
| 响应 | `sample_dataset_data` | `SampleDatasetData` | 完整数据集内容 |

新增共享类型：

- `SampleDatasetInfo`
- `SampleDatasetData`
- `GeoJSONFeatureCollection`
- `GeoJSONFeature`
- `GeoJSONGeometry`

在 `AgentSession` 中新增 `listSampleDatasets()` 与 `getSampleDataset(id)`；在 `router.ts` 注册对应消息路由；`server.ts` / `index.ts` 默认数据目录指向 `SourceCode/data`。

### 3. 数据集选择策略

前端 `styleStore` 在 `applyResult` 后根据 `geometry_type` 自动匹配数据集：

- `point` → `sld_cookbook_point`
- `line` / `linestring` → `sld_cookbook_line`
- `polygon` → `sld_cookbook_polygon`

不匹配、后端返回空列表或请求失败时，保持现有硬编码示例几何作为 fallback。

### 4. 前端 MapPreview 渲染

- `wsClient` 新增 `listSampleDatasets()` / `getSampleDataset(id)` 方法。
- `styleStore` 新增 `sampleDatasets`、`activeDataset` 状态与加载/选择方法。
- `useMapPreview` 新增 `createFeaturesFromGeoJSON()` 与 `fitViewToExtent()`：
  - 使用 OpenLayers `GeoJSON` format，指定 `dataProjection: 'EPSG:4326'` 与 `featureProjection: 'EPSG:3857'` 自动重投影。
  - 使用 `transformExtent` 将 bbox 从 EPSG:4326 转到 EPSG:3857 后 `fit` 视图。
- `MapPreview.vue` 挂载时加载数据集列表，监听 `activeDataset` 变化更新 `VectorSource`；无可用数据时回退到硬编码几何。

## 修改文件

- `SourceCode/shared/messages.ts`（编辑）
- `SourceCode/shared/types.ts`（编辑）
- `SourceCode/backend/src/services/SampleDatasetService.ts`（新增）
- `SourceCode/backend/src/session/AgentSession.ts`（编辑）
- `SourceCode/backend/src/session/types.ts`（编辑）
- `SourceCode/backend/src/router.ts`（编辑）
- `SourceCode/backend/src/server.ts`（编辑）
- `SourceCode/backend/src/index.ts`（编辑）
- `SourceCode/backend/src/types.ts`（编辑）
- `SourceCode/backend/package.json`（编辑）
- `SourceCode/backend/tests/unit/SampleDatasetService.test.ts`（新增）
- `SourceCode/backend/tests/e2e/integration.test.ts`（编辑）
- `SourceCode/frontend/src/services/wsClient.ts`（编辑）
- `SourceCode/frontend/src/stores/styleStore.ts`（编辑）
- `SourceCode/frontend/src/composables/useMapPreview.ts`（编辑）
- `SourceCode/frontend/src/components/MapPreview.vue`（编辑）
- `SourceCode/frontend/electron/main.ts`（编辑）
- `SourceCode/frontend/electron/main.test.ts`（编辑）
- `SourceCode/frontend/src/components/MapPreview.test.ts`（编辑）
- `SourceCode/frontend/tests/unit/styleStore.test.ts`（编辑）
- `SourceCode/frontend/tests/unit/useMapPreview.test.ts`（新增）
- `Document/changes/proposal-0006.md`（本文件）
- `Document/changes/proposal-sample-dataset-loading.md`（删除）

## 验证

```bash
# 后端
cd SourceCode/backend
npm run typecheck
npm run test

# 前端
cd SourceCode/frontend
npm run typecheck
npm run test
```

开发过程中可单独运行：

```bash
cd SourceCode/backend
npx vitest run tests/unit/SampleDatasetService.test.ts
npx vitest run tests/e2e/integration.test.ts

cd SourceCode/frontend
npx vitest run src/components/MapPreview.test.ts
npx vitest run tests/unit/styleStore.test.ts
npx vitest run tests/unit/useMapPreview.test.ts
npx vitest run electron/main.test.ts
```

## 风险

- 新增 `shapefile` 依赖增加安装体积与解析复杂度；后续可考虑预先将 shapefile 转换为 `.geojson` 文件，由后端直接读取以去除该依赖。
- Shapefile 解析为同步 I/O，大数据集可能阻塞事件循环；当前示例数据集规模较小，MVP 阶段可接受。
- Electron 生产包需确保 `SourceCode/data` 目录随应用分发，这超出本提案范围，将在 Electron 打包提案中处理。
- 新增 WebSocket 消息类型为向后兼容扩展；旧客户端不会发送这些请求，不会产生协议冲突。

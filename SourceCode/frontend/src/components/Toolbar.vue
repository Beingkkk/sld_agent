<template>
  <div class="toolbar">
    <button @click="importSld">导入 SLD</button>
    <button @click="exportSld">导出 SLD</button>
    <button @click="openSettings">设置</button>
  </div>
</template>

<script setup lang="ts">
import { useStyleStore } from '../stores/styleStore';
import { createFileService } from '../services/fileService';
import SldParser from 'geostyler-sld-parser';

const store = useStyleStore();
const fileService = createFileService();

async function importSld() {
  const file = await fileService.openSld();
  if (!file) return;
  const parser = new SldParser();
  const { output, errors } = await parser.readStyle(file.content);
  if (errors?.length) {
    alert(`导入失败: ${errors.map((e: { message: string }) => e.message).join(', ')}`);
    return;
  }
  if (!output) {
    alert('导入失败: 无法解析 SLD');
    return;
  }
  await store.importStyle(output);
}

async function exportSld() {
  const xml = await store.exportSld();
  await fileService.saveSld(`${store.params?.style_name || 'style'}.sld`, xml);
}

function openSettings() {
  alert('设置面板待实现');
}
</script>

<style scoped>
.toolbar {
  height: 48px;
  background: #16162a;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
}

button {
  background: #2a2a4a;
  border: 1px solid #444;
  color: #e0e0e0;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
}
</style>

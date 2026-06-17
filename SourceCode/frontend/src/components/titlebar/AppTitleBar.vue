<script setup lang="ts">
import WindowControls from './WindowControls.vue';
import { useSLDStore } from '../../store';
import { computed } from 'vue';

const store = useSLDStore();

const backendStatus = computed(() => store.backendStatus);

const backendStatusMeta = computed(() => {
  switch (backendStatus.value) {
    case 'connected':
      return { label: 'Agent 已连接', dotClass: 'bg-green-500' };
    case 'connecting':
      return { label: 'Agent 连接中', dotClass: 'bg-amber-500' };
    case 'error':
      return { label: 'Agent 离线', dotClass: 'bg-accent-red' };
    default:
      return { label: 'Agent 未启动', dotClass: 'bg-text-tertiary' };
  }
});

async function handleImport() {
  if (window.electronAPI?.openSld) {
    try {
      const result = await window.electronAPI.openSld();
      if (result?.content) {
        await store.importSLD(result.content);
      }
    } catch (e) {
      console.error('Import failed:', e);
    }
  } else {
    // Fallback for browser dev mode
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml,.sld';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        await store.importSLD(text);
      }
    };
    input.click();
  }
}

async function handleExport() {
  try {
    const xml = await store.exportSLD();
    if (window.electronAPI?.saveSld) {
      const result = await window.electronAPI.saveSld(xml);
      if (result?.filePath && window.electronAPI?.showItemInFolder) {
        await window.electronAPI.showItemInFolder(result.filePath);
      }
    } else {
      // Fallback for browser dev mode
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'style.sld';
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    console.error('Export failed:', e);
  }
}
</script>

<template>
  <div class="h-10 flex items-center justify-between bg-bg-secondary border-b border-border-default select-none"
       style="-webkit-app-region: drag;">
    <!-- Left: Brand + Actions -->
    <div class="flex items-center gap-3 px-3" style="-webkit-app-region: no-drag;">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-accent-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        <span class="font-brand font-semibold text-sm text-text-primary">SLDAgent</span>
      </div>
      <div class="w-px h-5 bg-border-default mx-1"></div>
      <button class="btn-dark text-xs py-1" @click="handleImport">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        导入
      </button>
      <button class="btn-dark text-xs py-1" @click="handleExport">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        导出
      </button>
    </div>

    <!-- Right: Backend Status + Window Controls -->
    <div class="flex items-center gap-3 px-3" style="-webkit-app-region: no-drag;">
      <div
        class="flex items-center gap-1.5 text-xs text-text-secondary"
        :title="backendStatusMeta.label"
      >
        <span class="w-2 h-2 rounded-full" :class="backendStatusMeta.dotClass" />
        <span class="hidden sm:inline">{{ backendStatusMeta.label }}</span>
      </div>
      <WindowControls />
    </div>
  </div>
</template>

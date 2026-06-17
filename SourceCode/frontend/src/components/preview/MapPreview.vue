<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useSLDStore } from '../../store';
import {
  applyPreviewStyle,
  buildSymbolizerPreviewStyle,
  getGeoStylerStyle,
  type PreviewGeometryType,
} from '../../services/preview-style';
import { usePreviewMap } from '../../composables/usePreviewMap';

const store = useSLDStore();

const mapContainer = ref<HTMLDivElement | null>(null);
const manualGeometryType = ref<PreviewGeometryType | null>(null);

const { isLoading, loadError, loadData, setStyle } = usePreviewMap(mapContainer, {
  onReady: refresh,
});

const activeGeometryType = computed<PreviewGeometryType>(() => {
  if (manualGeometryType.value) return manualGeometryType.value;
  return store.previewGeometryType;
});

async function applyStyle() {
  const fullStyle = getGeoStylerStyle(store.transformResult);
  const previewStyle =
    store.selectedNode?.type === 'Symbolizer'
      ? buildSymbolizerPreviewStyle(store.selectedNode) ?? fullStyle
      : fullStyle;
  const result = await applyPreviewStyle(previewStyle, activeGeometryType.value);
  setStyle(result.style);
}

async function refresh() {
  await loadData(activeGeometryType.value);
  await applyStyle();
}

function setGeometryType(type: PreviewGeometryType) {
  manualGeometryType.value = type;
  refresh();
}

// 当 SLD 树变化导致 GeoStyler Style 变化时，重新应用样式
watch(() => store.transformResult, applyStyle);

// 当树中选中节点变化导致几何类型变化时，重新加载示例数据并应用样式
watch(() => store.previewGeometryType, () => {
  manualGeometryType.value = null;
  refresh();
});

// 当在同一 Rule 下的同类型 Symbolizer 之间切换时，transformResult 与
// previewGeometryType 都不会变化，但选中节点已改变，需要单独监听并更新预览。
watch(() => store.selectedPath, applyStyle);
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-border-default bg-bg-secondary">
      <span class="text-xs font-medium text-text-secondary uppercase tracking-wider">地图预览</span>
      <div class="flex items-center gap-1">
        <button
          class="px-2 py-1 text-xs rounded transition-colors"
          :class="activeGeometryType === 'Mark' ? 'bg-accent-teal-dim text-accent-teal' : 'text-text-secondary hover:bg-bg-hover'"
          @click="setGeometryType('Mark')"
        >
          点
        </button>
        <button
          class="px-2 py-1 text-xs rounded transition-colors"
          :class="activeGeometryType === 'Line' ? 'bg-accent-teal-dim text-accent-teal' : 'text-text-secondary hover:bg-bg-hover'"
          @click="setGeometryType('Line')"
        >
          线
        </button>
        <button
          class="px-2 py-1 text-xs rounded transition-colors"
          :class="activeGeometryType === 'Fill' ? 'bg-accent-teal-dim text-accent-teal' : 'text-text-secondary hover:bg-bg-hover'"
          @click="setGeometryType('Fill')"
        >
          面
        </button>
        <button
          class="px-2 py-1 text-xs rounded transition-colors"
          :class="activeGeometryType === 'Text' ? 'bg-accent-teal-dim text-accent-teal' : 'text-text-secondary hover:bg-bg-hover'"
          @click="setGeometryType('Text')"
        >
          文本
        </button>
      </div>
    </div>

    <!-- Map Container -->
    <div class="flex-1 min-h-0 bg-bg-primary relative preview-grid">
      <div ref="mapContainer" class="absolute inset-0" />

      <!-- Loading -->
      <div
        v-if="isLoading"
        class="absolute inset-0 flex items-center justify-center bg-bg-primary/80 z-10"
      >
        <div class="flex items-center gap-2 text-text-secondary text-xs">
          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          加载示例数据中…
        </div>
      </div>

      <!-- Error -->
      <div
        v-if="loadError"
        class="absolute top-3 left-3 right-3 z-10 pointer-events-none"
      >
        <div class="bg-accent-red/10 border border-accent-red/30 text-accent-red text-xs px-3 py-2 rounded pointer-events-auto inline-block max-w-full">
          <span class="font-medium">预览异常：</span>
          {{ loadError }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-grid {
  background-color: #0d1117;
  background-image:
    linear-gradient(rgba(45, 212, 191, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45, 212, 191, 0.04) 1px, transparent 1px);
  background-size: 40px 40px;
}

:deep(.ol-control) {
  background-color: rgba(13, 17, 23, 0.8);
  border-radius: 4px;
}

:deep(.ol-control button) {
  background-color: #21262d;
  color: #e6edf3;
  border: 1px solid #30363d;
}

:deep(.ol-control button:hover) {
  background-color: #30363d;
}
</style>

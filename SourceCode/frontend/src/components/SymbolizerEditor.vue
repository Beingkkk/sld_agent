<template>
  <div class="symbolizer-editor">
    <div v-if="!geometryType" class="empty">当前没有可编辑的符号化参数</div>
    <div v-else class="form">
      <div class="field" v-for="field in fields" :key="field.key">
        <label>{{ field.label }}</label>
        <input
          v-if="field.type === 'text'"
          :value="params?.[field.key]"
          @change="update(field.key, ($event.target as HTMLInputElement).value)"
        />
        <input
          v-else-if="field.type === 'number'"
          type="number"
          :value="params?.[field.key]"
          @change="update(field.key, Number(($event.target as HTMLInputElement).value))"
        />
        <select
          v-else-if="field.type === 'select'"
          :value="params?.[field.key]"
          @change="update(field.key, ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useStyleStore } from '../stores/styleStore';
import type { StyleParams } from '@shared/types';

const store = useStyleStore();

const params = computed(() => store.params);
const geometryType = computed(() => params.value?.geometry_type);

interface FieldDef {
  key: keyof StyleParams;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
}

const fields = computed<FieldDef[]>(() => {
  switch (geometryType.value) {
    case 'point':
      return [
        { key: 'well_known_name', label: '形状', type: 'select', options: ['circle', 'square', 'triangle', 'star', 'cross', 'x'] },
        { key: 'size', label: '大小', type: 'number' },
        { key: 'fill_color', label: '填充色', type: 'text' },
        { key: 'stroke_color', label: '描边色', type: 'text' },
        { key: 'stroke_width', label: '描边宽', type: 'number' },
      ];
    case 'line':
      return [
        { key: 'stroke_color', label: '颜色', type: 'text' },
        { key: 'stroke_width', label: '宽度', type: 'number' },
        { key: 'stroke_opacity', label: '透明度', type: 'number' },
        { key: 'stroke_dasharray', label: '虚线', type: 'text' },
      ];
    case 'polygon':
      return [
        { key: 'fill_color', label: '填充色', type: 'text' },
        { key: 'fill_opacity', label: '透明度', type: 'number' },
        { key: 'stroke_color', label: '描边色', type: 'text' },
        { key: 'stroke_width', label: '描边宽', type: 'number' },
      ];
    case 'raster':
      return [];
    default:
      return [];
  }
});

function update(key: keyof StyleParams, value: unknown) {
  store.applyPatch([{ op: 'replace', path: `/${String(key)}`, value }]);
}
</script>

<style scoped>
.symbolizer-editor {
  padding: 8px;
}
.empty {
  color: #888;
}
.field {
  margin-bottom: 10px;
}
.field label {
  display: block;
  color: #aaa;
  margin-bottom: 4px;
}
.field input,
.field select {
  width: 100%;
  background: #222;
  color: #fff;
  border: 1px solid #444;
  padding: 6px;
  border-radius: 4px;
}
</style>

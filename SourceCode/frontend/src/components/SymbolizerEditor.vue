<template>
  <div class="symbolizer-editor">
    <div v-if="!geometryType" class="empty">当前没有可编辑的符号化参数</div>
    <div v-else class="params-editor">
      <div class="params-section">
        <div class="params-section-title">{{ sectionTitle }}</div>
        <div
          v-for="field in fields"
          :key="field.key"
          :class="['params-field', { 'params-field-row': field.row } ]"
        >
          <label class="form-label">{{ field.label }}</label>
          <div v-if="field.type === 'color'" class="color-input-wrapper">
            <input
              type="color"
              :value="params?.[field.key] as string"
              @change="update(field.key, (($event.target as HTMLInputElement).value))"
            />
            <input
              type="text"
              class="form-input"
              :value="params?.[field.key] as string"
              @change="update(field.key, (($event.target as HTMLInputElement).value))"
              placeholder="#RRGGBB"
            />
          </div>
          <input
            v-else-if="field.type === 'text'"
            class="form-input"
            type="text"
            :value="params?.[field.key]"
            @change="update(field.key, (($event.target as HTMLInputElement).value))"
          />
          <input
            v-else-if="field.type === 'number'"
            class="form-input"
            type="number"
            :value="params?.[field.key]"
            @change="update(field.key, Number(($event.target as HTMLInputElement).value))"
            :step="field.step ?? 1"
          />
          <select
            v-else-if="field.type === 'select'"
            class="form-select"
            :value="params?.[field.key]"
            @change="update(field.key, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </div>
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
  type: 'text' | 'number' | 'select' | 'color';
  options?: string[];
  step?: number;
  row?: boolean;
}

const sectionTitle = computed(() => {
  switch (geometryType.value) {
    case 'point': return '点符号';
    case 'line': return '线符号';
    case 'polygon': return '面符号';
    default: return '符号参数';
  }
});

const fields = computed<FieldDef[]>(() => {
  switch (geometryType.value) {
    case 'point':
      return [
        { key: 'well_known_name', label: '形状', type: 'select', options: ['circle', 'square', 'triangle', 'star', 'cross', 'x'] },
        { key: 'size', label: '大小', type: 'number' },
        { key: 'fill_color', label: '填充色', type: 'color' },
        { key: 'stroke_color', label: '描边色', type: 'color' },
        { key: 'stroke_width', label: '描边宽', type: 'number', step: 0.5 },
      ];
    case 'line':
      return [
        { key: 'stroke_color', label: '颜色', type: 'color' },
        { key: 'stroke_width', label: '宽度', type: 'number', step: 0.5 },
        { key: 'stroke_opacity', label: '透明度', type: 'number', step: 0.1 },
        { key: 'stroke_dasharray', label: '虚线', type: 'text' },
      ];
    case 'polygon':
      return [
        { key: 'fill_color', label: '填充色', type: 'color' },
        { key: 'fill_opacity', label: '透明度', type: 'number', step: 0.1 },
        { key: 'stroke_color', label: '描边色', type: 'color' },
        { key: 'stroke_width', label: '描边宽', type: 'number', step: 0.5 },
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
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.params-empty,
.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--dim);
  font-size: 12px;
  padding: 40px 20px;
}

.params-section {
  padding: 14px;
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.params-section-title {
  font-size: 11px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 12px;
  font-weight: 600;
}

.params-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.params-field:last-child {
  margin-bottom: 0;
}

.params-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-label {
  font-size: 10px;
  color: var(--dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
}

.form-input,
.form-select {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
  outline: none;
}

.form-input:focus,
.form-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-dim);
}

.color-input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-input-wrapper input[type="color"] {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
}
</style>

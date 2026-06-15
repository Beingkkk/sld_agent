<template>
  <div class="symbolizer-editor">
    <div v-if="!symbolizer" class="empty">当前没有可编辑的符号化参数</div>
    <div v-else class="form">
      <div class="field" v-for="field in fields" :key="field.key">
        <label>{{ field.label }}</label>
        <input
          v-if="field.type === 'text'"
          :value="symbolizer[field.key]"
          @change="update(field.key, ($event.target as HTMLInputElement).value)"
        />
        <input
          v-else-if="field.type === 'number'"
          type="number"
          :value="symbolizer[field.key]"
          @change="update(field.key, Number(($event.target as HTMLInputElement).value))"
        />
        <select
          v-else-if="field.type === 'select'"
          :value="symbolizer[field.key]"
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

const store = useStyleStore();

const symbolizer = computed(() => {
  const style = store.currentStyle;
  return style?.rules?.[0]?.symbolizers?.[0] as Record<string, unknown> | undefined;
});

const kind = computed(() => symbolizer.value?.kind as string);

const fields = computed(() => {
  switch (kind.value) {
    case 'Mark':
      return [
        { key: 'wellKnownName', label: '形状', type: 'select' as const, options: ['circle', 'square', 'triangle', 'star', 'cross', 'x'] },
        { key: 'size', label: '大小', type: 'number' as const },
        { key: 'color', label: '填充色', type: 'text' as const },
        { key: 'strokeColor', label: '描边色', type: 'text' as const },
        { key: 'strokeWidth', label: '描边宽', type: 'number' as const },
      ];
    case 'Line':
      return [
        { key: 'color', label: '颜色', type: 'text' as const },
        { key: 'width', label: '宽度', type: 'number' as const },
        { key: 'opacity', label: '透明度', type: 'number' as const },
        { key: 'dasharray', label: '虚线', type: 'text' as const },
      ];
    case 'Fill':
      return [
        { key: 'color', label: '填充色', type: 'text' as const },
        { key: 'opacity', label: '透明度', type: 'number' as const },
        { key: 'outlineColor', label: '描边色', type: 'text' as const },
        { key: 'outlineWidth', label: '描边宽', type: 'number' as const },
      ];
    case 'Text':
      return [
        { key: 'label', label: '标注字段', type: 'text' as const },
        { key: 'size', label: '字号', type: 'number' as const },
        { key: 'color', label: '颜色', type: 'text' as const },
      ];
    default:
      return [];
  }
});

function update(key: string, value: unknown) {
  const style = store.currentStyle;
  if (!style) return;
  const sym = { ...(symbolizer.value || {}), [key]: value };
  const rule = { ...style.rules[0], symbolizers: [sym] };
  const updated = { ...style, rules: [rule, ...style.rules.slice(1)] };
  // TODO: emit patches instead of mutating store directly
  store.applyPatch([{ op: 'replace', path: '/rules/0/symbolizers/0', value: sym }]);
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

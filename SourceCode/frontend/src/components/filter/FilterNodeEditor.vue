<script setup lang="ts">
import { computed } from 'vue';
import type { FilterNode, FilterNodeType, FilterComparisonOperator } from '@sldagent/core';

const props = defineProps<{
  modelValue: FilterNode | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: FilterNode): void;
}>();

const nodeTypes: { value: FilterNodeType; label: string }[] = [
  { value: 'and', label: 'AND（全部满足）' },
  { value: 'or', label: 'OR（任一满足）' },
  { value: 'not', label: 'NOT（取反）' },
  { value: 'comparison', label: '比较条件' },
];

const operators: { value: FilterComparisonOperator; label: string }[] = [
  { value: '==', label: '等于（=）' },
  { value: '!=', label: '不等于（<>）' },
  { value: '<', label: '小于' },
  { value: '<=', label: '小于等于' },
  { value: '>', label: '大于' },
  { value: '>=', label: '大于等于' },
  { value: '*=', label: 'LIKE' },
];

const nodeType = computed({
  get: () => props.modelValue?.type ?? 'comparison',
  set: (type: FilterNodeType) => {
    if (!props.modelValue) return;
    const base = { ...props.modelValue, type };
    if (type === 'comparison') {
      base.operator = base.operator || '==';
      base.propertyName = base.propertyName ?? '';
      base.value = base.value ?? '';
      delete base.children;
    } else {
      base.children = base.children?.length ? base.children : [createDefaultChild()];
      delete base.operator;
      delete base.propertyName;
      delete base.value;
    }
    emit('update:modelValue', base as FilterNode);
  },
});

function createDefaultChild(): FilterNode {
  return {
    id: `filter_child_${Date.now().toString(36)}`,
    type: 'comparison',
    operator: '==',
    propertyName: '',
    value: '',
  };
}

function updateComparison(field: 'operator' | 'propertyName' | 'value', value: string) {
  if (!props.modelValue) return;
  if (props.modelValue.type !== 'comparison') return;
  const updated: FilterNode = { ...props.modelValue };
  if (field === 'value') {
    // 尝试解析为数字
    const num = Number(value);
    updated.value = value === '' ? '' : !isNaN(num) && value.trim() !== '' ? num : value;
  } else {
    (updated as any)[field] = value;
  }
  emit('update:modelValue', updated);
}

const isComparison = computed(() => props.modelValue?.type === 'comparison');
const comparisonNode = computed(() => props.modelValue as FilterNode | null);
</script>

<template>
  <div class="space-y-3">
    <div class="space-y-1">
      <label class="text-xs text-text-secondary">节点类型</label>
      <select
        v-model="nodeType"
        :disabled="disabled"
        class="w-full bg-bg-primary text-text-primary text-sm rounded border border-border-default px-2 py-1.5 focus:border-accent-primary focus:outline-none"
      >
        <option v-for="opt in nodeTypes" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <template v-if="isComparison && comparisonNode">
      <div class="space-y-1">
        <label class="text-xs text-text-secondary">属性名</label>
        <input
          type="text"
          :value="comparisonNode.propertyName"
          :disabled="disabled"
          placeholder="例如：name"
          class="w-full bg-bg-primary text-text-primary text-sm rounded border border-border-default px-2 py-1.5 focus:border-accent-primary focus:outline-none"
          @input="updateComparison('propertyName', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div class="space-y-1">
        <label class="text-xs text-text-secondary">运算符</label>
        <select
          :value="comparisonNode.operator"
          :disabled="disabled"
          class="w-full bg-bg-primary text-text-primary text-sm rounded border border-border-default px-2 py-1.5 focus:border-accent-primary focus:outline-none"
          @change="updateComparison('operator', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="opt in operators" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="space-y-1">
        <label class="text-xs text-text-secondary">值</label>
        <input
          type="text"
          :value="comparisonNode.value"
          :disabled="disabled"
          placeholder="例如：school"
          class="w-full bg-bg-primary text-text-primary text-sm rounded border border-border-default px-2 py-1.5 focus:border-accent-primary focus:outline-none"
          @input="updateComparison('value', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </template>

    <div v-else-if="modelValue" class="text-xs text-text-tertiary">
      {{ modelValue.type === 'not' ? 'NOT 节点只能包含一个子节点' : '子节点请在左侧树中添加或删除' }}
    </div>
  </div>
</template>

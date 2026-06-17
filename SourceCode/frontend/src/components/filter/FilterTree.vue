<script setup lang="ts">
import type { FilterNode } from '@sldagent/core';

interface Props {
  node: FilterNode;
  selectedId: string | null;
  disabled?: boolean;
  depth?: number;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  depth: 0,
});

const emit = defineEmits<{
  (e: 'select', id: string): void;
}>();

const typeLabels: Record<FilterNode['type'], string> = {
  and: 'AND',
  or: 'OR',
  not: 'NOT',
  comparison: '条件',
};

function isSelected(): boolean {
  return props.selectedId === props.node.id;
}

function onSelect() {
  if (props.disabled) return;
  emit('select', props.node.id);
}

function comparisonSummary(node: FilterNode): string {
  const opLabels: Record<string, string> = {
    '==': '=',
    '!=': '<>',
    '<': '<',
    '<=': '<=',
    '>': '>',
    '>=': '>=',
    '*=': 'LIKE',
  };
  const op = opLabels[node.operator ?? ''] ?? node.operator ?? '?';
  const val = node.value === undefined ? '?' : String(node.value);
  return `${node.propertyName ?? '?'} ${op} ${val}`;
}
</script>

<template>
  <div
    class="filter-tree-node"
    :style="{ paddingLeft: `${depth * 12}px` }"
  >
    <div
      class="flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors"
      :class="{
        'bg-accent-primary/20 text-accent-primary': isSelected(),
        'hover:bg-bg-tertiary text-text-primary': !isSelected() && !disabled,
        'text-text-tertiary cursor-not-allowed': disabled,
      }"
      @click.stop="onSelect"
    >
      <span class="text-xs font-medium px-1.5 py-0.5 rounded bg-bg-tertiary border border-border-default">
        {{ typeLabels[node.type] }}
      </span>
      <span v-if="node.type === 'comparison'" class="text-sm font-mono truncate">
        {{ comparisonSummary(node) }}
      </span>
      <span v-else class="text-xs text-text-secondary">
        {{ node.children?.length ?? 0 }} 个子节点
      </span>
    </div>

    <div v-if="node.children && node.children.length > 0" class="mt-0.5">
      <FilterTree
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :selected-id="selectedId"
        :disabled="disabled"
        :depth="depth + 1"
        @select="emit('select', $event)"
      />
    </div>
  </div>
</template>

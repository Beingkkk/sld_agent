<template>
  <div class="filter-node-editor">
    <div v-if="node.type === 'comparison'" class="comparison">
      <select :value="node.operator" @change="update('operator', ($event.target as HTMLSelectElement).value)">
        <option v-for="op in comparisonOps" :key="op" :value="op">{{ op }}</option>
      </select>
      <input :value="node.property" @change="update('property', ($event.target as HTMLInputElement).value)" placeholder="字段" />
      <input
        v-if="node.operator !== 'between' && node.operator !== 'in'"
        :value="String(node.value)"
        @change="update('value', ($event.target as HTMLInputElement).value)"
        placeholder="值"
      />
      <span v-else class="hint">数组值请在父节点中编辑</span>
      <span v-if="error" class="error">{{ error }}</span>
    </div>

    <div v-else-if="node.type === 'logical'" class="logical">
      <select :value="node.operator" @change="update('operator', ($event.target as HTMLSelectElement).value)">
        <option value="and">AND</option>
        <option value="or">OR</option>
      </select>
      <div class="children">
        <FilterNodeEditor
          v-for="(child, idx) in node.children"
          :key="child.id"
          v-model:node="node.children[idx]"
          :data-schema="dataSchema"
        />
      </div>
    </div>

    <div v-else-if="node.type === 'not'" class="not">
      <span>NOT</span>
      <FilterNodeEditor v-model:node="node.child" :data-schema="dataSchema" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DataSchema } from '@shared/types';
import type { FilterNode, ComparisonOperator } from '@shared/filter';
import { validateComparison } from '@shared/filter';

const props = defineProps<{
  node: FilterNode;
  dataSchema?: DataSchema;
}>();

const emit = defineEmits<{
  (e: 'update:node', value: FilterNode): void;
}>();

const comparisonOps: ComparisonOperator[] = ['==', '!=', '<', '<=', '>', '>=', 'like', 'ilike', 'between', 'in'];

const error = computed(() => {
  if (props.node.type !== 'comparison') return null;
  return validateComparison(props.node, props.dataSchema);
});

function update(key: string, value: unknown) {
  emit('update:node', { ...props.node, [key]: value } as FilterNode);
}
</script>

<style scoped>
.filter-node-editor {
  margin: 4px 0;
  padding: 6px;
  background: #1a1a1a;
  border-radius: 4px;
}
.comparison,
.logical,
.not {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.children {
  width: 100%;
  padding-left: 16px;
  border-left: 2px solid #333;
  margin-top: 6px;
}
input,
select {
  background: #222;
  color: #fff;
  border: 1px solid #444;
  padding: 4px 6px;
  border-radius: 4px;
}
.error {
  color: #f87171;
  font-size: 11px;
}
.hint {
  color: #888;
  font-size: 11px;
}
</style>

<template>
  <div class="filter-editor">
    <div v-if="isEmpty" class="empty">当前规则没有过滤条件</div>
    <FilterNodeEditor v-else v-model:node="rootNode" :data-schema="dataSchema" />
    <div class="cql-preview" v-if="cql">
      <div class="cql-preview-label">CQL 预览</div>
      <div>{{ cql }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DataSchema } from '@shared/types';
import type { Filter } from 'geostyler-style';
import { toFilterNode, toGeoStylerFilter, toCql } from '@shared/filter';
import type { FilterNode } from '@shared/filter';
import FilterNodeEditor from './FilterNodeEditor.vue';

const props = defineProps<{
  filter?: Filter;
  dataSchema?: DataSchema;
}>();

const emit = defineEmits<{
  (e: 'update:filter', value: Filter): void;
}>();

const rootNode = computed({
  get: () => toFilterNode(props.filter as unknown as import('@shared/filter').GeoStylerFilter),
  set: (node: FilterNode) => emit('update:filter', toGeoStylerFilter(node) as unknown as Filter),
});

const isEmpty = computed(() => !props.filter || (Array.isArray(props.filter) && props.filter.length === 0));

const cql = computed(() => toCql(props.filter as unknown as import('@shared/filter').GeoStylerFilter));
</script>

<style scoped>
.filter-editor {
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

.cql-preview {
  padding: 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  line-height: 1.7;
}

.cql-preview-label {
  font-size: 10px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
  font-weight: 600;
}
</style>

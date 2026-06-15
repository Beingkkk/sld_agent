<template>
  <div class="filter-editor">
    <div v-if="!rootNode" class="empty">当前规则没有过滤条件</div>
    <FilterNodeEditor v-else v-model:node="rootNode" :data-schema="dataSchema" />
    <div class="cql-preview" v-if="cql">
      <strong>CQL:</strong> {{ cql }}
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
  filter: Filter;
  dataSchema?: DataSchema;
}>();

const emit = defineEmits<{
  (e: 'update:filter', value: Filter): void;
}>();

const rootNode = computed({
  get: () => toFilterNode(props.filter as unknown as import('@shared/filter').GeoStylerFilter),
  set: (node: FilterNode) => emit('update:filter', toGeoStylerFilter(node) as unknown as Filter),
});

const cql = computed(() => toCql(props.filter as unknown as import('@shared/filter').GeoStylerFilter));
</script>

<style scoped>
.filter-editor {
  padding: 8px;
}
.empty {
  color: #888;
}
.cql-preview {
  margin-top: 12px;
  padding: 8px;
  background: #1a1a1a;
  border-radius: 4px;
  color: #aaa;
  font-family: monospace;
  font-size: 12px;
}
</style>

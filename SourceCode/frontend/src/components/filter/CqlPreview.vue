<script setup lang="ts">
import { computed } from 'vue';
import { CqlWriter, type FilterNode } from '@sldagent/core';

const props = defineProps<{
  filter: FilterNode | null;
}>();

const cql = computed(() => {
  if (!props.filter) return '';
  try {
    return CqlWriter.write(props.filter);
  } catch {
    return '';
  }
});
</script>

<template>
  <div class="bg-bg-tertiary rounded-card border border-border-default p-3">
    <div class="text-xs text-text-secondary mb-1">CQL 预览</div>
    <div class="font-mono text-sm text-text-primary break-all min-h-[1.5rem]">
      {{ cql || '（无 Filter）' }}
    </div>
  </div>
</template>

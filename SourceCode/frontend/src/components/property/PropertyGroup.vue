<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  title: string;
  defaultExpanded?: boolean;
}>();

const isExpanded = ref(props.defaultExpanded !== false);

function toggle() {
  isExpanded.value = !isExpanded.value;
}
</script>

<template>
  <div class="border border-border-default rounded-card overflow-hidden mb-3">
    <button
      class="w-full flex items-center justify-between px-4 py-2.5 bg-bg-tertiary hover:bg-bg-hover transition-colors"
      @click="toggle"
    >
      <span class="text-sm font-medium text-text-primary">{{ title }}</span>
      <svg
        class="w-4 h-4 text-text-tertiary transition-transform"
        :class="isExpanded ? 'rotate-180' : ''"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
    <div v-if="isExpanded" class="p-4 space-y-3">
      <slot />
    </div>
  </div>
</template>

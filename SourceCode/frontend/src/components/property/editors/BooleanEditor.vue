<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).checked);
}
</script>

<template>
  <label class="flex items-center gap-2 cursor-pointer">
    <input
      type="checkbox"
      class="w-4 h-4 rounded border border-border-default bg-bg-tertiary text-accent-teal focus:ring-accent-teal/30 focus:ring-1"
      :checked="modelValue"
      @change="onChange"
    />
    <span class="text-sm text-text-secondary">启用</span>
  </label>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: number;
  min?: number;
  max?: number;
  step?: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
}>();

function onInput(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value);
  if (!isNaN(val)) {
    emit('update:modelValue', val);
  }
}

const percentage = computed(() => {
  return Math.round((props.modelValue * 100));
});

import { computed } from 'vue';
</script>

<template>
  <div class="flex items-center gap-2">
    <input
      type="range"
      class="flex-1 h-1.5 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent-teal"
      :value="modelValue"
      :min="min ?? 0"
      :max="max ?? 1"
      :step="step || 0.1"
      @input="onInput"
    />
    <span class="text-sm text-text-secondary w-12 text-right">{{ percentage }}%</span>
  </div>
</template>

<style scoped>
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #2dd4bf;
  cursor: pointer;
  border: 2px solid #0d1117;
}

input[type="range"]::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #2dd4bf;
  cursor: pointer;
  border: 2px solid #0d1117;
}
</style>

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
</script>

<template>
  <input
    type="number"
    class="input-dark w-full"
    :value="modelValue"
    :min="min"
    :max="max"
    :step="step || 1"
    @input="onInput"
  />
</template>

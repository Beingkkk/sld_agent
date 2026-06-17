<script setup lang="ts">
const props = defineProps<{
  modelValue: number[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: number[]): void;
}>();

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  const arr = val.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
  emit('update:modelValue', arr);
}
</script>

<template>
  <input
    type="text"
    class="input-dark w-full"
    :value="modelValue.join(', ')"
    @input="onInput"
  />
</template>

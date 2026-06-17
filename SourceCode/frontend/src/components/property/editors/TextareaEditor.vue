<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  rows?: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <textarea
    class="input-dark w-full resize-none"
    :rows="rows || 3"
    :value="modelValue"
    @input="onInput"
  />
</template>

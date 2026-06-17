<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
}
</script>

<template>
  <input
    type="text"
    class="input-dark w-full"
    :value="modelValue"
    :placeholder="placeholder || ''"
    @input="onInput"
  />
</template>

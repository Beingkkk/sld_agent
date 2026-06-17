<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
}
</script>

<template>
  <div class="flex items-center gap-2">
    <input
      type="color"
      class="w-8 h-8 rounded cursor-pointer border border-border-default bg-transparent"
      :value="modelValue"
      @input="onInput"
    />
    <input
      type="text"
      class="input-dark flex-1"
      :value="modelValue"
      @input="onInput"
    />
  </div>
</template>

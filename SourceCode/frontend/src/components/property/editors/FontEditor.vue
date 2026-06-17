<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  options?: string[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value);
}
</script>

<template>
  <select class="input-dark w-full cursor-pointer" :value="modelValue" @change="onChange">
    <option v-for="font in (options || ['Arial', 'Verdana', 'Sans-serif', 'Courier New', 'Monospace', 'Times New Roman', 'Georgia', 'Serif'])" :key="font" :value="font">
      {{ font }}
    </option>
  </select>
</template>

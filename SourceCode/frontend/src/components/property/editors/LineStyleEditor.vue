<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
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
    <option value="solid">实线</option>
    <option value="dashed">虚线</option>
    <option value="dotted">点线</option>
  </select>
</template>

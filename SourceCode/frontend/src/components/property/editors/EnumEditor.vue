<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  options: string[] | { label: string; value: string }[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value);
}

function getOptionLabel(opt: string | { label: string; value: string }): string {
  if (typeof opt === 'string') return opt;
  return opt.label;
}

function getOptionValue(opt: string | { label: string; value: string }): string {
  if (typeof opt === 'string') return opt;
  return opt.value;
}
</script>

<template>
  <select class="input-dark w-full cursor-pointer" :value="modelValue" @change="onChange">
    <option
      v-for="opt in options"
      :key="getOptionValue(opt)"
      :value="getOptionValue(opt)"
    >
      {{ getOptionLabel(opt) }}
    </option>
  </select>
</template>

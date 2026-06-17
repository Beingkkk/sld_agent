<script setup lang="ts">
import { ref, onMounted } from 'vue';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const properties = ref<string[]>(['name']);

onMounted(async () => {
  try {
    const response = await fetch('/sample/sld_cookbook_point.geojson');
    const data = await response.json();
    if (data.features?.[0]?.properties) {
      properties.value = Object.keys(data.features[0].properties);
    }
  } catch {
    // Fallback
  }
});

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value);
}
</script>

<template>
  <select class="input-dark w-full cursor-pointer" :value="modelValue" @change="onChange">
    <option v-for="prop in properties" :key="prop" :value="prop">
      {{ prop }}
    </option>
  </select>
</template>

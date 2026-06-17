<script setup lang="ts">
import { ref, onMounted } from 'vue';
import sampleUrl from '@data/sample/sld_cookbook_point.geojson?url';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const properties = ref<string[]>(['name']);

onMounted(async () => {
  try {
    const response = await fetch(sampleUrl);
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

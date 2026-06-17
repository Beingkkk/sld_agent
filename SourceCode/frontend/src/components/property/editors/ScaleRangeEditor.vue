<script setup lang="ts">
import { computed } from 'vue';

interface ScaleRangeValue {
  min: number | null;
  max: number | null;
}

const props = defineProps<{
  modelValue: ScaleRangeValue;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: ScaleRangeValue): void;
}>();

const isUnlimited = computed(() => props.modelValue.min === null && props.modelValue.max === null);

function updateMin(val: string) {
  const num = val === '' ? null : parseFloat(val);
  emit('update:modelValue', { ...props.modelValue, min: num });
}

function updateMax(val: string) {
  const num = val === '' ? null : parseFloat(val);
  emit('update:modelValue', { ...props.modelValue, max: num });
}

function toggleUnlimited() {
  if (isUnlimited.value) {
    emit('update:modelValue', { min: 1000, max: 50000 });
  } else {
    emit('update:modelValue', { min: null, max: null });
  }
}
</script>

<template>
  <div class="space-y-2">
    <label class="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        class="w-4 h-4 rounded border border-border-default bg-bg-tertiary text-accent-teal focus:ring-accent-teal/30 focus:ring-1"
        :checked="isUnlimited"
        @change="toggleUnlimited"
      />
      <span class="text-sm text-text-secondary">不限制比例尺</span>
    </label>
    <div v-if="!isUnlimited" class="flex items-center gap-2">
      <div class="flex-1">
        <label class="text-xs text-text-tertiary block mb-1">最小</label>
        <input
          type="number"
          class="input-dark w-full"
          :value="modelValue.min ?? ''"
          @input="updateMin(($event.target as HTMLInputElement).value)"
        />
      </div>
      <span class="text-text-tertiary pt-5">~</span>
      <div class="flex-1">
        <label class="text-xs text-text-tertiary block mb-1">最大</label>
        <input
          type="number"
          class="input-dark w-full"
          :value="modelValue.max ?? ''"
          @input="updateMax(($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </div>
</template>

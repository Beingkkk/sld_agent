<script setup lang="ts">
import { computed } from 'vue';

interface Point2DValue {
  x: number;
  y: number;
}

const props = defineProps<{
  modelValue: Point2DValue;
  min?: number;
  max?: number;
  step?: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: Point2DValue): void;
}>();

function updateX(val: string) {
  const num = parseFloat(val);
  if (!isNaN(num)) {
    emit('update:modelValue', { ...props.modelValue, x: num });
  }
}

function updateY(val: string) {
  const num = parseFloat(val);
  if (!isNaN(num)) {
    emit('update:modelValue', { ...props.modelValue, y: num });
  }
}

const stepVal = computed(() => props.step || 0.1);
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="flex-1">
      <label class="text-xs text-text-tertiary block mb-1">X</label>
      <input
        type="number"
        class="input-dark w-full"
        :value="modelValue.x"
        :min="min"
        :max="max"
        :step="stepVal"
        @input="updateX(($event.target as HTMLInputElement).value)"
      />
    </div>
    <div class="flex-1">
      <label class="text-xs text-text-tertiary block mb-1">Y</label>
      <input
        type="number"
        class="input-dark w-full"
        :value="modelValue.y"
        :min="min"
        :max="max"
        :step="stepVal"
        @input="updateY(($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>

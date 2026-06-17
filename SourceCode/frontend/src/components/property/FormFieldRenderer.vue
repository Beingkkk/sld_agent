<script setup lang="ts">
import { computed } from 'vue';
import StringEditor from './editors/StringEditor.vue';
import NumberEditor from './editors/NumberEditor.vue';
import ColorEditor from './editors/ColorEditor.vue';
import EnumEditor from './editors/EnumEditor.vue';
import BooleanEditor from './editors/BooleanEditor.vue';
import TextareaEditor from './editors/TextareaEditor.vue';
import OpacityEditor from './editors/OpacityEditor.vue';
import ScaleRangeEditor from './editors/ScaleRangeEditor.vue';
import Point2DEditor from './editors/Point2DEditor.vue';
import NumberArrayEditor from './editors/NumberArrayEditor.vue';
import FontEditor from './editors/FontEditor.vue';
import LineStyleEditor from './editors/LineStyleEditor.vue';
import PropertyNameEditor from './editors/PropertyNameEditor.vue';
import FilterEditor from './editors/FilterEditor.vue';

const editorMap: Record<string, any> = {
  string: StringEditor,
  number: NumberEditor,
  color: ColorEditor,
  enum: EnumEditor,
  boolean: BooleanEditor,
  textarea: TextareaEditor,
  opacity: OpacityEditor,
  'scale-range': ScaleRangeEditor,
  point2d: Point2DEditor,
  'number-array': NumberArrayEditor,
  font: FontEditor,
  'line-style': LineStyleEditor,
  'property-name': PropertyNameEditor,
  'filter-tree': FilterEditor,
};

const props = defineProps<{
  editorType: string;
  modelValue: unknown;
  fieldMeta?: Record<string, unknown>;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void;
}>();

const editorComponent = computed(() => {
  return editorMap[props.editorType] || StringEditor;
});

const editorProps = computed(() => {
  const result: Record<string, unknown> = {
    modelValue: props.modelValue,
  };
  if (props.disabled !== undefined) {
    result.disabled = props.disabled;
  }
  if (props.fieldMeta?.options) {
    result.options = props.fieldMeta.options;
  }
  if (props.fieldMeta?.editorProps) {
    const ep = props.fieldMeta.editorProps as Record<string, unknown>;
    Object.assign(result, ep);
  }
  return result;
});

function onUpdate(value: unknown) {
  emit('update:modelValue', value);
}
</script>

<template>
  <component
    :is="editorComponent"
    v-bind="editorProps"
    @update:modelValue="onUpdate"
  />
</template>

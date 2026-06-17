<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useSLDStore } from '../../store';
import FormFieldRenderer from './FormFieldRenderer.vue';
import PropertyGroup from './PropertyGroup.vue';

import editorTypesData from '../../../../data/registry/editor-types.json';
import fieldRegistryData from '../../../../data/registry/field-registry.json';
import nodeSchemasData from '../../../../data/registry/node-schemas.json';
import symbolizerSchemasData from '../../../../data/registry/symbolizer-schemas.json';

const store = useSLDStore();

const editorTypes = editorTypesData as { editors: Record<string, { component: string; valueType: string; defaultProps: Record<string, unknown> }> };
const fieldRegistry = fieldRegistryData as { fields: Record<string, {
  id: string;
  label: string;
  description: string;
  editor: string;
  required: boolean;
  default: unknown;
  options?: unknown;
  editorProps?: Record<string, unknown>;
}> };
const nodeSchemas = nodeSchemasData as { nodes: Record<string, {
  nodeType: string;
  label: string;
  fields: string[];
  groups?: { id: string; label: string; fields: string[] }[];
}> };
const symbolizerSchemas = symbolizerSchemasData as { symbolizers: Record<string, {
  kind: string;
  userLabel: string;
  description: string;
  groups: { id: string; label: string; fields: string[] }[];
}> };

const selectedNode = computed(() => store.selectedNode);
const nodeType = computed(() => store.selectedNodeType);

const nodeLabel = computed(() => {
  const type = nodeType.value;
  if (!type) return '';
  if (type === 'Symbolizer') {
    const kind = (selectedNode.value as any)?.kind as string | undefined;
    return symbolizerSchemas.symbolizers[kind!]?.userLabel || kind || 'Symbolizer';
  }
  return nodeSchemas.nodes[type]?.label || type;
});

// Get schema for current node
const nodeSchema = computed(() => {
  const type = nodeType.value;
  if (!type) return null;
  if (type === 'Symbolizer') {
    const kind = (selectedNode.value as any)?.kind as string | undefined;
    if (!kind) return null;
    return symbolizerSchemas.symbolizers[kind];
  }
  return nodeSchemas.nodes[type];
});

// Get field definitions for the current node
const fieldDefinitions = computed(() => {
  const schema = nodeSchema.value;
  if (!schema) return [];

  if (nodeType.value === 'Symbolizer') {
    // Symbolizer uses groups
    const symSchema = schema as typeof symbolizerSchemas.symbolizers[string];
    const allFields: { fieldId: string; groupId?: string; groupLabel?: string }[] = [];
    for (const group of symSchema.groups) {
      for (const fieldId of group.fields) {
        allFields.push({ fieldId, groupId: group.id, groupLabel: group.label });
      }
    }
    return allFields;
  } else {
    const nodeSchemaTyped = schema as typeof nodeSchemas.nodes[string];
    if (nodeSchemaTyped.groups) {
      const allFields: { fieldId: string; groupId?: string; groupLabel?: string }[] = [];
      for (const group of nodeSchemaTyped.groups) {
        for (const fieldId of group.fields) {
          allFields.push({ fieldId, groupId: group.id, groupLabel: group.label });
        }
      }
      return allFields;
    }
    return nodeSchemaTyped.fields.map(f => ({ fieldId: f }));
  }
});

// Grouped fields for rendering
const groupedFields = computed(() => {
  const groups: { label: string; fields: { fieldId: string; meta: typeof fieldRegistry.fields[string] }[] }[] = [];
  const ungrouped: { fieldId: string; meta: typeof fieldRegistry.fields[string] }[] = [];

  const schema = nodeSchema.value;
  if (!schema) return { groups, ungrouped };

  if (nodeType.value === 'Symbolizer') {
    const symSchema = schema as typeof symbolizerSchemas.symbolizers[string];
    for (const group of symSchema.groups) {
      const groupFields: { fieldId: string; meta: typeof fieldRegistry.fields[string] }[] = [];
      for (const fieldId of group.fields) {
        const meta = fieldRegistry.fields[fieldId];
        if (meta) groupFields.push({ fieldId, meta });
      }
      if (groupFields.length > 0) {
        groups.push({ label: group.label, fields: groupFields });
      }
    }
  } else {
    const nodeSchemaTyped = schema as typeof nodeSchemas.nodes[string];
    if (nodeSchemaTyped.groups) {
      for (const group of nodeSchemaTyped.groups) {
        const groupFields: { fieldId: string; meta: typeof fieldRegistry.fields[string] }[] = [];
        for (const fieldId of group.fields) {
          const meta = fieldRegistry.fields[fieldId];
          if (meta) groupFields.push({ fieldId, meta });
        }
        if (groupFields.length > 0) {
          groups.push({ label: group.label, fields: groupFields });
        }
      }
    } else {
      for (const fieldId of nodeSchemaTyped.fields) {
        const meta = fieldRegistry.fields[fieldId];
        if (meta) ungrouped.push({ fieldId, meta });
      }
    }
  }

  return { groups, ungrouped };
});

function getFieldValue(fieldId: string): unknown {
  const node = selectedNode.value;
  if (!node) return undefined;
  return (node.data as Record<string, unknown>)?.[fieldId];
}

function updateField(fieldId: string, value: unknown) {
  if (!store.selectedPath) return;
  store.updateNode(store.selectedPath, { [fieldId]: value });
}

function isFieldDisabled(fieldId: string): boolean {
  if (fieldId !== 'filter') return false;
  return selectedNode.value?.data?.elseFilter === true;
}

// Render field row
function renderFieldRow(fieldId: string, meta: typeof fieldRegistry.fields[string]) {
  const value = getFieldValue(fieldId);
  const displayValue = value !== undefined ? value : meta.default;
  const editorType = meta.editor;

  return { fieldId, meta, displayValue, editorType };
}
</script>

<template>
  <div v-if="selectedNode" class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-4">
      <span class="text-lg font-brand font-semibold text-text-primary">
        {{ nodeLabel }} 属性
      </span>
      <span class="text-xs text-text-tertiary bg-bg-tertiary px-2 py-0.5 rounded">
        {{ nodeType }}
      </span>
    </div>

    <!-- Grouped fields -->
    <template v-if="groupedFields.groups.length > 0">
      <PropertyGroup
        v-for="group in groupedFields.groups"
        :key="group.label"
        :title="group.label"
        :default-expanded="true"
      >
        <div
          v-for="item in group.fields"
          :key="item.fieldId"
          class="space-y-1"
        >
          <label class="text-xs text-text-secondary block">
            {{ item.meta.label }}
          </label>
          <FormFieldRenderer
            :editor-type="item.meta.editor"
            :model-value="getFieldValue(item.fieldId) ?? item.meta.default"
            :field-meta="item.meta"
            :disabled="isFieldDisabled(item.fieldId)"
            @update:model-value="updateField(item.fieldId, $event)"
          />
          <p v-if="item.meta.description" class="text-xs text-text-tertiary">
            {{ item.meta.description }}
          </p>
        </div>
      </PropertyGroup>
    </template>

    <!-- Ungrouped fields -->
    <template v-if="groupedFields.ungrouped.length > 0">
      <div class="panel p-4 space-y-3">
        <div
          v-for="item in groupedFields.ungrouped"
          :key="item.fieldId"
          class="space-y-1"
        >
          <label class="text-xs text-text-secondary block">
            {{ item.meta.label }}
          </label>
          <FormFieldRenderer
            :editor-type="item.meta.editor"
            :model-value="getFieldValue(item.fieldId) ?? item.meta.default"
            :field-meta="item.meta"
            :disabled="isFieldDisabled(item.fieldId)"
            @update:model-value="updateField(item.fieldId, $event)"
          />
          <p v-if="item.meta.description" class="text-xs text-text-tertiary">
            {{ item.meta.description }}
          </p>
        </div>
      </div>
    </template>
  </div>

  <!-- Empty state -->
  <div v-else class="flex flex-col items-center justify-center h-full text-text-tertiary py-12">
    <svg class="w-12 h-12 mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
    <p class="text-sm">在左侧树中选择一个节点以编辑属性</p>
  </div>
</template>

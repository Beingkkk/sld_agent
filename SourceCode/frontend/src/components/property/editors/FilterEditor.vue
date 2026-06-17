<script setup lang="ts">
import { ref, computed } from 'vue';
import type { FilterNode, FilterNodeType } from '@sldagent/core';
import FilterTree from '../../filter/FilterTree.vue';
import FilterNodeEditor from '../../filter/FilterNodeEditor.vue';
import CqlPreview from '../../filter/CqlPreview.vue';

const props = defineProps<{
  modelValue: FilterNode | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: FilterNode | null): void;
}>();

const selectedId = ref<string | null>(null);

const localFilter = computed<FilterNode | null>({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const selectedNode = computed(() => {
  if (!localFilter.value || !selectedId.value) return null;
  return findNode(localFilter.value, selectedId.value);
});

function findNode(node: FilterNode, id: string): FilterNode | null {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

function setSelectedNode(updated: FilterNode) {
  if (!localFilter.value) return;
  localFilter.value = replaceNode(localFilter.value, updated);
}

function replaceNode(root: FilterNode, target: FilterNode): FilterNode {
  if (root.id === target.id) return { ...target };
  if (root.children) {
    return {
      ...root,
      children: root.children.map((child) => replaceNode(child, target)),
    };
  }
  return { ...root };
}

function createNode(type: FilterNodeType): FilterNode {
  const id = `filter_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  if (type === 'comparison') {
    return { id, type, operator: '==', propertyName: '', value: '' };
  }
  return { id, type, children: [] };
}

function addChild(type: FilterNodeType) {
  if (props.disabled) return;
  const newNode = createNode(type);

  if (!localFilter.value) {
    localFilter.value = newNode;
    selectedId.value = newNode.id;
    return;
  }

  const target = selectedNode.value || localFilter.value;

  if (target.type === 'comparison') {
    // 在父节点下添加同级节点：需要找到父节点
    const parent = findParent(localFilter.value, target.id);
    if (parent && (parent.type === 'and' || parent.type === 'or')) {
      localFilter.value = updateParentChildren(localFilter.value, parent, [
        ...parent.children!,
        newNode,
      ]);
      selectedId.value = newNode.id;
    }
    return;
  }

  if (target.type === 'not') {
    if ((target.children?.length || 0) >= 1) return;
    localFilter.value = replaceNode(localFilter.value, {
      ...target,
      children: [newNode],
    });
    selectedId.value = newNode.id;
    return;
  }

  // and / or
  localFilter.value = updateParentChildren(localFilter.value, target, [
    ...(target.children || []),
    newNode,
  ]);
  selectedId.value = newNode.id;
}

function findParent(root: FilterNode, childId: string): FilterNode | null {
  if (root.children) {
    for (const child of root.children) {
      if (child.id === childId) return root;
      const found = findParent(child, childId);
      if (found) return found;
    }
  }
  return null;
}

function updateParentChildren(
  root: FilterNode,
  parent: FilterNode,
  newChildren: FilterNode[]
): FilterNode {
  if (root.id === parent.id) {
    return { ...root, children: newChildren };
  }
  if (root.children) {
    return {
      ...root,
      children: root.children.map((child) => updateParentChildren(child, parent, newChildren)),
    };
  }
  return { ...root };
}

function deleteSelected() {
  if (props.disabled || !localFilter.value || !selectedId.value) return;

  if (localFilter.value.id === selectedId.value) {
    localFilter.value = null;
    selectedId.value = null;
    return;
  }

  const parent = findParent(localFilter.value, selectedId.value);
  if (parent && parent.children) {
    const newChildren = parent.children.filter((c) => c.id !== selectedId.value);
    // not 必须保留一个子节点
    if (parent.type === 'not' && newChildren.length === 0) return;
    localFilter.value = updateParentChildren(localFilter.value, parent, newChildren);
    selectedId.value = parent.id;
  }
}

function clearFilter() {
  if (props.disabled) return;
  localFilter.value = null;
  selectedId.value = null;
}

function onSelect(id: string) {
  selectedId.value = id;
}
</script>

<template>
  <div class="bg-bg-tertiary rounded-card border border-border-default p-3 space-y-3">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium text-text-primary">Filter 节点树</span>
      <button
        v-if="localFilter && !disabled"
        type="button"
        class="text-xs text-error hover:text-error/80"
        @click="clearFilter"
      >
        清空
      </button>
    </div>

    <div
      v-if="localFilter"
      class="max-h-48 overflow-y-auto border border-border-default rounded bg-bg-primary p-2"
    >
      <FilterTree
        :node="localFilter"
        :selected-id="selectedId"
        :disabled="disabled"
        @select="onSelect"
      />
    </div>

    <div v-else class="text-xs text-text-tertiary border border-border-default rounded bg-bg-primary p-3">
      暂无 Filter，点击下方按钮添加第一个条件节点。
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="type in ['and', 'or', 'not', 'comparison'] as FilterNodeType[]"
        :key="type"
        type="button"
        :disabled="disabled"
        class="px-2 py-1 text-xs rounded border border-border-default bg-bg-primary text-text-primary hover:bg-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
        @click="addChild(type)"
      >
        {{ type === 'and' ? '+ AND' : type === 'or' ? '+ OR' : type === 'not' ? '+ NOT' : '+ 条件' }}
      </button>

      <button
        type="button"
        :disabled="disabled || !selectedId"
        class="px-2 py-1 text-xs rounded border border-error/50 bg-bg-primary text-error hover:bg-error/10 disabled:opacity-50 disabled:cursor-not-allowed"
        @click="deleteSelected"
      >
        删除选中
      </button>
    </div>

    <div v-if="selectedNode && !disabled" class="border-t border-border-default pt-3">
      <FilterNodeEditor
        :model-value="selectedNode"
        :disabled="disabled"
        @update:model-value="setSelectedNode"
      />
    </div>

    <CqlPreview :filter="localFilter" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { TreePath } from '@sldagent/core';
import type { SymbolizerNode, NodeType, SymbolizerKind } from '@sldagent/core';
import { useSLDStore } from '../../store';

export interface BaseNode {
  id: string;
  type: NodeType;
  data: any;
  children: BaseNode[];
  kind?: SymbolizerKind;
}

const props = defineProps<{
  node: BaseNode;
  path: TreePath;
  depth: number;
}>();

const store = useSLDStore();

const isExpanded = computed(() => store.isPathExpanded(props.path));
const isSelected = computed(() => {
  return store.selectedPath?.toString() === props.path.toString();
});

const hasChildren = computed(() => props.node.children.length > 0);

const displayLabel = computed(() => {
  const type = props.node.type;
  if (type === 'Symbolizer') {
    const kind = (props.node as SymbolizerNode).kind;
    switch (kind) {
      case 'Mark': return 'PointSymbolizer';
      case 'Line': return 'LineSymbolizer';
      case 'Fill': return 'PolygonSymbolizer';
      case 'Text': return 'TextSymbolizer';
    }
  }
  return type;
});

const nodeIcon = computed(() => {
  const type = props.node.type;
  if (type === 'NamedLayer') return '📁';
  if (type === 'UserStyle') return '🎨';
  if (type === 'FeatureTypeStyle') return '📂';
  if (type === 'Rule') return '📄';
  if (type === 'Symbolizer') {
    const kind = (props.node as SymbolizerNode).kind;
    switch (kind) {
      case 'Mark': return '●';
      case 'Line': return '═';
      case 'Fill': return '▩';
      case 'Text': return 'T';
    }
  }
  return '';
});

const nodeColorClass = computed(() => {
  const type = props.node.type;
  if (type === 'UserStyle') return 'text-accent-teal';
  if (type === 'FeatureTypeStyle') return 'text-accent-blue';
  if (type === 'Symbolizer') return 'text-accent-teal';
  return 'text-text-secondary';
});

function toggleExpand(e: Event) {
  e.stopPropagation();
  store.toggleExpanded(props.path);
}

function selectNode() {
  store.selectNode(props.path);
}

function explainRuleNode(e: Event) {
  e.stopPropagation();
  store.selectNode(props.path);
  store.explainSelectedRule();
}

// Context menu
const showContextMenu = ref(false);
const contextMenuPos = ref({ x: 0, y: 0 });

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  contextMenuPos.value = { x: e.clientX, y: e.clientY };
  showContextMenu.value = true;
}

function closeContextMenu() {
  showContextMenu.value = false;
}

function canAddChild(): { type: NodeType; label: string; kind?: SymbolizerKind }[] {
  const type = props.node.type;
  if (type === 'NamedLayer') return [{ type: 'UserStyle', label: 'UserStyle' }];
  if (type === 'UserStyle') return [{ type: 'FeatureTypeStyle', label: 'FeatureTypeStyle' }];
  if (type === 'FeatureTypeStyle') return [{ type: 'Rule', label: 'Rule' }];
  if (type === 'Rule') return [
    { type: 'Symbolizer', label: 'PointSymbolizer', kind: 'Mark' },
    { type: 'Symbolizer', label: 'LineSymbolizer', kind: 'Line' },
    { type: 'Symbolizer', label: 'PolygonSymbolizer', kind: 'Fill' },
    { type: 'Symbolizer', label: 'TextSymbolizer', kind: 'Text' },
  ];
  return [];
}

function canDelete(): boolean {
  const type = props.node.type;
  return type !== 'NamedLayer' && type !== 'UserStyle';
}

function handleAdd(type: NodeType, kind?: SymbolizerKind) {
  store.addNode(props.path, type, kind);
  closeContextMenu();
  // Auto-expand
  if (!isExpanded.value) {
    store.toggleExpanded(props.path);
  }
}

function handleDelete() {
  store.removeNode(props.path);
  closeContextMenu();
}

// Drag and drop
const isDragging = ref(false);
const dragOverPos = ref<'before' | 'after' | null>(null);

function onDragStart(e: DragEvent) {
  if (!canDrag()) {
    e.preventDefault();
    return;
  }
  isDragging.value = true;
  e.dataTransfer?.setData('text/plain', props.path.toString());
  e.dataTransfer!.effectAllowed = 'move';
}

function onDragEnd() {
  isDragging.value = false;
  dragOverPos.value = null;
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  const sourcePathStr = e.dataTransfer?.getData('text/plain');
  if (!sourcePathStr) return;

  const sourcePath = TreePath.fromString(sourcePathStr);
  const sourceParent = sourcePath.parent();
  const targetParent = props.path.parent();

  if (!sourceParent || !targetParent || !sourceParent.equals(targetParent)) {
    return;
  }

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  dragOverPos.value = e.clientY < midY ? 'before' : 'after';
}

function onDragLeave() {
  dragOverPos.value = null;
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  const sourcePathStr = e.dataTransfer?.getData('text/plain');
  if (!sourcePathStr) return;

  const sourcePath = TreePath.fromString(sourcePathStr);
  const sourceParent = sourcePath.parent();
  const targetParent = props.path.parent();

  if (!sourceParent || !targetParent || !sourceParent.equals(targetParent)) {
    dragOverPos.value = null;
    return;
  }

  const sourceIndex = sourcePath.toArray()[sourcePath.toArray().length - 1];
  const targetIndex = props.path.toArray()[props.path.toArray().length - 1];

  let adjustedTarget = targetIndex;
  if (dragOverPos.value === 'after') {
    adjustedTarget = targetIndex + 1;
  }
  if (sourceIndex < adjustedTarget) {
    adjustedTarget--;
  }

  const targetPathArray = [...sourceParent.toArray(), adjustedTarget];
  const targetPath = new TreePath(targetPathArray);

  store.moveNode(sourcePath, targetPath);
  dragOverPos.value = null;
}

function canDrag(): boolean {
  const type = props.node.type;
  return type === 'FeatureTypeStyle' || type === 'Rule' || type === 'Symbolizer';
}

const childNodes = computed(() => {
  return props.node.children.map((child: BaseNode, index: number) => ({
    node: child,
    path: props.path.child(index),
  }));
});
</script>

<template>
  <div>
    <!-- Node Row -->
    <div
      class="group flex items-center gap-1 py-1 pr-2 rounded cursor-pointer transition-colors relative"
      :class="[
        isSelected ? 'bg-bg-active' : 'hover:bg-bg-hover',
        isDragging ? 'opacity-50' : 'opacity-100',
      ]"
      :style="{ paddingLeft: `${depth * 16 + 4}px` }"
      @click="selectNode"
      @contextmenu="onContextMenu"
      draggable="true"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <!-- Selected indicator -->
      <div
        v-if="isSelected"
        class="absolute left-0 top-1 bottom-1 w-[3px] bg-accent-teal rounded-r"
      />

      <!-- Drop indicator -->
      <div
        v-if="dragOverPos === 'before'"
        class="absolute left-0 right-0 top-0 h-[2px] bg-accent-teal z-10"
      />
      <div
        v-if="dragOverPos === 'after'"
        class="absolute left-0 right-0 bottom-0 h-[2px] bg-accent-teal z-10"
      />

      <!-- Expand/Collapse toggle -->
      <button
        v-if="hasChildren"
        class="w-4 h-4 flex items-center justify-center text-text-tertiary hover:text-text-secondary transition-colors"
        @click="toggleExpand"
      >
        <svg
          class="w-3 h-3 transition-transform"
          :class="isExpanded ? 'rotate-90' : ''"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <div v-else class="w-4" />

      <!-- Icon -->
      <span class="text-xs w-4 text-center" :class="nodeColorClass">{{ nodeIcon }}</span>

      <!-- Label -->
      <span
        class="text-sm select-none"
        :class="isSelected ? 'text-text-primary font-medium' : 'text-text-secondary'"
      >
        {{ displayLabel }}
      </span>

      <!-- Name hint (if available) -->
      <span
        v-if="node.data?.name || node.data?.title"
        class="text-xs text-text-tertiary truncate max-w-[120px]"
      >
        {{ node.data.name || node.data.title }}
      </span>

      <!-- AI explain button for Rule nodes -->
      <button
        v-if="node.type === 'Rule'"
        class="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary hover:text-accent-teal text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-bg-hover"
        title="AI 解释此 Rule"
        :disabled="store.backendStatus !== 'connected'"
        @click.stop="explainRuleNode"
      >
        ?
      </button>
    </div>

    <!-- Children -->
    <div v-if="isExpanded && hasChildren">
      <SLDTreeNode
        v-for="child in childNodes"
        :key="child.node.id"
        :node="child.node"
        :path="child.path"
        :depth="depth + 1"
      />
    </div>

    <!-- Context Menu -->
    <div
      v-if="showContextMenu"
      class="fixed z-50 bg-bg-tertiary border border-border-default rounded-card shadow-lg py-1 min-w-[160px]"
      :style="{ left: `${contextMenuPos.x}px`, top: `${contextMenuPos.y}px` }"
      @click.stop
      v-click-outside="closeContextMenu"
    >
      <div class="px-3 py-1 text-xs text-text-tertiary uppercase tracking-wider">
        {{ node.type }}
      </div>
      <div class="h-px bg-border-subtle my-1" />
      <template v-if="canAddChild().length > 0">
        <button
          v-for="item in canAddChild()"
          :key="item.type + (item.kind || '')"
          class="w-full text-left px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors flex items-center gap-2"
          @click="handleAdd(item.type, item.kind)"
        >
          <span class="text-accent-teal">+</span>
          添加 {{ item.label }}
        </button>
      </template>
      <button
        v-if="canDelete()"
        class="w-full text-left px-3 py-1.5 text-sm text-accent-red hover:bg-accent-red/10 transition-colors flex items-center gap-2"
        @click="handleDelete"
      >
        <span>×</span>
        删除
      </button>
    </div>

    <!-- Click outside to close context menu -->
    <div
      v-if="showContextMenu"
      class="fixed inset-0 z-40"
      @click="closeContextMenu"
    />
  </div>
</template>

<script lang="ts">
// Simple click-outside directive
const clickOutside = {
  mounted(el: HTMLElement, binding: any) {
    (el as any)._clickOutside = (e: Event) => {
      if (!el.contains(e.target as Node)) {
        binding.value();
      }
    };
    document.addEventListener('click', (el as any)._clickOutside, true);
  },
  unmounted(el: HTMLElement) {
    document.removeEventListener('click', (el as any)._clickOutside, true);
  },
};

export default {
  directives: {
    'click-outside': clickOutside,
  },
};
</script>

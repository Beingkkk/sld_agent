<script setup lang="ts">
import { computed } from 'vue';
import { TreePath } from '@sldagent/core';
import type { NodeType, SymbolizerKind } from '@sldagent/core';
import { useSLDStore } from '../../store';
import SLDTreeNode from './SLDTreeNode.vue';

interface BaseNode {
  id: string;
  type: NodeType;
  data: any;
  children: BaseNode[];
  kind?: SymbolizerKind;
}

const store = useSLDStore();

const rootNode = computed(() => store.root.namedLayer);
const rootPath = new TreePath([0]);

function getNodeChildren(node: BaseNode, path: TreePath): { node: BaseNode; path: TreePath }[] {
  return node.children.map((child: BaseNode, index: number) => ({
    node: child,
    path: path.child(index),
  }));
}
</script>

<template>
  <div class="select-none">
    <!-- Root: StyledLayerDescriptor -->
    <div class="px-2 py-1 text-xs text-text-tertiary font-mono mb-1">
      StyledLayerDescriptor v1.0.0
    </div>
    <!-- NamedLayer -->
    <SLDTreeNode
      :node="rootNode"
      :path="rootPath"
      :depth="0"
    />
  </div>
</template>

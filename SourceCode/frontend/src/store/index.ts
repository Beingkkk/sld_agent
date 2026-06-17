import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import {
  SLDTree,
  TreePath,
  type NodeType,
  type SymbolizerKind,
} from '@sldagent/core';

export type BackendStatus = 'idle' | 'connecting' | 'connected' | 'error';

function createDefaultTree(): SLDTree {
  return new SLDTree();
}

export const useSLDStore = defineStore('sld', () => {
  // State - use `any` for deeply nested types to avoid inference issues
  const tree = ref<any>(createDefaultTree());
  const selectedPath = ref<TreePath | null>(null);
  const expandedPaths = ref<Set<string>>(new Set(['[0]', '[0,0]', '[0,0,0]']));
  const transformResult = shallowRef<any>(null);
  const issues = shallowRef<any[]>([]);
  const backendStatus = ref<BackendStatus>('idle');

  // Computed
  const root = computed(() => tree.value.root as any);
  const selectedNode = computed(() => {
    if (!selectedPath.value) return null;
    return tree.value.getNodeAt(selectedPath.value) as any;
  });

  const selectedNodeType = computed(() => selectedNode.value?.type || null);

  const selectedSymbolizerKind = computed((): SymbolizerKind | null => {
    const node = selectedNode.value;
    if (!node) return null;
    if (node.type === 'Symbolizer') return node.kind;
    return null;
  });

  const previewGeometryType = computed((): SymbolizerKind => {
    const node = selectedNode.value;
    if (!node) return 'Fill';
    if (node.type === 'Symbolizer') return node.kind;
    if (node.type === 'Rule') {
      const firstSym = node.children?.[0];
      return firstSym?.kind || 'Fill';
    }
    return 'Fill';
  });

  const isPathExpanded = (path: TreePath): boolean => {
    return expandedPaths.value.has(path.toString());
  };

  // Transform and validate
  async function recomputeTransform() {
    try {
      const geoStyler = tree.value.toGeoStyler();
      const sldXml = await tree.value.toSLDXML();
      const validationIssues = tree.value.validate();
      transformResult.value = {
        geoStyler,
        sldXml,
        issues: validationIssues,
      };
      issues.value = validationIssues;
    } catch (e) {
      console.error('Transform error:', e);
      issues.value = [];
    }
  }

  // Actions
  function selectNode(path: TreePath | null) {
    selectedPath.value = path;
  }

  function toggleExpanded(path: TreePath) {
    const key = path.toString();
    const newSet = new Set(expandedPaths.value);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    expandedPaths.value = newSet;
  }

  function addNode(parentPath: TreePath, type: NodeType, kind?: SymbolizerKind) {
    try {
      tree.value = tree.value.addNode(parentPath, type, kind);
      const newSet = new Set(expandedPaths.value);
      newSet.add(parentPath.toString());
      expandedPaths.value = newSet;
      recomputeTransform();
    } catch (e) {
      console.error('Add node error:', e);
    }
  }

  function removeNode(path: TreePath) {
    try {
      tree.value = tree.value.removeNode(path);
      if (selectedPath.value?.toString() === path.toString()) {
        selectedPath.value = null;
      }
      recomputeTransform();
    } catch (e) {
      console.error('Remove node error:', e);
    }
  }

  function updateNode(path: TreePath, patch: Record<string, unknown>) {
    try {
      tree.value = tree.value.updateNode(path, patch);
      recomputeTransform();
    } catch (e) {
      console.error('Update node error:', e);
    }
  }

  function moveNode(sourcePath: TreePath, targetPath: TreePath) {
    try {
      tree.value = tree.value.moveNode(sourcePath, targetPath);
      recomputeTransform();
    } catch (e) {
      console.error('Move node error:', e);
    }
  }

  async function importSLD(xml: string) {
    try {
      const newTree = await SLDTree.fromSLDXML(xml);
      tree.value = newTree;
      selectedPath.value = null;
      expandedPaths.value = new Set(['[0]', '[0,0]', '[0,0,0]']);
      await recomputeTransform();
    } catch (e) {
      console.error('Import SLD error:', e);
      throw e;
    }
  }

  async function exportSLD(): Promise<string> {
    return tree.value.toSLDXML();
  }

  function setBackendStatus(status: BackendStatus) {
    backendStatus.value = status;
  }

  // Initialize
  recomputeTransform();

  return {
    tree,
    selectedPath,
    expandedPaths,
    transformResult,
    issues,
    backendStatus,
    root,
    selectedNode,
    selectedNodeType,
    selectedSymbolizerKind,
    previewGeometryType,
    isPathExpanded,
    selectNode,
    toggleExpanded,
    addNode,
    removeNode,
    updateNode,
    moveNode,
    importSLD,
    exportSLD,
    setBackendStatus,
    recomputeTransform,
  };
});

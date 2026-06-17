import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import {
  SLDTree,
  TreePath,
  type NodeType,
  type SymbolizerKind,
  type ValidationIssue,
} from '@sldagent/core';
import { explainRule, explainValidation, explainProperty as requestExplainProperty } from '../ws/client';

export type BackendStatus = 'idle' | 'connecting' | 'connected' | 'error';
export type RightPanelTab = 'json' | 'xml' | 'validation' | 'ai';

function createDefaultTree(): SLDTree {
  return new SLDTree();
}

export const useSLDStore = defineStore('sld', () => {
  // State - use `any` for deeply nested types to avoid inference issues
  const tree = ref<any>(createDefaultTree());
  const selectedPath = ref<TreePath | null>(null);
  const expandedPaths = ref<Set<string>>(new Set(['[0]', '[0,0]', '[0,0,0]']));
  const transformResult = shallowRef<any>(null);
  const issues = shallowRef<ValidationIssue[]>([]);
  const backendStatus = ref<BackendStatus>('idle');

  // AI explanation state
  const aiExplanation = ref<string>('');
  const aiWarnings = ref<string[]>([]);
  const aiIssueExplanation = ref<string>('');
  const aiIssueContext = ref<{ code: string; message: string; path: string } | null>(null);
  const aiPropertyExplanation = ref<string>('');
  const aiPropertyContext = ref<{ nodeType: string; fieldName: string; value: unknown; label: string } | null>(null);
  const aiLoading = ref<boolean>(false);

  // Right panel tab state (shared so tree/property can switch tabs)
  const activeRightTab = ref<RightPanelTab>('json');

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

  async function explainSelectedRule() {
    if (!selectedNode.value || selectedNode.value.type !== 'Rule') {
      aiExplanation.value = '请在左侧 SLD 树中选择一个 Rule 节点以获取 AI 解释。';
      aiWarnings.value = [];
      aiIssueExplanation.value = '';
      aiIssueContext.value = null;
      aiPropertyExplanation.value = '';
      aiPropertyContext.value = null;
      return;
    }

    aiLoading.value = true;
    aiIssueExplanation.value = '';
    aiIssueContext.value = null;
    aiPropertyExplanation.value = '';
    aiPropertyContext.value = null;

    try {
      const snapshot = tree.value.toSnapshot(
        selectedPath.value,
        Array.from(expandedPaths.value),
        issues.value
      );
      const response = (await explainRule(snapshot, selectedPath.value!.toArray())) as {
        text?: string;
        warnings?: string[];
      };
      aiExplanation.value = response.text ?? '（无解释内容）';
      aiWarnings.value = response.warnings ?? [];
      setActiveRightTab('ai');
    } catch (e) {
      console.error('Explain rule failed:', e);
      aiExplanation.value = `解释失败：${e instanceof Error ? e.message : String(e)}`;
      aiWarnings.value = [];
      setActiveRightTab('ai');
    } finally {
      aiLoading.value = false;
    }
  }

  async function explainIssue(issue: ValidationIssue) {
    aiLoading.value = true;
    aiExplanation.value = '';
    aiWarnings.value = [];
    aiPropertyExplanation.value = '';
    aiPropertyContext.value = null;

    try {
      const snapshot = tree.value.toSnapshot(
        selectedPath.value,
        Array.from(expandedPaths.value),
        issues.value
      );
      const response = (await explainValidation(
        issue.code,
        issue.path.toArray(),
        issue.message,
        snapshot
      )) as { text?: string };
      aiIssueExplanation.value = response.text ?? '（无解释内容）';
      aiIssueContext.value = {
        code: issue.code,
        message: issue.message,
        path: issue.path.toString(),
      };
      setActiveRightTab('ai');
    } catch (e) {
      console.error('Explain issue failed:', e);
      aiIssueExplanation.value = `解释失败：${e instanceof Error ? e.message : String(e)}`;
      aiIssueContext.value = {
        code: issue.code,
        message: issue.message,
        path: issue.path.toString(),
      };
      setActiveRightTab('ai');
    } finally {
      aiLoading.value = false;
    }
  }

  function setBackendStatus(status: BackendStatus) {
    backendStatus.value = status;
  }

  function setActiveRightTab(tab: RightPanelTab) {
    activeRightTab.value = tab;
  }

  async function explainProperty(fieldName: string, label: string, value?: unknown) {
    const nodeTypeVal = selectedNodeType.value;
    if (!nodeTypeVal) return;

    const node = selectedNode.value;
    const actualValue = value !== undefined ? value : (node?.data?.[fieldName] as unknown);

    aiLoading.value = true;
    aiExplanation.value = '';
    aiWarnings.value = [];
    aiIssueExplanation.value = '';
    aiIssueContext.value = null;

    try {
      const response = (await requestExplainProperty(nodeTypeVal, fieldName, actualValue)) as {
        text?: string;
      };
      aiPropertyExplanation.value = response.text ?? '（无解释内容）';
      aiPropertyContext.value = { nodeType: nodeTypeVal, fieldName, value: actualValue, label };
      setActiveRightTab('ai');
    } catch (e) {
      console.error('Explain property failed:', e);
      aiPropertyExplanation.value = `解释失败：${e instanceof Error ? e.message : String(e)}`;
      aiPropertyContext.value = { nodeType: nodeTypeVal, fieldName, value: actualValue, label };
      setActiveRightTab('ai');
    } finally {
      aiLoading.value = false;
    }
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
    activeRightTab,
    aiExplanation,
    aiWarnings,
    aiIssueExplanation,
    aiIssueContext,
    aiPropertyExplanation,
    aiPropertyContext,
    aiLoading,
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
    setActiveRightTab,
    recomputeTransform,
    explainSelectedRule,
    explainIssue,
    explainProperty,
  };
});

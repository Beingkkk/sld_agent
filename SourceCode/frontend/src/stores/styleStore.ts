import { defineStore } from 'pinia';
import { ref, computed, toRaw } from 'vue';
import type {
  ChatMessage,
  DomainsResult,
  GenerationResult,
  SampleDatasetData,
  SampleDatasetInfo,
  Style,
  StyleParams,
  StylePatch,
  ValidationReport,
} from '@shared/types';
import { applyPatches } from '@shared/patch';
import { createWsClient, type WsClient, type WsClientError } from '../services/wsClient';

export const useStyleStore = defineStore('style', () => {
  const url = new URLSearchParams(window.location.search).get('port');
  const wsUrl = url ? `ws://localhost:${url}` : 'ws://localhost:8000';
  const wsClient = createWsClient({
    url: wsUrl,
    onClose: () => {
      connected.value = false;
    },
    onError: () => {
      connected.value = false;
    },
  });

  const currentStyle = ref<Style | undefined>();
  const lastValidStyle = ref<Style | undefined>();
  const sldXml = ref<string | undefined>();
  const params = ref<StyleParams | undefined>();
  const validation = ref<ValidationReport | undefined>();
  const explanation = ref<string | undefined>();
  const chatHistory = ref<ChatMessage[]>([]);
  const busy = ref(false);
  const connected = ref(false);
  const sampleDatasets = ref<SampleDatasetInfo[]>([]);
  const activeDataset = ref<SampleDatasetData | undefined>();
  const datasetError = ref<string | undefined>();

  wsClient.connect().then(() => {
    connected.value = true;
    return loadSampleDatasets();
  }).catch(() => {
    connected.value = false;
  });

  async function generate(instruction: string, geometryType: string) {
    busy.value = true;
    chatHistory.value.push({ role: 'user', content: instruction, timestamp: Date.now() });
    try {
      const result = (await wsClient.generate({
        instruction,
        geometryType,
      })) as GenerationResult;
      applyResult(result);
      chatHistory.value.push({ role: 'assistant', content: result.explanation, timestamp: Date.now() });
    } finally {
      busy.value = false;
    }
  }

  async function modify(instruction: string) {
    busy.value = true;
    chatHistory.value.push({ role: 'user', content: instruction, timestamp: Date.now() });
    try {
      const result = (await wsClient.modify({ instruction })) as GenerationResult;
      applyResult(result);
      chatHistory.value.push({ role: 'assistant', content: result.explanation, timestamp: Date.now() });
    } finally {
      busy.value = false;
    }
  }

  async function applyPatch(patches: StylePatch[]) {
    const paramsSnapshot = params.value;
    const styleSnapshot = currentStyle.value;
    // Optimistic local update: apply patches to params immediately.
    params.value = applyPatchesToParams(params.value, patches);
    busy.value = true;
    try {
      const result = (await wsClient.applyPatch({ patches: patches as unknown[] })) as GenerationResult;
      applyResult(result);
    } catch (err) {
      // Rollback optimistic update on failure.
      params.value = paramsSnapshot;
      currentStyle.value = styleSnapshot;
      throw err;
    } finally {
      busy.value = false;
    }
  }

  function applyPatchesToParams(target: StyleParams | undefined, patches: StylePatch[]): StyleParams | undefined {
    if (!target) return undefined;
    return applyPatches(toRaw(target) as unknown as Record<string, unknown>, patches) as unknown as StyleParams;
  }

  async function importStyle(style: Style) {
    busy.value = true;
    try {
      const result = (await wsClient.importStyle({ style })) as GenerationResult;
      applyResult(result);
    } finally {
      busy.value = false;
    }
  }

  async function exportSld(): Promise<string> {
    const result = (await wsClient.exportStyle({})) as { sldXml: string; validation: ValidationReport };
    return result.sldXml;
  }

  async function validate() {
    const result = (await wsClient.validate({})) as { style: Style; validation: ValidationReport };
    validation.value = result.validation;
    return result.validation;
  }

  async function setDomain(domain: string) {
    const result = (await wsClient.setDomain(domain)) as DomainsResult;
    return result;
  }

  async function loadSampleDatasets() {
    if (!connected.value) return;
    try {
      const result = (await wsClient.listSampleDatasets()) as { datasets: SampleDatasetInfo[] };
      sampleDatasets.value = result.datasets ?? [];
      datasetError.value = undefined;
    } catch (err) {
      sampleDatasets.value = [];
      datasetError.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function loadSampleDataset(id: string) {
    if (!connected.value || !id) return;
    try {
      const result = (await wsClient.getSampleDataset(id)) as SampleDatasetData;
      activeDataset.value = result;
      datasetError.value = undefined;
    } catch (err) {
      activeDataset.value = undefined;
      datasetError.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function selectDatasetForGeometry(geometryType?: string) {
    if (!geometryType || sampleDatasets.value.length === 0) return;
    const target = geometryType === 'linestring' ? 'line' : geometryType;
    const dataset = sampleDatasets.value.find((d) => d.geometryType === target);
    if (dataset && dataset.id !== activeDataset.value?.id) {
      await loadSampleDataset(dataset.id);
    }
  }

  function clearChat() {
    chatHistory.value = [];
  }

  function applyResult(result: GenerationResult) {
    currentStyle.value = result.style;
    lastValidStyle.value = result.style;
    sldXml.value = result.sldXml;
    params.value = result.params;
    validation.value = result.validation;
    explanation.value = result.explanation;
    selectDatasetForGeometry(result.params.geometry_type).catch(() => undefined);
  }

  return {
    currentStyle: computed(() => currentStyle.value),
    lastValidStyle: computed(() => lastValidStyle.value),
    sldXml: computed(() => sldXml.value),
    params: computed(() => params.value),
    validation: computed(() => validation.value),
    explanation: computed(() => explanation.value),
    chatHistory: computed(() => chatHistory.value),
    busy: computed(() => busy.value),
    connected: computed(() => connected.value),
    sampleDatasets: computed(() => sampleDatasets.value),
    activeDataset: computed(() => activeDataset.value),
    datasetError: computed(() => datasetError.value),
    generate,
    modify,
    applyPatch,
    clearChat,
    applyResult,
    importStyle,
    exportSld,
    validate,
    setDomain,
    loadSampleDatasets,
    loadSampleDataset,
    selectDatasetForGeometry,
  };
});

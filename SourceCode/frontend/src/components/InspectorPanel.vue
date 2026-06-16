<template>
  <aside class="inspector-panel">
    <div class="panel-header">
      <div class="panel-title">
        <h2>样式检查器</h2>
        <span>Generated Style & Validation</span>
      </div>
      <div class="panel-tools">
        <button class="icon-btn" title="复制当前内容" @click="copyInspector">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="inspector-split">
      <div class="inspector-left">
        <div class="tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="inspector-body">
          <div v-show="activeTab === 'params'" class="tab-content">
            <SymbolizerEditor />
          </div>
          <div v-show="activeTab === 'rules'" class="tab-content">
            <RulesPanel />
          </div>
          <div v-show="activeTab === 'json'" class="tab-content">
            <textarea
              v-model="localJson"
              class="code-editor code-editor-editable"
              spellcheck="false"
              placeholder="// 可编辑的 GeoStyler Style JSON，修改后点击“应用修改”"
            />
          </div>
        </div>

        <div class="apply-panel">
          <button class="apply-btn" :disabled="!canApply" @click="apply">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            应用修改
          </button>
          <div class="apply-hint">左侧编辑直接修改 GeoStyler 模型，不经过 LLM 解析。点击“应用”后批量提交 patches，后端校验通过后同步生成右侧 SLD XML。</div>
        </div>
      </div>

      <div class="inspector-right">
        <div class="code-editor-header">
          <span>SLD XML</span>
          <span class="tag-readonly">只读</span>
        </div>
        <pre class="code-editor" v-html="highlightedSld"></pre>
      </div>
    </div>

    <div class="validation-panel">
      <ValidationPanel />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useStyleStore } from '../stores/styleStore';
import RulesPanel from './RulesPanel.vue';
import SymbolizerEditor from './SymbolizerEditor.vue';
import ValidationPanel from './ValidationPanel.vue';

const store = useStyleStore();

const tabs = [
  { key: 'params', label: '参数精修' },
  { key: 'rules', label: '规则列表' },
  { key: 'json', label: 'GeoStyler JSON' },
];
const activeTab = ref('params');

const localJson = ref('');

watch(() => store.currentStyle, (style) => {
  localJson.value = style ? JSON.stringify(style, null, 2) : '';
}, { immediate: true });

const canApply = computed(() => {
  if (activeTab.value === 'rules') return false;
  return true;
});

const highlightedSld = computed(() => {
  const xml = store.sldXml || '';
  return highlightSld(xml);
});

function highlightSld(xml: string): string {
  return xml
    .replace(/&/g, '&amp;')
    .replace(/<(\/?)([\w:]+)/g, '&lt;<span class="tag">$1$2</span>')
    .replace(/([\w-:]+)=/g, '<span class="attr">$1</span>=')
    .replace(/"([^"]*)"/g, '<span class="val">"$1"</span>')
    .replace(/(&lt;\?[\s\S]*?\?&gt;)/g, '<span class="comment">$1</span>');
}

function apply() {
  if (activeTab.value === 'json') {
    try {
      const styleObj = JSON.parse(localJson.value);
      if (!styleObj.name || !Array.isArray(styleObj.rules)) {
        throw new Error('GeoStyler Style 必须包含 name 和 rules 数组');
      }
      // In a full implementation this would send a patch replacing the entire style.
      // For now we keep the existing component patch flow.
      alert('GeoStyler JSON 编辑应用功能待接入完整 patch 流程');
    } catch (err) {
      alert(`GeoStyler JSON 解析失败：${(err as Error).message}`);
    }
  } else {
    // SymbolizerEditor already applies patches on change; the apply button is a no-op placeholder.
    // A future iteration can batch patches here.
  }
}

function copyInspector() {
  const text = store.sldXml || '';
  if (text) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}
</script>

<style scoped>
.inspector-panel {
  background: var(--panel-right);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(8px);
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.panel-title h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.panel-title span {
  font-size: 10px;
  color: var(--dim);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.panel-tools {
  display: flex;
  gap: 8px;
}

.icon-btn {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 1px solid transparent;
  color: var(--dim);
  cursor: pointer;
  transition: all 0.15s ease;
}

.icon-btn:hover {
  background: var(--elevated);
  border-color: var(--border);
  color: var(--text);
}

.icon-btn svg {
  width: 14px;
  height: 14px;
}

.inspector-split {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.inspector-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-right: 1px solid var(--border);
  background: var(--surface);
}

.inspector-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg);
}

.tabs {
  display: flex;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-right);
  gap: 4px;
  flex-shrink: 0;
}

.tabs button {
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--dim);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tabs button:hover {
  color: var(--muted);
}

.tabs button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.inspector-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface);
}

.tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.code-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--panel-right);
  border-bottom: 1px solid var(--border);
  font-size: 10px;
  color: var(--dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  flex-shrink: 0;
}

.tag-readonly {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--elevated);
  border: 1px solid var(--border);
  font-size: 9px;
  color: var(--muted);
  letter-spacing: 0.04em;
}

.code-editor-editable {
  flex: 1;
  width: 100%;
  resize: none;
  border: none;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  padding: 20px;
  outline: none;
  overflow: auto;
}

.code-editor-editable:focus {
  background: var(--surface);
}

.code-editor {
  flex: 1;
  overflow: auto;
  padding: 20px;
  background: var(--bg);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  color: var(--muted);
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.code-editor :deep(.tag) {
  color: #ff9f7a;
}

.code-editor :deep(.attr) {
  color: #a5b4fc;
}

.code-editor :deep(.val) {
  color: #6ee7b7;
}

.code-editor :deep(.comment) {
  color: var(--dim);
}

.apply-panel {
  padding: 14px 20px;
  border-top: 1px solid var(--border-strong);
  background: var(--panel-right);
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.apply-hint {
  font-size: 10px;
  color: var(--dim);
  line-height: 1.5;
}

.apply-btn {
  width: 100%;
  padding: 11px 16px;
  border-radius: var(--radius-sm);
  background: var(--accent);
  border: 1px solid var(--accent);
  color: var(--bg);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.apply-btn:hover:not(:disabled) {
  box-shadow: 0 0 16px var(--accent-glow);
}

.apply-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.apply-btn svg {
  width: 14px;
  height: 14px;
}

.validation-panel {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  background: var(--panel-right);
  flex-shrink: 0;
}
</style>

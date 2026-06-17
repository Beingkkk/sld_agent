<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSLDStore } from '../../store';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

const store = useSLDStore();

type TabType = 'json' | 'xml' | 'validation';
const activeTab = ref<TabType>('json');

const tabs: { id: TabType; label: string }[] = [
  { id: 'json', label: 'GeoStyler JSON' },
  { id: 'xml', label: 'SLD XML' },
  { id: 'validation', label: '校验' },
];

const jsonContent = computed(() => {
  if (!store.transformResult?.geoStyler) return '// 暂无数据';
  return JSON.stringify(store.transformResult.geoStyler, null, 2);
});

const xmlContent = computed(() => {
  if (!store.transformResult?.sldXml) return '<!-- 暂无数据 -->';
  return store.transformResult.sldXml;
});

function highlightWithLineNumbers(content: string, language: string): string {
  const lines = content.split('\n');
  return lines
    .map((line) => {
      const highlighted = line.trim() === '' ? '&nbsp;' : hljs.highlight(line, { language }).value;
      return `<div class="code-line">${highlighted}</div>`;
    })
    .join('');
}

const highlightedJson = computed(() => {
  return highlightWithLineNumbers(jsonContent.value, 'json');
});

const highlightedXml = computed(() => {
  return highlightWithLineNumbers(xmlContent.value, 'xml');
});

const issues = computed(() => store.issues);

function selectTab(tab: TabType) {
  activeTab.value = tab;
}

function selectNodeFromIssue(path: number[]) {
  const { TreePath } = require('@sldagent/core');
  store.selectNode(new TreePath(path));
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Tabs -->
    <div class="flex items-center border-b border-border-default bg-bg-secondary">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="px-4 py-2 text-xs font-medium transition-colors border-b-2"
        :class="activeTab === tab.id
          ? 'text-accent-teal border-accent-teal bg-bg-tertiary'
          : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-bg-hover'"
        @click="selectTab(tab.id)"
      >
        {{ tab.label }}
        <span
          v-if="tab.id === 'validation' && issues.length > 0"
          class="ml-1 px-1.5 py-0.5 text-xs bg-accent-red/20 text-accent-red rounded"
        >
          {{ issues.length }}
        </span>
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-auto min-h-0">
      <!-- JSON Tab -->
      <div v-if="activeTab === 'json'" class="p-4">
        <pre class="code-block code-with-lines" v-html="highlightedJson"></pre>
      </div>

      <!-- XML Tab -->
      <div v-if="activeTab === 'xml'" class="p-4">
        <pre class="code-block code-with-lines" v-html="highlightedXml"></pre>
      </div>

      <!-- Validation Tab -->
      <div v-if="activeTab === 'validation'" class="p-4">
        <div v-if="issues.length === 0" class="text-sm text-text-tertiary">
          暂无校验问题
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="issue in issues"
            :key="issue.code + issue.path.toString()"
            class="flex items-start gap-2 p-3 rounded-card border-l-2 cursor-pointer hover:bg-bg-hover transition-colors"
            :class="issue.severity === 'error'
              ? 'bg-accent-red/5 border-accent-red'
              : 'bg-accent-amber/5 border-accent-amber'"
            @click="selectNodeFromIssue(issue.path)"
          >
            <span
              class="text-xs mt-0.5"
              :class="issue.severity === 'error' ? 'text-accent-red' : 'text-accent-amber'"
            >
              {{ issue.severity === 'error' ? '✕' : '!' }}
            </span>
            <div class="flex-1">
              <div class="text-sm text-text-primary">{{ issue.message }}</div>
              <div class="text-xs text-text-tertiary mt-0.5">
                {{ issue.code }} · 路径: {{ issue.path.toString() }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.code-with-lines {
  counter-reset: line;
  white-space: pre;
  word-wrap: normal;
}

.code-with-lines :deep(.code-line) {
  counter-increment: line;
  display: block;
}

.code-with-lines :deep(.code-line::before) {
  content: counter(line);
  display: inline-block;
  width: 2.5em;
  margin-right: 1em;
  color: #6e7681;
  text-align: right;
  user-select: none;
}
</style>

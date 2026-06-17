<script setup lang="ts">
import { computed } from 'vue';
import { useSLDStore, type RightPanelTab } from '../../store';
import { TreePath } from '@sldagent/core';
import type { ValidationIssue } from '@sldagent/core';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import MarkdownIt from 'markdown-it';

const store = useSLDStore();
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
});

const activeTab = computed(() => store.activeRightTab);

const tabs: { id: RightPanelTab; label: string }[] = [
  { id: 'json', label: 'GeoStyler JSON' },
  { id: 'xml', label: 'SLD XML' },
  { id: 'validation', label: '校验' },
  { id: 'ai', label: 'AI 解释' },
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

const aiExplanation = computed(() => store.aiExplanation);
const aiWarnings = computed(() => store.aiWarnings);
const aiIssueExplanation = computed(() => store.aiIssueExplanation);
const aiPropertyExplanation = computed(() => store.aiPropertyExplanation);
const aiPropertyContext = computed(() => store.aiPropertyContext);
const aiIssueContext = computed(() => store.aiIssueContext);
const aiLoading = computed(() => store.aiLoading);
const backendStatus = computed(() => store.backendStatus);
const selectedNodeType = computed(() => store.selectedNodeType);
const selectedNode = computed(() => store.selectedNode);

const ruleTitle = computed(() => {
  if (selectedNodeType.value !== 'Rule') return '';
  return selectedNode.value?.data?.name || selectedNode.value?.data?.title || '未命名 Rule';
});

const renderedExplanation = computed(() => md.render(aiExplanation.value));
const renderedIssueExplanation = computed(() => md.render(aiIssueExplanation.value));
const renderedPropertyExplanation = computed(() => md.render(aiPropertyExplanation.value));
const renderedWarnings = computed(() => aiWarnings.value.map((w) => md.render(w)));

function selectTab(tab: RightPanelTab) {
  store.setActiveRightTab(tab);
}

async function handleExplainRule() {
  await store.explainSelectedRule();
}

async function handleExplainIssue(issue: ValidationIssue) {
  await store.explainIssue(issue);
}

function selectNodeFromIssue(path: TreePath) {
  store.selectNode(path);
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Tabs -->
    <div class="flex items-center border-b border-border-default bg-bg-secondary">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="px-4 py-2 text-xs font-medium transition-colors border-b-2 flex items-center gap-1.5"
        :class="activeTab === tab.id
          ? 'text-accent-teal border-accent-teal bg-bg-tertiary'
          : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-bg-hover'"
        @click="selectTab(tab.id)"
      >
        {{ tab.label }}
        <span
          v-if="tab.id === 'validation' && store.issues.length > 0"
          class="ml-1 px-1.5 py-0.5 text-xs bg-accent-red/20 text-accent-red rounded"
        >
          {{ store.issues.length }}
        </span>
        <span
          v-if="tab.id === 'ai' && backendStatus !== 'connected'"
          class="w-1.5 h-1.5 rounded-full bg-accent-red"
          title="后端未连接"
        />
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
        <div v-if="store.issues.length === 0" class="text-sm text-text-tertiary">
          暂无校验问题
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="issue in store.issues"
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
            <div class="flex-1 min-w-0">
              <div class="text-sm text-text-primary">{{ issue.message }}</div>
              <div class="text-xs text-text-tertiary mt-0.5">
                {{ issue.code }} · 路径: {{ issue.path.toString() }}
              </div>
            </div>
            <button
              class="text-xs px-2 py-1 rounded border border-border-default text-text-secondary hover:text-accent-teal hover:border-accent-teal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="AI 解释此问题"
              :disabled="backendStatus !== 'connected'"
              @click.stop="handleExplainIssue(issue)"
            >
              AI 解释
            </button>
          </div>
        </div>
      </div>

      <!-- AI Tab -->
      <div v-if="activeTab === 'ai'" class="p-4 space-y-4">
        <div v-if="backendStatus !== 'connected'" class="text-sm text-accent-amber">
          后端未连接，AI 解释不可用。请确保 `npm run dev:backend` 已启动。
        </div>

        <!-- Context title: what is being explained -->
        <div class="flex items-center gap-2 pb-2 border-b border-border-default">
          <span class="text-xs text-text-tertiary uppercase tracking-wider">AI 解释</span>
          <span class="text-sm font-medium text-accent-teal truncate">
            <template v-if="aiPropertyContext">
              字段 “{{ aiPropertyContext.label }}”
              <span class="text-text-tertiary font-normal">({{ aiPropertyContext.fieldName }})</span>
            </template>
            <template v-else-if="aiIssueContext">
              校验问题 {{ aiIssueContext.code }}
            </template>
            <template v-else-if="selectedNodeType === 'Rule'">
              Rule “{{ ruleTitle }}”
            </template>
            <template v-else>请选择对象</template>
          </span>
        </div>

        <!-- Property explanation -->
        <template v-if="aiPropertyContext">
          <div v-if="aiLoading && !aiPropertyExplanation" class="text-sm text-text-tertiary">
            正在请求 AI 解释...
          </div>
          <div v-if="aiPropertyExplanation" class="panel p-3 border-l-2 border-accent-teal bg-accent-teal/5">
            <div class="markdown-body text-sm text-text-primary" v-html="renderedPropertyExplanation"></div>
          </div>
        </template>

        <!-- Rule explanation -->
        <template v-if="!aiPropertyContext">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-text-primary">Rule AI 解释</span>
            <button
              class="text-xs px-3 py-1.5 rounded bg-accent-teal/10 text-accent-teal hover:bg-accent-teal/20 transition-colors disabled:opacity-50"
              :disabled="aiLoading || selectedNodeType !== 'Rule' || backendStatus !== 'connected'"
              @click="handleExplainRule"
            >
              {{ aiLoading ? '解释中...' : '重新解释' }}
            </button>
          </div>

          <div v-if="selectedNodeType !== 'Rule'" class="text-sm text-text-tertiary">
            请在左侧 SLD 树中选择一个 Rule 节点以获取 AI 解释。
          </div>

          <div v-else-if="aiLoading && !aiExplanation && !aiIssueExplanation" class="text-sm text-text-tertiary">
            正在请求 AI 解释...
          </div>
        </template>

        <!-- Issue-specific explanation -->
        <div v-if="aiIssueExplanation" class="panel p-3 border-l-2 border-accent-blue bg-accent-blue/5">
          <div class="text-xs font-medium text-accent-blue mb-1">校验问题解释</div>
          <div class="markdown-body text-sm text-text-primary" v-html="renderedIssueExplanation"></div>
        </div>

        <!-- Rule explanation -->
        <div v-if="aiExplanation" class="panel p-3">
          <div class="text-xs font-medium text-text-secondary mb-1">规则解释</div>
          <div class="markdown-body text-sm text-text-primary" v-html="renderedExplanation"></div>
        </div>

        <!-- Warnings -->
        <div v-if="aiWarnings.length > 0">
          <div class="text-xs font-medium text-accent-amber mb-2">AI 预警 / 建议</div>
          <div class="space-y-2">
            <div
              v-for="(warning, idx) in renderedWarnings"
              :key="idx"
              class="markdown-body text-sm text-text-primary p-3 rounded-card bg-accent-amber/5 border-l-2 border-accent-amber"
              v-html="warning"
            ></div>
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

/* Markdown rendering styles for AI explanations */
.markdown-body :deep(p) {
  margin-bottom: 0.75rem;
  line-height: 1.6;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  color: #e6edf3;
}

.markdown-body :deep(h1) { font-size: 1.25rem; }
.markdown-body :deep(h2) { font-size: 1.125rem; }
.markdown-body :deep(h3) { font-size: 1rem; }
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) { font-size: 0.9375rem; }

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}

.markdown-body :deep(li) {
  margin-bottom: 0.25rem;
}

.markdown-body :deep(li > ul),
.markdown-body :deep(li > ol) {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}

.markdown-body :deep(code) {
  font-family: 'JetBrains Mono', monospace;
  background-color: #0d1117;
  color: #e6edf3;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.8125rem;
  word-break: break-word;
}

.markdown-body :deep(pre) {
  background-color: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  overflow-x: auto;
}

.markdown-body :deep(pre code) {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  color: inherit;
}

.markdown-body :deep(blockquote) {
  border-left: 3px solid #30363d;
  padding-left: 0.75rem;
  margin-bottom: 0.75rem;
  color: #8b949e;
}

.markdown-body :deep(a) {
  color: #60a5fa;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(hr) {
  border: 0;
  border-top: 1px solid #30363d;
  margin: 1rem 0;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.75rem;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #30363d;
  padding: 0.375rem 0.5rem;
  text-align: left;
}

.markdown-body :deep(th) {
  background-color: #161b22;
  font-weight: 600;
}

.markdown-body :deep(tr:nth-child(even)) {
  background-color: rgba(22, 27, 34, 0.5);
}
</style>

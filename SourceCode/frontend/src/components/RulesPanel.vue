<template>
  <div class="rules-panel">
    <div v-if="!rules.length" class="empty">暂无规则</div>
    <div
      v-for="(rule, idx) in rules"
      :key="idx"
      :class="['rule-card', { active: selectedRuleIdx === idx }]"
      @click="selectRule(idx)"
    >
      <div class="rule-header">
        <span class="rule-name">{{ rule.name || '未命名规则' }}</span>
        <span class="rule-tag">{{ ruleTag(rule) }}</span>
      </div>
      <div class="rule-detail">
        <div v-if="filterSummary(rule)" class="rule-detail-row">
          过滤器：{{ filterSummary(rule) }}
        </div>
        <div v-if="scaleSummary(rule)" class="rule-detail-row">
          比例尺：{{ scaleSummary(rule) }}
        </div>
      </div>
      <div class="rule-actions">
        <button class="rule-action-btn" @click.stop="editFilter(idx)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          编辑过滤器
        </button>
        <button class="rule-action-btn" @click.stop="editSymbol(idx)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          编辑符号
        </button>
        <button class="rule-action-btn" title="删除" @click.stop="removeRule(idx)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    </div>
    <button class="add-btn" @click="addRule">+ 添加规则</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useStyleStore } from '../stores/styleStore';
import type { RuleParams } from '@shared/types';

const store = useStyleStore();
const selectedRuleIdx = ref(0);

const rules = computed(() => store.params?.rules ?? []);

function addRule() {
  const newRule: RuleParams = { name: `New rule ${rules.value.length + 1}`, symbolizers: [] };
  store.applyPatch([{ op: 'add', path: '/rules/-', value: newRule }]);
}

function removeRule(idx: number) {
  store.applyPatch([{ op: 'remove', path: `/rules/${idx}` }]);
}

function selectRule(idx: number) {
  selectedRuleIdx.value = idx;
}

function editFilter(idx: number) {
  selectRule(idx);
  alert('过滤器编辑器待实现完整弹窗');
}

function editSymbol(idx: number) {
  selectRule(idx);
  alert('符号编辑器待实现');
}

function ruleTag(rule: RuleParams): string {
  const sym = rule.symbolizers?.[0];
  if (!sym) return '未定义';
  if (sym.kind === 'Line') return '线符号';
  if (sym.kind === 'Fill') return '面符号';
  if (sym.kind === 'Mark') return '点符号';
  if (sym.kind === 'Text') return '文本';
  return sym.kind;
}

function filterSummary(rule: RuleParams): string {
  if (!rule.filter) return '';
  return JSON.stringify(rule.filter);
}

function scaleSummary(rule: RuleParams): string {
  if (rule.min_scale == null && rule.max_scale == null) return '';
  const min = rule.min_scale ?? 0;
  const max = rule.max_scale ?? '∞';
  return `${min} - ${max}`;
}
</script>

<style scoped>
.rules-panel {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.params-empty,
.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--dim);
  font-size: 12px;
  padding: 40px 20px;
}

.rule-card {
  padding: 14px;
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: all 0.2s ease;
  cursor: pointer;
}

.rule-card:hover {
  border-color: var(--border-strong);
  transform: translateX(2px);
}

.rule-card.active {
  border-color: var(--accent);
  background: rgba(245, 166, 35, 0.05);
}

.rule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.rule-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}

.rule-tag {
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 10px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.rule-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
  color: var(--muted);
}

.rule-detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.rule-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--dim);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.rule-action-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-dim);
}

.rule-action-btn svg {
  width: 11px;
  height: 11px;
}

.add-btn {
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--accent-dim);
  border: 1px solid var(--border-strong);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.add-btn:hover {
  background: rgba(245, 166, 35, 0.15);
  box-shadow: 0 0 16px var(--accent-glow);
}
</style>

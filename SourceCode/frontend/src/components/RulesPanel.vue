<template>
  <div class="rules-panel">
    <div v-if="!rules.length" class="empty">暂无规则</div>
    <div
      v-for="(rule, idx) in rules"
      :key="idx"
      class="rule-item"
    >
      <span>{{ idx + 1 }}. {{ rule.name || '未命名规则' }}</span>
      <button @click="removeRule(idx)" title="删除">×</button>
    </div>
    <button @click="addRule" class="add-btn">+ 添加规则</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useStyleStore } from '../stores/styleStore';
import type { RuleParams } from '@shared/types';

const store = useStyleStore();

const rules = computed(() => store.params?.rules ?? []);

function addRule() {
  const newRule: RuleParams = { name: `New rule ${rules.value.length + 1}`, symbolizers: [] };
  store.applyPatch([{ op: 'add', path: '/rules/-', value: newRule }]);
}

function removeRule(idx: number) {
  store.applyPatch([{ op: 'remove', path: `/rules/${idx}` }]);
}
</script>

<style scoped>
.rules-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rule-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background: #252538;
  border-radius: 4px;
}
.add-btn {
  background: #2a4a6a;
  border: none;
  color: #fff;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
}
</style>

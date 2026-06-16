<template>
  <div class="validation-panel">
    <div v-if="!validation" class="params-empty">暂无校验结果</div>
    <div v-else class="report">
      <div class="validation-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        验证状态 — {{ validation.passed ? '校验通过' : '校验未通过' }}
      </div>
      <div class="check-list">
        <div v-if="validation.schema" :class="['check-item', validation.schema.passed ? 'pass' : 'fail']">
          <span class="check-dot"></span>
          JSON Schema：{{ validation.schema.passed ? '通过' : '失败' }}
          <span v-if="validation.schema.message"> — {{ validation.schema.message }}</span>
        </div>
        <div v-if="validation.xsd" :class="['check-item', validation.xsd.passed ? 'pass' : 'fail']">
          <span class="check-dot"></span>
          XSD：{{ validation.xsd.passed ? '通过' : '失败' }}
          <span v-if="validation.xsd.message"> — {{ validation.xsd.message }}</span>
        </div>
        <div v-if="validation.roundtrip" :class="['check-item', validation.roundtrip.passed ? 'pass' : 'fail']">
          <span class="check-dot"></span>
          Roundtrip：{{ validation.roundtrip.passed ? '通过' : '失败' }}
          <span v-if="validation.roundtrip.message"> — {{ validation.roundtrip.message }}</span>
        </div>
      </div>

      <ul v-if="validation?.errors?.length" class="errors">
        <li v-for="(err, idx) in validation.errors" :key="idx">
          [{{ err.source }}] {{ err.message }}
          <span v-if="err.location"> ({{ err.location }})]</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useStyleStore } from '../stores/styleStore';

const store = useStyleStore();
const validation = computed(() => store.validation);
</script>

<style scoped>
.validation-panel {
  padding: 0;
}

.params-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--dim);
  font-size: 12px;
  padding: 20px;
}

.validation-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: var(--dim);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 12px;
  font-weight: 600;
}

.validation-title svg {
  width: 12px;
  height: 12px;
}

.check-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--muted);
}

.check-item.pass {
  color: var(--teal);
}

.check-item.fail {
  color: var(--error);
}

.check-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dim);
  transition: all 0.3s ease;
}

.check-item.pass .check-dot {
  background: var(--teal);
  box-shadow: 0 0 8px var(--teal);
}

.check-item.fail .check-dot {
  background: var(--error);
  box-shadow: 0 0 8px var(--error);
}

.errors {
  margin-top: 12px;
  padding-left: 16px;
  color: var(--error);
  font-size: 12px;
}

.errors li {
  margin-bottom: 4px;
}
</style>

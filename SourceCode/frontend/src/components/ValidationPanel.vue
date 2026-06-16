<template>
  <div class="validation-panel">
    <div v-if="!validation" class="empty">暂无校验结果</div>
    <div v-else class="report">
      <div class="summary" :class="{ ok: validation.passed, fail: !validation.passed }">
        {{ validation.passed ? '✅ 校验通过' : '❌ 校验未通过' }}
      </div>
      <div class="section" v-if="validation.schema">
        <strong>JSON Schema</strong>: {{ validation.schema.passed ? '通过' : '失败' }}
        <span v-if="validation.schema.message"> — {{ validation.schema.message }}</span>
      </div>
      <div class="section" v-if="validation.xsd">
        <strong>XSD</strong>: {{ validation.xsd.passed ? '通过' : '失败' }}
        <span v-if="validation.xsd.message"> — {{ validation.xsd.message }}</span>
      </div>
      <div class="section" v-if="validation.roundtrip">
        <strong>Roundtrip</strong>: {{ validation.roundtrip.passed ? '通过' : '失败' }}
        <span v-if="validation.roundtrip.message"> — {{ validation.roundtrip.message }}</span>
      </div>

      <ul v-if="validation?.errors?.length" class="errors">
        <li v-for="(err, idx) in validation.errors" :key="idx">
          [{{ err.source }}] {{ err.message }}
          <span v-if="err.location"> ({{ err.location }})</span>
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
  padding: 8px;
}
.empty {
  color: #888;
}
.summary {
  font-weight: bold;
  margin-bottom: 12px;
}
.summary.ok {
  color: #4ade80;
}
.summary.fail {
  color: #f87171;
}
.section {
  margin-bottom: 8px;
  color: #ccc;
}
.errors {
  margin-top: 12px;
  padding-left: 16px;
  color: #f87171;
}
.errors li {
  margin-bottom: 4px;
}
</style>

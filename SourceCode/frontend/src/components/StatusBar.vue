<template>
  <div class="status-bar">
    <span :class="['status', store.connected ? 'ok' : 'err']">
      {{ store.connected ? '已连接' : '未连接' }}
    </span>
    <span v-if="store.validation">
      {{ store.validation.passed ? '校验通过' : '校验失败' }}
    </span>
    <span v-if="store.busy">处理中...</span>
  </div>
</template>

<script setup lang="ts">
import { useStyleStore } from '../stores/styleStore';

const store = useStyleStore();
</script>

<style scoped>
.status-bar {
  height: 28px;
  background: #111122;
  border-top: 1px solid #333;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 12px;
  font-size: 12px;
  color: #aaa;
}

.status.ok {
  color: #4ade80;
}

.status.err {
  color: #f87171;
}
</style>

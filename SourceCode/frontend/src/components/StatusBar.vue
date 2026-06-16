<template>
  <footer class="status-bar">
    <div class="status-left">
      <div class="status-item" :class="{ online: store.connected }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        {{ store.connected ? 'Agent 就绪' : '未连接' }}
      </div>
      <div class="status-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        最后生成：{{ lastGenerated }}
      </div>
    </div>
    <div class="status-right">
      <div class="status-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        geostyler-sld-parser
      </div>
      <div class="status-item active">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        {{ runtimeMode }}
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useStyleStore } from '../stores/styleStore';

const store = useStyleStore();

const runtimeMode = computed(() => {
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    return '桌面模式';
  }
  return '浏览器模式';
});

const lastGenerated = computed(() => {
  // Store does not currently track a last generated timestamp; show a placeholder.
  return store.currentStyle ? '刚刚' : '—';
});
</script>

<style scoped>
.status-bar {
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--surface);
  border-top: 1px solid var(--border-strong);
  font-size: 10px;
  color: var(--dim);
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.status-left,
.status-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 7px;
}

.status-item svg {
  width: 11px;
  height: 11px;
}

.status-item.online {
  color: var(--teal);
}

.status-item.active {
  color: var(--accent);
}
</style>

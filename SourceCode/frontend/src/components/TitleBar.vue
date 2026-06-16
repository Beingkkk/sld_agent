<template>
  <div class="title-bar" @dblclick="onTitleDoubleClick">
    <div class="brand-mini">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7.5v9L12 22l10-5.5v-9L12 2z"/>
        <path d="M12 12L2 7.5"/>
        <path d="M12 12v10"/>
        <path d="M12 12l10-4.5"/>
      </svg>
      SLDAgent
    </div>
    <div class="window-controls">
      <button class="window-btn minimize" aria-label="最小化" @click="onMinimize">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <button class="window-btn maximize" :aria-label="isExpanded ? '还原' : '最大化'" @click="onMaximize">
        <svg v-if="!isExpanded" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3"/>
          <path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
          <path d="M3 16v3a2 2 0 0 0 2 2h3"/>
          <path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
        </svg>
      </button>
      <button class="window-btn close" aria-label="关闭" @click="onClose">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const isExpanded = ref(false);

async function syncState() {
  const state = await window.electronAPI?.getWindowState();
  if (state) {
    isExpanded.value = state.isMaximized;
  }
}

onMounted(() => {
  syncState();
  window.addEventListener('resize', syncState);
});

onUnmounted(() => {
  window.removeEventListener('resize', syncState);
});

async function onMinimize() {
  await window.electronAPI?.minimizeWindow();
}

async function onMaximize() {
  const expanded = await window.electronAPI?.toggleMaximize();
  if (typeof expanded === 'boolean') {
    isExpanded.value = expanded;
  }
}

async function onClose() {
  await window.electronAPI?.closeWindow();
}

async function onTitleDoubleClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest('.window-controls')) {
    return;
  }
  await onMaximize();
}
</script>

<style scoped>
.title-bar {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-strong);
  -webkit-app-region: drag;
  app-region: drag;
  flex-shrink: 0;
}

.brand-mini {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--accent);
}

.brand-mini svg {
  width: 16px;
  height: 16px;
}

.window-controls {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
  app-region: no-drag;
  pointer-events: auto;
}

.window-btn {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  padding: 0;
  pointer-events: auto;
}

.window-btn svg {
  width: 10px;
  height: 10px;
  color: var(--bg);
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}

.window-btn:hover {
  transform: scale(1.15);
}

.window-btn:hover svg {
  opacity: 1;
}

.window-btn.minimize {
  background: var(--accent);
  box-shadow: 0 0 8px rgba(245, 166, 35, 0.4);
}

.window-btn.maximize {
  background: var(--muted);
  box-shadow: 0 0 8px rgba(154, 149, 138, 0.3);
}

.window-btn.close {
  background: var(--error);
  box-shadow: 0 0 8px rgba(255, 77, 79, 0.4);
}
</style>

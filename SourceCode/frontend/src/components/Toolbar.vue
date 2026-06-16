<template>
  <header class="toolbar">
    <div class="toolbar-left">
      <div class="brand">
        <div class="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7.5v9L12 22l10-5.5v-9L12 2z"/>
            <path d="M12 12L2 7.5"/>
            <path d="M12 12v10"/>
            <path d="M12 12l10-4.5"/>
          </svg>
        </div>
        <div class="brand-text">
          <div class="brand-name">SLDAgent</div>
          <div class="brand-tagline">Cartographer's Engine</div>
        </div>
      </div>

      <div class="toolbar-actions">
        <button class="tool-btn" @click="importSld">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          导入 SLD
        </button>
        <button class="tool-btn primary" @click="exportSld">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          导出 SLD
        </button>
        <button class="tool-btn" @click="openSettings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          设置
        </button>
      </div>
    </div>

    <div class="toolbar-right">
      <div class="status-cluster">
        <div class="status-pill" :class="{ online: store.connected }">
          {{ store.connected ? 'LLM 在线' : '未连接' }}
        </div>
        <div class="status-pill active">SLD 1.0.0</div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useStyleStore } from '../stores/styleStore';
import { createFileService } from '../services/fileService';
import SldParser from 'geostyler-sld-parser';

const store = useStyleStore();
const fileService = createFileService();

async function importSld() {
  const file = await fileService.openSld();
  if (!file) return;
  const parser = new SldParser();
  const { output, errors } = await parser.readStyle(file.content);
  if (errors?.length) {
    alert(`导入失败: ${errors.map((e: { message: string }) => e.message).join(', ')}`);
    return;
  }
  if (!output) {
    alert('导入失败: 无法解析 SLD');
    return;
  }
  await store.importStyle(output);
}

async function exportSld() {
  const xml = await store.exportSld();
  await fileService.saveSld(`${store.params?.style_name || 'style'}.sld`, xml);
}

function openSettings() {
  alert('设置面板待实现');
}
</script>

<style scoped>
.toolbar {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-strong);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 28px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-mark {
  width: 38px;
  height: 38px;
  border-radius: var(--radius);
  background: linear-gradient(135deg, var(--accent) 0%, #d4881a 100%);
  display: grid;
  place-items: center;
  box-shadow: 0 0 24px var(--accent-glow);
}

.brand-mark svg {
  width: 20px;
  height: 20px;
  color: var(--bg);
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.brand-name {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
}

.brand-tagline {
  font-size: 10px;
  color: var(--dim);
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: var(--radius-sm);
  background: var(--elevated);
  border: 1px solid var(--border);
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s ease;
}

.tool-btn:hover {
  background: var(--raised);
  border-color: var(--border-strong);
  color: var(--text);
  transform: translateY(-1px);
}

.tool-btn svg {
  width: 14px;
  height: 14px;
}

.tool-btn.primary {
  background: var(--accent-dim);
  border-color: var(--border-strong);
  color: var(--accent);
}

.tool-btn.primary:hover {
  background: rgba(245, 166, 35, 0.15);
  box-shadow: 0 0 20px var(--accent-glow);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-cluster {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--elevated);
  border: 1px solid var(--border);
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
}

.status-pill::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
}

.status-pill.online {
  color: var(--teal);
  border-color: rgba(0, 212, 170, 0.2);
  background: var(--teal-dim);
}

.status-pill.active {
  color: var(--accent);
  border-color: var(--border-strong);
  background: var(--accent-dim);
}
</style>

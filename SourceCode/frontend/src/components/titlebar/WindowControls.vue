<script setup lang="ts">
function minimize() {
  window.electronAPI?.minimizeWindow?.();
}

function maximize() {
  window.electronAPI?.maximizeWindow?.();
}

function close() {
  window.electronAPI?.closeWindow?.();
}
</script>

<template>
  <div class="flex items-center" style="-webkit-app-region: no-drag;">
    <button
      class="h-10 w-10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
      @click="minimize"
      title="最小化"
    >
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </button>
    <button
      class="h-10 w-10 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
      @click="maximize"
      title="最大化"
    >
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="1" />
      </svg>
    </button>
    <button
      class="h-10 w-10 flex items-center justify-center text-text-secondary hover:text-accent-red hover:bg-accent-red/10 transition-colors"
      @click="close"
      title="关闭"
    >
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
</template>

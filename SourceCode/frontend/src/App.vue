<template>
  <div class="sld-app">
    <div class="cartographer-grid"></div>
    <TitleBar v-if="isElectron" />
    <Toolbar />
    <div class="workspace">
      <AssistantPanel />
      <MapPreview />
      <InspectorPanel />
    </div>
    <StatusBar />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import TitleBar from './components/TitleBar.vue';
import Toolbar from './components/Toolbar.vue';
import AssistantPanel from './components/AssistantPanel.vue';
import MapPreview from './components/MapPreview.vue';
import InspectorPanel from './components/InspectorPanel.vue';
import StatusBar from './components/StatusBar.vue';

const isElectron = computed(() => {
  if (typeof window === 'undefined') return false;
  return !!window.electronAPI?.isElectron;
});
</script>

<style scoped>
.sld-app {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
}

.cartographer-grid {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background-image:
    linear-gradient(rgba(240, 160, 48, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(240, 160, 48, 0.025) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at 30% 20%, black 0%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at 30% 20%, black 0%, transparent 70%);
}

.cartographer-grid::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 70% 80%, rgba(0, 212, 170, 0.025) 0%, transparent 45%);
}

.workspace {
  flex: 1;
  display: grid;
  grid-template-columns: 480px minmax(360px, 1fr) 840px;
  overflow: hidden;
  background: var(--bg);
}

@media (max-width: 1440px) {
  .workspace {
    grid-template-columns: 380px minmax(340px, 1fr) 540px;
  }
}

@media (max-width: 1280px) {
  .workspace {
    grid-template-columns: 340px minmax(300px, 1fr) 460px;
  }
}

@media (max-width: 1100px) {
  .workspace {
    grid-template-columns: 300px minmax(260px, 1fr) 420px;
  }
}
</style>

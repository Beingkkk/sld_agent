<template>
  <div class="sld-app">
    <Toolbar />
    <div class="sld-body">
      <AssistantPanel />
      <MapPreview />
      <InspectorPanel />
    </div>
    <StatusBar />
  </div>
</template>

<script setup lang="ts">
import Toolbar from './components/Toolbar.vue';
import AssistantPanel from './components/AssistantPanel.vue';
import MapPreview from './components/MapPreview.vue';
import InspectorPanel from './components/InspectorPanel.vue';
import StatusBar from './components/StatusBar.vue';
</script>

<style scoped>
.sld-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #1a1a2e;
  color: #e0e0e0;
}

.sld-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>

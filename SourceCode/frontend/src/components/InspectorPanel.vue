<template>
  <div class="inspector-panel">
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ tab }}
      </button>
    </div>
    <div class="panel-body">
      <div v-if="activeTab === '参数'"><SymbolizerEditor /></div>
      <div v-if="activeTab === '规则'"><RulesPanel /></div>
      <div v-if="activeTab === '校验'"><ValidationPanel /></div>
      <pre v-if="activeTab === 'GeoStyler'">{{ JSON.stringify(store.currentStyle, null, 2) }}</pre>
      <pre v-if="activeTab === 'SLD'">{{ store.sldXml }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useStyleStore } from '../stores/styleStore';
import RulesPanel from './RulesPanel.vue';
import SymbolizerEditor from './SymbolizerEditor.vue';
import ValidationPanel from './ValidationPanel.vue';

const store = useStyleStore();
const tabs = ['参数', '规则', '校验', 'GeoStyler', 'SLD'];
const activeTab = ref('参数');
</script>

<style scoped>
.inspector-panel {
  width: 420px;
  border-left: 1px solid #333;
  display: flex;
  flex-direction: column;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #333;
}

.tabs button {
  flex: 1;
  background: transparent;
  border: none;
  color: #aaa;
  padding: 10px;
  cursor: pointer;
}

.tabs button.active {
  color: #fff;
  border-bottom: 2px solid #4a9eff;
}

.panel-body {
  flex: 1;
  overflow: auto;
  padding: 12px;
  font-size: 12px;
}

pre {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>

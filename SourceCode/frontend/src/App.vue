<script setup lang="ts">
import AppTitleBar from './components/titlebar/AppTitleBar.vue';
import SLDTreePanel from './components/tree/SLDTreePanel.vue';
import PropertyForm from './components/property/PropertyForm.vue';
import MapPreview from './components/preview/MapPreview.vue';
import CodePanel from './components/code/CodePanel.vue';
</script>

<template>
  <div class="h-full w-full flex flex-col bg-bg-primary">
    <!-- Title Bar -->
    <AppTitleBar />

    <!-- Main Content: Three Column Layout -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left Panel: SLD Tree -->
      <div class="flex-1 min-w-[220px] max-w-[320px] flex flex-col border-r border-border-default">
        <div class="px-4 py-2 text-xs font-medium text-text-secondary uppercase tracking-wider border-b border-border-default">
          SLD 树
        </div>
        <div class="flex-1 overflow-auto p-2">
          <SLDTreePanel />
        </div>
      </div>

      <!-- Middle Panel: Property Editor + Map Preview -->
      <div class="flex-[2] flex flex-col border-r border-border-default min-w-0">
        <!-- Property Editor -->
        <div class="flex-1 overflow-auto p-4 min-h-0">
          <PropertyForm />
        </div>
        <!-- Map Preview -->
        <div class="h-[45%] min-h-[280px] border-t border-border-default">
          <MapPreview />
        </div>
      </div>

      <!-- Right Panel: Code + Validation -->
      <div class="flex-1 min-w-[280px] max-w-[420px] flex flex-col">
        <CodePanel />
      </div>
    </div>
  </div>
</template>

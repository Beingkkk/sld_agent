<template>
  <div ref="mapContainer" class="map-preview"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import { Point, LineString, Polygon } from 'ol/geom';
import { useMapPreview } from '../composables/useMapPreview';
import { useStyleStore } from '../stores/styleStore';

const mapContainer = ref<HTMLDivElement | null>(null);
const store = useStyleStore();
const { applyStyle } = useMapPreview();

let map: Map | null = null;
let vectorLayer: VectorLayer<any> | null = null;

onMounted(() => {
  if (!mapContainer.value) return;

  const source = new VectorSource({
    features: createSampleFeatures(),
  });

  vectorLayer = new VectorLayer({ source });

  map = new Map({
    target: mapContainer.value,
    layers: [
      new TileLayer({ source: new OSM() }),
      vectorLayer,
    ],
    view: new View({
      center: [0, 0],
      zoom: 4,
    }),
  });

  if (store.currentStyle) {
    applyStyle(vectorLayer, store.currentStyle);
  }
});

watch(() => store.currentStyle, (style) => {
  if (style && vectorLayer) {
    applyStyle(vectorLayer, style);
  }
});

function createSampleFeatures(): Feature[] {
  return [
    new Feature(new Point([0, 0])),
    new Feature(new LineString([[-1e6, -1e6], [1e6, 1e6]])),
    new Feature(new Polygon([[[-1e6, 0], [0, 1e6], [1e6, 0], [0, -1e6], [-1e6, 0]]])),
  ];
}
</script>

<style scoped>
.map-preview {
  flex: 1;
  background: #111;
}
</style>

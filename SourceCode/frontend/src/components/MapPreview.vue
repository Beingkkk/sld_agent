<template>
  <div class="map-panel">
    <div class="map-toolbar">
      <div class="map-control-group">
        <button class="map-control-btn active" title="平移" @click="setTool('pan')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M19 9l3 3-3 3M9 19l3 3 3-3"/>
            <path d="M2 12h20M12 2v20"/>
          </svg>
        </button>
        <button class="map-control-btn" title="框选放大" @click="setTool('zoom')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button class="map-control-btn" title="重置视图" @click="resetView">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </button>
      </div>
      <div class="layer-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"/>
          <polyline points="2 17 12 22 22 17"/>
          <polyline points="2 12 12 17 22 12"/>
        </svg>
        <strong>{{ layerName }}</strong> · {{ datasetLabel }}
      </div>
    </div>

    <div ref="mapContainer" class="map-preview"></div>

    <div class="map-overlay-info">
      <div>坐标系：<span class="coord">EPSG:3857</span></div>
      <div style="margin-top: 4px;">比例尺：<span class="coord">{{ mapScale }}</span></div>
      <div style="margin-top: 8px; font-size: 9px; color: var(--dim);">底图 &copy; CARTO &copy; OSM contributors · 示例数据</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import { Point, LineString, Polygon } from 'ol/geom';
import { useMapPreview } from '../composables/useMapPreview';
import { useStyleStore } from '../stores/styleStore';

const mapContainer = ref<HTMLDivElement | null>(null);
const store = useStyleStore();
const { applyStyle, createFeaturesFromGeoJSON, fitViewToExtent } = useMapPreview();

const activeTool = ref('pan');
const mapScale = ref('1 : 50,000');

const layerName = computed(() => {
  const name = store.currentStyle?.name;
  return name || 'SampleLayer';
});

const datasetLabel = computed(() => {
  if (store.activeDataset) {
    return `${store.activeDataset.name} (${store.activeDataset.featureCount})`;
  }
  return '内置示例几何';
});

let map: Map | null = null;
let vectorLayer: VectorLayer<any> | null = null;

onMounted(async () => {
  if (!mapContainer.value) return;

  const source = new VectorSource();
  vectorLayer = new VectorLayer({ source });

  map = new Map({
    target: mapContainer.value,
    layers: [
      new TileLayer({
        source: new XYZ({
          url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          attributions: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }),
      }),
      vectorLayer,
    ],
    view: new View({
      center: [0, 0],
      zoom: 4,
    }),
    controls: [],
  });

  map.on('moveend', updateScale);
  updateScale();

  await store.loadSampleDatasets();

  const geometryType = store.params?.geometry_type;
  if (geometryType) {
    await store.selectDatasetForGeometry(geometryType);
  }

  if (!store.activeDataset) {
    source.addFeatures(createSampleFeatures());
  }

  if (store.currentStyle && vectorLayer) {
    applyStyle(vectorLayer, store.currentStyle);
  }
});

watch(() => store.activeDataset, (dataset) => {
  if (!dataset || !vectorLayer || !map) return;
  const source = vectorLayer.getSource();
  if (!source) return;

  source.clear();
  const features = createFeaturesFromGeoJSON(dataset.geojson);
  source.addFeatures(features);
  fitViewToExtent(map, dataset.extent);

  if (store.currentStyle) {
    applyStyle(vectorLayer, store.currentStyle);
  }
});

watch(() => store.currentStyle, (style) => {
  if (style && vectorLayer) {
    applyStyle(vectorLayer, style);
  }
});

watch(() => store.params?.geometry_type, (geometryType) => {
  if (geometryType) {
    store.selectDatasetForGeometry(geometryType);
  }
});

function setTool(tool: string) {
  activeTool.value = tool;
}

function resetView() {
  map?.getView().animate({ center: [0, 0], zoom: 4 });
}

function updateScale() {
  const view = map?.getView();
  if (!view) return;
  const resolution = view.getResolution();
  const mpu = view.getProjection().getMetersPerUnit();
  if (!resolution || !mpu) return;
  const scale = Math.round(resolution * mpu * 39.37 * 96);
  mapScale.value = `1 : ${scale.toLocaleString()}`;
}

/** Fallback hard-coded sample geometries used when no backend dataset is available. */
function createSampleFeatures(): Feature[] {
  return [
    new Feature(new Point([0, 0])),
    new Feature(new LineString([[-1e6, -1e6], [1e6, 1e6]])),
    new Feature(new Polygon([[[-1e6, 0], [0, 1e6], [1e6, 0], [0, -1e6], [-1e6, 0]]])),
  ];
}
</script>

<style scoped>
.map-panel {
  position: relative;
  background: var(--panel-center);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.map-toolbar {
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  pointer-events: none;
}

.map-toolbar > * {
  pointer-events: auto;
}

.map-control-group {
  display: flex;
  gap: 8px;
  padding: 6px;
  background: rgba(17, 17, 20, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.map-control-btn {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 1px solid transparent;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.map-control-btn:hover {
  background: var(--elevated);
  color: var(--text);
}

.map-control-btn.active {
  background: var(--accent-dim);
  border-color: var(--border-strong);
  color: var(--accent);
}

.map-control-btn svg {
  width: 15px;
  height: 15px;
}

.layer-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(17, 17, 20, 0.9);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 11px;
  color: var(--muted);
  box-shadow: var(--shadow);
}

.layer-badge strong {
  color: var(--text);
  font-weight: 500;
}

.map-preview {
  flex: 1;
  width: 100%;
  background: var(--bg);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}

.map-overlay-info {
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 10;
  padding: 12px 16px;
  background: rgba(17, 17, 20, 0.92);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 11px;
  color: var(--muted);
  box-shadow: var(--shadow);
}

.map-overlay-info .coord {
  font-family: var(--font-mono);
  color: var(--text);
  letter-spacing: 0.04em;
}
</style>

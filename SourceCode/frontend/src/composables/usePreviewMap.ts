import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { Map, View } from 'ol';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { GeoJSON } from 'ol/format';
import { fromLonLat } from 'ol/proj';
import type { PreviewGeometryType } from '../services/preview-style';

import pointSampleUrl from '@data/sample/sld_cookbook_point.geojson?url';
import lineSampleUrl from '@data/sample/sld_cookbook_line.geojson?url';
import polygonSampleUrl from '@data/sample/sld_cookbook_polygon.geojson?url';

const sampleFiles: Record<PreviewGeometryType, string> = {
  Mark: pointSampleUrl,
  Text: pointSampleUrl,
  Line: lineSampleUrl,
  Fill: polygonSampleUrl,
};

async function loadGeoJSON(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

export interface UsePreviewMapOptions {
  onReady?: () => void;
}

export function usePreviewMap(
  containerRef: Ref<HTMLDivElement | null>,
  options: UsePreviewMapOptions = {},
) {
  const map = ref<Map | null>(null);
  const vectorLayer = ref<any>(null);
  const vectorSource = ref<any>(null);
  const isLoading = ref(false);
  const loadError = ref<string | null>(null);

  function setStyle(style: any) {
    const layer = vectorLayer.value;
    if (!layer) return;
    layer.setStyle(style);
    layer.changed();
  }

  async function loadData(geomType: PreviewGeometryType) {
    const source = vectorSource.value;
    if (!source) return;

    isLoading.value = true;
    loadError.value = null;

    const fileUrl = sampleFiles[geomType] || sampleFiles.Fill;

    try {
      const data = await loadGeoJSON(fileUrl);
      source.clear();
      const features = new GeoJSON().readFeatures(data, {
        featureProjection: 'EPSG:3857',
      });
      source.addFeatures(features);

      if (map.value && source.getExtent()) {
        map.value.getView().fit(source.getExtent(), {
          padding: [50, 50, 50, 50],
          maxZoom: 16,
        });
      }
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : '示例数据加载失败';
      source.clear();
    } finally {
      isLoading.value = false;
    }
  }

  function initMap() {
    const container = containerRef.value;
    if (!container) return;

    vectorSource.value = new VectorSource();
    vectorLayer.value = new VectorLayer({
      source: vectorSource.value,
    });

    map.value = new Map({
      target: container,
      layers: [vectorLayer.value],
      view: new View({
        center: fromLonLat([0, 0]),
        zoom: 2,
      }),
    });

    options.onReady?.();
  }

  function destroyMap() {
    if (map.value) {
      map.value.setTarget(undefined);
      map.value = null;
    }
    vectorLayer.value = null;
    vectorSource.value = null;
  }

  onMounted(initMap);
  onUnmounted(destroyMap);

  return {
    map,
    vectorLayer,
    vectorSource,
    isLoading,
    loadError,
    loadData,
    setStyle,
  };
}

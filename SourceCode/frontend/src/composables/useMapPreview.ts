import type VectorLayer from 'ol/layer/Vector';
import type { Map } from 'ol';
import GeoJSON from 'ol/format/GeoJSON';
import { transformExtent } from 'ol/proj';
import type { GeoJSONFeatureCollection } from '@shared/types';

export function useMapPreview() {
  async function applyStyle(layer: VectorLayer<any>, style: unknown) {
    const { default: OpenLayersParser } = await import('geostyler-openlayers-parser');
    const parser = new OpenLayersParser();
    const { output: olStyle } = await parser.writeStyle(style as never);
    layer.setStyle(olStyle);
  }

  function createFeaturesFromGeoJSON(geojson: GeoJSONFeatureCollection) {
    return new GeoJSON().readFeatures(geojson, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    });
  }

  function fitViewToExtent(map: Map, extent4326: [number, number, number, number]) {
    try {
      const extent3857 = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');
      map.getView().fit(extent3857, { padding: [40, 40, 40, 40], maxZoom: 16 });
    } catch {
      // Ignore invalid extents; the default view will be used.
    }
  }

  return { applyStyle, createFeaturesFromGeoJSON, fitViewToExtent };
}

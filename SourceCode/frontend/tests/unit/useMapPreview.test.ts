import { describe, it, expect, vi, beforeEach } from 'vitest';

const readFeatures = vi.fn();
const transformExtent = vi.fn();
const fit = vi.fn();

vi.mock('ol/format/GeoJSON', () => ({
  default: vi.fn(() => ({
    readFeatures: (...args: unknown[]) => readFeatures(...args),
  })),
}));

vi.mock('ol/proj', () => ({
  transformExtent: (...args: unknown[]) => transformExtent(...args),
}));

import { useMapPreview } from '../../src/composables/useMapPreview';

describe('useMapPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates features from GeoJSON with correct projections', () => {
    readFeatures.mockReturnValueOnce([{ type: 'feature' }]);
    const { createFeaturesFromGeoJSON } = useMapPreview();
    const geojson = { type: 'FeatureCollection', features: [] } as const;

    const features = createFeaturesFromGeoJSON(geojson);

    expect(readFeatures).toHaveBeenCalledWith(geojson, {
      featureProjection: 'EPSG:3857',
      dataProjection: 'EPSG:4326',
    });
    expect(features).toEqual([{ type: 'feature' }]);
  });

  it('fits view to transformed extent', () => {
    transformExtent.mockReturnValueOnce([0, 0, 10, 10]);
    const { fitViewToExtent } = useMapPreview();
    const extent: [number, number, number, number] = [0, 0, 10, 10];
    const map = {
      getView: vi.fn(() => ({ fit })),
    } as unknown as import('ol').Map;

    fitViewToExtent(map, extent);

    expect(transformExtent).toHaveBeenCalledWith(extent, 'EPSG:4326', 'EPSG:3857');
    expect(fit).toHaveBeenCalledWith([0, 0, 10, 10], { padding: [40, 40, 40, 40], maxZoom: 16 });
  });

  it('ignores invalid extents', () => {
    transformExtent.mockImplementationOnce(() => {
      throw new Error('Invalid extent');
    });

    const { fitViewToExtent } = useMapPreview();
    const map = {
      getView: vi.fn(() => ({ fit })),
    } as unknown as import('ol').Map;

    expect(() => fitViewToExtent(map, [NaN, NaN, NaN, NaN])).not.toThrow();
    expect(fit).not.toHaveBeenCalled();
  });
});

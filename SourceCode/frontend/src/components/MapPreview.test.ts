import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, ref } from 'vue';
import MapPreview from './MapPreview.vue';
import type { Style } from 'geostyler-style';
import type { VueWrapper } from '@vue/test-utils';

const mockApplyStyle = vi.fn();
const mockCreateFeaturesFromGeoJSON = vi.fn(() => [{ type: 'feature-from-geojson' }]);
const mockFitViewToExtent = vi.fn();
const mockClear = vi.fn();
const mockAddFeatures = vi.fn();
const mockGetSource = vi.fn(() => ({
  clear: mockClear,
  addFeatures: mockAddFeatures,
}));
const mockSetTarget = vi.fn();
const mockViewFit = vi.fn();
const mockMapInstance = {
  setTarget: mockSetTarget,
  on: vi.fn(),
  getView: vi.fn(() => ({
    getResolution: vi.fn(() => 1000),
    getProjection: vi.fn(() => ({ getMetersPerUnit: vi.fn(() => 1) })),
    fit: mockViewFit,
  })),
};
const mockVectorLayerInstance = {
  getSource: mockGetSource,
};

vi.mock('../composables/useMapPreview', () => ({
  useMapPreview: () => ({
    applyStyle: mockApplyStyle,
    createFeaturesFromGeoJSON: mockCreateFeaturesFromGeoJSON,
    fitViewToExtent: mockFitViewToExtent,
  }),
}));

const mockLoadSampleDatasets = vi.fn().mockResolvedValue(undefined);
const mockSelectDatasetForGeometry = vi.fn().mockResolvedValue(undefined);

vi.mock('../stores/styleStore', async () => {
  const { ref } = await import('vue');
  const currentStyleRef = ref<Style | undefined>(undefined);
  const activeDatasetRef = ref<unknown>(undefined);
  const paramsRef = ref<unknown>(undefined);
  return {
    useStyleStore: () => ({
      get currentStyle() {
        return currentStyleRef.value;
      },
      get activeDataset() {
        return activeDatasetRef.value;
      },
      get params() {
        return paramsRef.value;
      },
      loadSampleDatasets: mockLoadSampleDatasets,
      selectDatasetForGeometry: mockSelectDatasetForGeometry,
    }),
    __setCurrentStyle: (style: Style | undefined) => {
      currentStyleRef.value = style;
    },
    __setActiveDataset: (dataset: unknown) => {
      activeDatasetRef.value = dataset;
    },
    __setParams: (params: unknown) => {
      paramsRef.value = params;
    },
  };
});

// @ts-ignore - provided by mocked module
import { __setCurrentStyle, __setActiveDataset, __setParams } from '../stores/styleStore';

vi.mock('ol', () => ({
  Map: vi.fn(() => mockMapInstance),
  View: vi.fn(),
  Feature: vi.fn((geometry) => ({ geometry, type: 'feature' })),
}));

vi.mock('ol/layer/Tile', () => ({
  default: vi.fn(() => ({ type: 'tile-layer' })),
}));

vi.mock('ol/source/XYZ', () => ({
  default: vi.fn(() => ({ type: 'xyz' })),
}));

vi.mock('ol/layer/Vector', () => ({
  default: vi.fn(() => mockVectorLayerInstance),
}));

vi.mock('ol/source/Vector', () => ({
  default: vi.fn(() => ({
    type: 'vector-source',
    features: [],
    clear: mockClear,
    addFeatures: mockAddFeatures,
  })),
}));

vi.mock('ol/geom', () => ({
  Point: vi.fn(() => ({ type: 'Point' })),
  LineString: vi.fn(() => ({ type: 'LineString' })),
  Polygon: vi.fn(() => ({ type: 'Polygon' })),
}));

const simpleStyle: Style = {
  name: 'Test',
  rules: [{
    name: 'Default',
    symbolizers: [{ kind: 'Mark', wellKnownName: 'circle', size: 8, color: '#FF0000' } as unknown as Record<string, unknown>],
  }],
} as unknown as Style;

const sampleDataset = {
  id: 'sld_cookbook_point',
  name: 'Point',
  geometryType: 'point',
  crs: 'EPSG:4326',
  featureCount: 3,
  geojson: { type: 'FeatureCollection', features: [] },
  extent: [0, 0, 10, 10] as [number, number, number, number],
};

describe('MapPreview', () => {
  let wrapper: VueWrapper<InstanceType<typeof MapPreview>>;

  beforeEach(() => {
    __setCurrentStyle(undefined);
    __setActiveDataset(undefined);
    __setParams(undefined);
    vi.clearAllMocks();
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  it('initializes map on mount with fallback sample features when no dataset is active', async () => {
    const { Map, View, Feature } = await import('ol');
    const VectorSource = (await import('ol/source/Vector')).default;
    const VectorLayer = (await import('ol/layer/Vector')).default;

    wrapper = mount(MapPreview);
    await nextTick();
    await nextTick();

    expect(Map).toHaveBeenCalledTimes(1);
    expect(View).toHaveBeenCalledTimes(1);
    expect(VectorSource).toHaveBeenCalledTimes(1);
    expect(VectorLayer).toHaveBeenCalledTimes(1);
    expect(Feature).toHaveBeenCalledTimes(3);
    expect(mockLoadSampleDatasets).toHaveBeenCalledTimes(1);
  });

  it('applies style on mount when currentStyle is already set', async () => {
    __setCurrentStyle(simpleStyle);

    wrapper = mount(MapPreview);
    await nextTick();
    await nextTick();

    expect(mockApplyStyle).toHaveBeenCalledTimes(1);
    expect(mockApplyStyle).toHaveBeenCalledWith(mockVectorLayerInstance, simpleStyle);
  });

  it('applies style when currentStyle changes', async () => {
    wrapper = mount(MapPreview);
    await nextTick();
    await nextTick();

    expect(mockApplyStyle).not.toHaveBeenCalled();

    __setCurrentStyle(simpleStyle);
    await nextTick();
    await nextTick();

    expect(mockApplyStyle).toHaveBeenCalledTimes(1);
    expect(mockApplyStyle).toHaveBeenCalledWith(mockVectorLayerInstance, simpleStyle);
  });

  it('does not apply style when currentStyle becomes undefined', async () => {
    __setCurrentStyle(simpleStyle);

    wrapper = mount(MapPreview);
    await nextTick();
    await nextTick();
    expect(mockApplyStyle).toHaveBeenCalledTimes(1);

    __setCurrentStyle(undefined);
    await nextTick();
    await nextTick();

    expect(mockApplyStyle).toHaveBeenCalledTimes(1);
  });

  it('loads dataset features when activeDataset changes', async () => {
    wrapper = mount(MapPreview);
    await nextTick();
    await nextTick();

    __setActiveDataset(sampleDataset);
    await nextTick();
    await nextTick();

    expect(mockClear).toHaveBeenCalled();
    expect(mockCreateFeaturesFromGeoJSON).toHaveBeenCalledWith(sampleDataset.geojson);
    expect(mockAddFeatures).toHaveBeenCalledWith(mockCreateFeaturesFromGeoJSON.mock.results[0].value);
    expect(mockFitViewToExtent).toHaveBeenCalledWith(mockMapInstance, sampleDataset.extent);
  });

  it('selects dataset for geometry_type when params change', async () => {
    wrapper = mount(MapPreview);
    await nextTick();
    await nextTick();

    __setParams({ geometry_type: 'line' });
    await nextTick();

    expect(mockSelectDatasetForGeometry).toHaveBeenCalledWith('line');
  });
});

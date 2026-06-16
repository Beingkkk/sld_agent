import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import MapPreview from './MapPreview.vue';
import type { Style } from 'geostyler-style';
import type { VueWrapper } from '@vue/test-utils';

const mockApplyStyle = vi.fn();
const mockSetTarget = vi.fn();
const mockMapInstance = { setTarget: mockSetTarget };
const mockVectorLayerInstance = {};

vi.mock('../composables/useMapPreview', () => ({
  useMapPreview: () => ({
    applyStyle: mockApplyStyle,
  }),
}));

vi.mock('../stores/styleStore', async () => {
  const { ref } = await import('vue');
  const currentStyleRef = ref<Style | undefined>(undefined);
  return {
    useStyleStore: () => ({
      get currentStyle() {
        return currentStyleRef.value;
      },
    }),
    __setCurrentStyle: (style: Style | undefined) => {
      currentStyleRef.value = style;
    },
  };
});

// @ts-ignore - provided by mocked module
import { __setCurrentStyle } from '../stores/styleStore';

vi.mock('ol', () => ({
  Map: vi.fn(() => mockMapInstance),
  View: vi.fn(),
  Feature: vi.fn((geometry) => ({ geometry, type: 'feature' })),
}));

vi.mock('ol/layer/Tile', () => ({
  default: vi.fn(() => ({ type: 'tile-layer' })),
}));

vi.mock('ol/source/OSM', () => ({
  default: vi.fn(() => ({ type: 'osm' })),
}));

vi.mock('ol/layer/Vector', () => ({
  default: vi.fn(() => mockVectorLayerInstance),
}));

vi.mock('ol/source/Vector', () => ({
  default: vi.fn(() => ({
    type: 'vector-source',
    features: [],
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

describe('MapPreview', () => {
  let wrapper: VueWrapper<InstanceType<typeof MapPreview>>;

  beforeEach(() => {
    __setCurrentStyle(undefined);
    vi.clearAllMocks();
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  it('initializes map on mount with sample features', async () => {
    const { Map, View, Feature } = await import('ol');
    const VectorSource = (await import('ol/source/Vector')).default;
    const VectorLayer = (await import('ol/layer/Vector')).default;

    wrapper = mount(MapPreview);
    await nextTick();

    expect(Map).toHaveBeenCalledTimes(1);
    expect(View).toHaveBeenCalledTimes(1);
    expect(VectorSource).toHaveBeenCalledTimes(1);
    expect(VectorLayer).toHaveBeenCalledTimes(1);
    expect(Feature).toHaveBeenCalledTimes(3);
  });

  it('applies style on mount when currentStyle is already set', async () => {
    __setCurrentStyle(simpleStyle);

    wrapper = mount(MapPreview);
    await nextTick();

    expect(mockApplyStyle).toHaveBeenCalledTimes(1);
    expect(mockApplyStyle).toHaveBeenCalledWith(mockVectorLayerInstance, simpleStyle);
  });

  it('applies style when currentStyle changes', async () => {
    wrapper = mount(MapPreview);
    await nextTick();

    expect(mockApplyStyle).not.toHaveBeenCalled();

    __setCurrentStyle(simpleStyle);
    await nextTick();

    expect(mockApplyStyle).toHaveBeenCalledTimes(1);
    expect(mockApplyStyle).toHaveBeenCalledWith(mockVectorLayerInstance, simpleStyle);
  });

  it('does not apply style when currentStyle becomes undefined', async () => {
    __setCurrentStyle(simpleStyle);

    wrapper = mount(MapPreview);
    await nextTick();
    expect(mockApplyStyle).toHaveBeenCalledTimes(1);

    __setCurrentStyle(undefined);
    await nextTick();

    expect(mockApplyStyle).toHaveBeenCalledTimes(1);
  });
});

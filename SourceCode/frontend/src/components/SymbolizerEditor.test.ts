import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SymbolizerEditor from './SymbolizerEditor.vue';
import type { StyleParams } from '@shared/types';

const mockApplyPatch = vi.fn().mockResolvedValue(undefined as never);

vi.mock('../stores/styleStore', async () => {
  const { ref } = await import('vue');
  const paramsRef = ref<StyleParams | undefined>(undefined);
  return {
    useStyleStore: () => ({
      get params() {
        return paramsRef.value;
      },
      applyPatch: mockApplyPatch,
    }),
    __setParams: (params: StyleParams | undefined) => {
      paramsRef.value = params;
    },
  };
});

// @ts-ignore - provided by mocked module
import { __setParams } from '../stores/styleStore';

function createParams(geometryType: StyleParams['geometry_type'], overrides: Partial<StyleParams> = {}): StyleParams {
  const base: Record<string, Partial<StyleParams>> = {
    point: {
      well_known_name: 'circle',
      size: 8,
      fill_color: '#FF0000',
      stroke_color: '#000000',
      stroke_width: 1,
    },
    line: {
      stroke_color: '#0000FF',
      stroke_width: 2,
      stroke_opacity: 1,
      stroke_dasharray: '4 4',
    },
    polygon: {
      fill_color: '#00FF00',
      fill_opacity: 0.5,
      stroke_color: '#000000',
      stroke_width: 1,
    },
    raster: {},
  };

  return {
    style_name: 'Test',
    geometry_type: geometryType,
    style_type: geometryType === 'raster' ? 'raster' : 'simple',
    ...base[geometryType],
    ...overrides,
  } as StyleParams;
}

describe('SymbolizerEditor', () => {
  beforeEach(() => {
    __setParams(undefined);
    mockApplyPatch.mockClear();
  });

  it('shows empty state when params is undefined', () => {
    const wrapper = mount(SymbolizerEditor);
    expect(wrapper.find('.empty').exists()).toBe(true);
    expect(wrapper.text()).toContain('当前没有可编辑的符号化参数');
  });

  it('renders point fields from params', async () => {
    __setParams(createParams('point'));
    const wrapper = mount(SymbolizerEditor);
    await nextTick();

    expect(wrapper.find('.empty').exists()).toBe(false);
    expect(wrapper.text()).toContain('形状');
    expect(wrapper.text()).toContain('大小');
    expect(wrapper.text()).toContain('填充色');
    expect(wrapper.text()).toContain('描边色');
    expect(wrapper.text()).toContain('描边宽');
  });

  it('renders line fields from params', async () => {
    __setParams(createParams('line'));
    const wrapper = mount(SymbolizerEditor);
    await nextTick();

    expect(wrapper.text()).toContain('颜色');
    expect(wrapper.text()).toContain('宽度');
    expect(wrapper.text()).toContain('透明度');
    expect(wrapper.text()).toContain('虚线');
  });

  it('renders polygon fields from params', async () => {
    __setParams(createParams('polygon'));
    const wrapper = mount(SymbolizerEditor);
    await nextTick();

    expect(wrapper.text()).toContain('填充色');
    expect(wrapper.text()).toContain('透明度');
    expect(wrapper.text()).toContain('描边色');
    expect(wrapper.text()).toContain('描边宽');
  });

  it('calls applyPatch with StyleParams path when text field changes', async () => {
    __setParams(createParams('point'));
    const wrapper = mount(SymbolizerEditor);
    await nextTick();

    const colorInput = wrapper.findAll('input')[1];
    await colorInput.setValue('#00FF00');

    expect(mockApplyPatch).toHaveBeenCalledTimes(1);
    const patches = mockApplyPatch.mock.calls[0][0];
    expect(patches).toHaveLength(1);
    expect(patches[0].op).toBe('replace');
    expect(patches[0].path).toBe('/fill_color');
    expect(patches[0].value).toBe('#00FF00');
  });

  it('calls applyPatch with StyleParams path when select field changes', async () => {
    __setParams(createParams('point'));
    const wrapper = mount(SymbolizerEditor);
    await nextTick();

    const select = wrapper.find('select');
    await select.setValue('square');

    expect(mockApplyPatch).toHaveBeenCalledTimes(1);
    const patches = mockApplyPatch.mock.calls[0][0];
    expect(patches[0].path).toBe('/well_known_name');
    expect(patches[0].value).toBe('square');
  });

  it('calls applyPatch with StyleParams path when number field changes', async () => {
    __setParams(createParams('point'));
    const wrapper = mount(SymbolizerEditor);
    await nextTick();

    const sizeInput = wrapper.find('input[type="number"]');
    await sizeInput.setValue(12);

    expect(mockApplyPatch).toHaveBeenCalledTimes(1);
    const patches = mockApplyPatch.mock.calls[0][0];
    expect(patches[0].path).toBe('/size');
    expect(patches[0].value).toBe(12);
  });
});

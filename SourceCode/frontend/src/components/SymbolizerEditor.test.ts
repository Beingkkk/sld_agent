import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SymbolizerEditor from './SymbolizerEditor.vue';
import type { Style } from 'geostyler-style';

const mockApplyPatch = vi.fn().mockResolvedValue(undefined as never);

vi.mock('../stores/styleStore', async () => {
  const { ref } = await import('vue');
  const currentStyleRef = ref<Style | undefined>(undefined);
  return {
    useStyleStore: () => ({
      get currentStyle() {
        return currentStyleRef.value;
      },
      applyPatch: mockApplyPatch,
    }),
    __setCurrentStyle: (style: Style | undefined) => {
      currentStyleRef.value = style;
    },
  };
});

// @ts-ignore - provided by mocked module
import { __setCurrentStyle } from '../stores/styleStore';

function createStyle(kind: 'Mark' | 'Line' | 'Fill' | 'Text', overrides: Record<string, unknown> = {}): Style {
  const base: Record<string, Record<string, unknown>> = {
    Mark: {
      kind: 'Mark',
      wellKnownName: 'circle',
      size: 8,
      color: '#FF0000',
      strokeColor: '#000000',
      strokeWidth: 1,
    },
    Line: {
      kind: 'Line',
      color: '#0000FF',
      width: 2,
      opacity: 1,
      dasharray: [4, 4],
    },
    Fill: {
      kind: 'Fill',
      color: '#00FF00',
      opacity: 0.5,
      outlineColor: '#000000',
      outlineWidth: 1,
    },
    Text: {
      kind: 'Text',
      label: 'name',
      size: 12,
      color: '#000000',
    },
  };

  return {
    name: 'Test',
    rules: [{
      name: 'Default',
      symbolizers: [{ ...base[kind], ...overrides }],
    }],
  } as unknown as Style;
}

describe('SymbolizerEditor', () => {
  beforeEach(() => {
    __setCurrentStyle(undefined);
    mockApplyPatch.mockClear();
  });

  it('shows empty state when currentStyle is undefined', () => {
    const wrapper = mount(SymbolizerEditor);
    expect(wrapper.find('.empty').exists()).toBe(true);
    expect(wrapper.text()).toContain('当前没有可编辑的符号化参数');
  });

  it('renders Mark symbolizer fields', async () => {
    __setCurrentStyle(createStyle('Mark'));
    const wrapper = mount(SymbolizerEditor);
    await nextTick();

    expect(wrapper.find('.empty').exists()).toBe(false);
    expect(wrapper.text()).toContain('形状');
    expect(wrapper.text()).toContain('大小');
    expect(wrapper.text()).toContain('填充色');
    expect(wrapper.text()).toContain('描边色');
    expect(wrapper.text()).toContain('描边宽');
  });

  it('renders Line symbolizer fields', async () => {
    __setCurrentStyle(createStyle('Line'));
    const wrapper = mount(SymbolizerEditor);
    await nextTick();

    expect(wrapper.text()).toContain('颜色');
    expect(wrapper.text()).toContain('宽度');
    expect(wrapper.text()).toContain('透明度');
    expect(wrapper.text()).toContain('虚线');
  });

  it('renders Fill symbolizer fields', async () => {
    __setCurrentStyle(createStyle('Fill'));
    const wrapper = mount(SymbolizerEditor);
    await nextTick();

    expect(wrapper.text()).toContain('填充色');
    expect(wrapper.text()).toContain('透明度');
    expect(wrapper.text()).toContain('描边色');
    expect(wrapper.text()).toContain('描边宽');
  });

  it('renders Text symbolizer fields', async () => {
    __setCurrentStyle(createStyle('Text'));
    const wrapper = mount(SymbolizerEditor);
    await nextTick();

    expect(wrapper.text()).toContain('标注字段');
    expect(wrapper.text()).toContain('字号');
    expect(wrapper.text()).toContain('颜色');
  });

  it('calls applyPatch when text field changes', async () => {
    __setCurrentStyle(createStyle('Mark'));
    const wrapper = mount(SymbolizerEditor);
    await nextTick();

    const colorInput = wrapper.findAll('input')[1];
    await colorInput.setValue('#00FF00');

    expect(mockApplyPatch).toHaveBeenCalledTimes(1);
    const patches = mockApplyPatch.mock.calls[0][0];
    expect(patches).toHaveLength(1);
    expect(patches[0].path).toBe('/rules/0/symbolizers/0');
    expect(patches[0].value).toMatchObject({ color: '#00FF00' });
  });

  it('calls applyPatch when select field changes', async () => {
    __setCurrentStyle(createStyle('Mark'));
    const wrapper = mount(SymbolizerEditor);
    await nextTick();

    const select = wrapper.find('select');
    await select.setValue('square');

    expect(mockApplyPatch).toHaveBeenCalledTimes(1);
    const patches = mockApplyPatch.mock.calls[0][0];
    expect(patches[0].value).toMatchObject({ wellKnownName: 'square' });
  });

  it('calls applyPatch when number field changes', async () => {
    __setCurrentStyle(createStyle('Mark'));
    const wrapper = mount(SymbolizerEditor);
    await nextTick();

    const sizeInput = wrapper.find('input[type="number"]');
    await sizeInput.setValue(12);

    expect(mockApplyPatch).toHaveBeenCalledTimes(1);
    const patches = mockApplyPatch.mock.calls[0][0];
    expect(patches[0].value).toMatchObject({ size: 12 });
  });
});

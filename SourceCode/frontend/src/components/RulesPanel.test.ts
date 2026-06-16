import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import RulesPanel from './RulesPanel.vue';
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

function createParams(rules: NonNullable<StyleParams['rules']>): StyleParams {
  return {
    style_name: 'Test',
    geometry_type: 'point',
    style_type: 'simple',
    rules,
  };
}

describe('RulesPanel', () => {
  beforeEach(() => {
    __setParams(undefined);
    mockApplyPatch.mockClear();
  });

  it('shows empty state when there are no rules', async () => {
    __setParams(createParams([]));
    const wrapper = mount(RulesPanel);
    await nextTick();

    expect(wrapper.find('.empty').exists()).toBe(true);
    expect(wrapper.text()).toContain('暂无规则');
  });

  it('renders rules from params', async () => {
    __setParams(createParams([{ name: 'Default' }, { name: 'Secondary' }]));
    const wrapper = mount(RulesPanel);
    await nextTick();

    expect(wrapper.text()).toContain('1. Default');
    expect(wrapper.text()).toContain('2. Secondary');
  });

  it('emits add patch with RuleParams shape', async () => {
    __setParams(createParams([{ name: 'Default' }]));
    const wrapper = mount(RulesPanel);
    await nextTick();

    await wrapper.find('.add-btn').trigger('click');

    expect(mockApplyPatch).toHaveBeenCalledTimes(1);
    const patches = mockApplyPatch.mock.calls[0][0];
    expect(patches).toHaveLength(1);
    expect(patches[0].op).toBe('add');
    expect(patches[0].path).toBe('/rules/-');
    expect(patches[0].value).toEqual({ name: 'New rule 2', symbolizers: [] });
  });

  it('emits remove patch with correct index', async () => {
    __setParams(createParams([{ name: 'A' }, { name: 'B' }]));
    const wrapper = mount(RulesPanel);
    await nextTick();

    await wrapper.findAll('button[title="删除"]')[0].trigger('click');

    expect(mockApplyPatch).toHaveBeenCalledTimes(1);
    const patches = mockApplyPatch.mock.calls[0][0];
    expect(patches[0].op).toBe('remove');
    expect(patches[0].path).toBe('/rules/0');
  });
});

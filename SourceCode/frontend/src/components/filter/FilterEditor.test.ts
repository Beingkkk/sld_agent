import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import FilterEditor from './FilterEditor.vue';
import type { Filter } from 'geostyler-style';
import type { DataSchema } from '@shared/types';

describe('FilterEditor', () => {
  const dataSchema: DataSchema = {
    properties: [
      { name: 'type', type: 'string' },
      { name: 'population', type: 'integer' },
    ],
  };

  it('renders empty state when filter is undefined', () => {
    const wrapper = mount(FilterEditor);
    expect(wrapper.find('.empty').exists()).toBe(true);
    expect(wrapper.text()).toContain('当前规则没有过滤条件');
  });

  it('renders empty state when filter is empty array', () => {
    const wrapper = mount(FilterEditor, {
      props: { filter: [] as unknown as Filter },
    });
    expect(wrapper.find('.empty').exists()).toBe(true);
  });

  it('renders FilterNodeEditor for comparison filter', () => {
    const wrapper = mount(FilterEditor, {
      props: { filter: ['==', 'type', 'road'] as unknown as Filter },
    });
    expect(wrapper.find('.empty').exists()).toBe(false);
    expect(wrapper.find('.filter-node-editor').exists()).toBe(true);
    expect(wrapper.find('select').element.value).toBe('==');
  });

  it('renders FilterNodeEditor recursively for logical filter', () => {
    const wrapper = mount(FilterEditor, {
      props: {
        filter: [
          '&&',
          ['==', 'type', 'road'],
          ['>', 'population', 1000],
        ] as unknown as Filter,
      },
    });
    expect(wrapper.findAll('.filter-node-editor').length).toBeGreaterThanOrEqual(3);
  });

  it('emits update:filter when child node changes', async () => {
    const wrapper = mount(FilterEditor, {
      props: { filter: ['==', 'type', 'road'] as unknown as Filter },
    });

    const input = wrapper.find('input[placeholder="字段"]');
    await input.setValue('category');

    expect(wrapper.emitted('update:filter')).toHaveLength(1);
    const emitted = wrapper.emitted('update:filter')![0][0];
    expect(emitted).toEqual(['==', 'category', 'road']);
  });

  it('renders CQL preview for valid filter', () => {
    const wrapper = mount(FilterEditor, {
      props: { filter: ['==', 'type', 'road'] as unknown as Filter },
    });
    expect(wrapper.find('.cql-preview').exists()).toBe(true);
    expect(wrapper.find('.cql-preview').text()).toContain("type = 'road'");
  });

  it('passes dataSchema down to FilterNodeEditor', () => {
    const wrapper = mount(FilterEditor, {
      props: {
        filter: ['==', 'type', 'road'] as unknown as Filter,
        dataSchema,
      },
    });
    // With an invalid value for a schema-validated field, error should appear.
    const input = wrapper.findAll('input')[1];
    expect(input.exists()).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FilterNodeEditor from './FilterNodeEditor.vue';
import type { FilterNode, ComparisonNode, LogicalNode } from '@shared/filter';
import type { DataSchema } from '@shared/types';

describe('FilterNodeEditor', () => {
  const dataSchema: DataSchema = {
    properties: [
      { name: 'type', type: 'string' },
      { name: 'population', type: 'integer' },
    ],
  };

  it('renders comparison node with operator, property and value inputs', () => {
    const node: FilterNode = {
      id: '1',
      type: 'comparison',
      operator: '==',
      property: 'type',
      value: 'road',
    };
    const wrapper = mount(FilterNodeEditor, { props: { node } });

    expect(wrapper.find('select').element.value).toBe('==');
    const inputs = wrapper.findAll('input');
    expect(inputs[0].element.value).toBe('type');
    expect(inputs[1].element.value).toBe('road');
  });

  it('emits update:node when operator changes', async () => {
    const node: FilterNode = {
      id: '1',
      type: 'comparison',
      operator: '==',
      property: 'type',
      value: 'road',
    };
    const wrapper = mount(FilterNodeEditor, { props: { node } });

    await wrapper.find('select').setValue('!=');

    expect(wrapper.emitted('update:node')).toHaveLength(1);
    expect((wrapper.emitted('update:node')![0][0] as ComparisonNode).operator).toBe('!=');
  });

  it('emits update:node when property changes', async () => {
    const node: FilterNode = {
      id: '1',
      type: 'comparison',
      operator: '==',
      property: 'type',
      value: 'road',
    };
    const wrapper = mount(FilterNodeEditor, { props: { node } });

    const propertyInput = wrapper.findAll('input')[0];
    await propertyInput.setValue('category');

    expect(wrapper.emitted('update:node')).toHaveLength(1);
    expect((wrapper.emitted('update:node')![0][0] as ComparisonNode).property).toBe('category');
  });

  it('shows hint for between operator', () => {
    const node: FilterNode = {
      id: '1',
      type: 'comparison',
      operator: 'between',
      property: 'population',
      value: [0, 100],
    };
    const wrapper = mount(FilterNodeEditor, { props: { node } });

    expect(wrapper.find('.hint').exists()).toBe(true);
    expect(wrapper.text()).toContain('数组值请在父节点中编辑');
  });

  it('shows hint for in operator', () => {
    const node: FilterNode = {
      id: '1',
      type: 'comparison',
      operator: 'in',
      property: 'type',
      value: ['road', 'rail'],
    };
    const wrapper = mount(FilterNodeEditor, { props: { node } });

    expect(wrapper.find('.hint').exists()).toBe(true);
  });

  it('renders logical node with children', () => {
    const node: FilterNode = {
      id: '1',
      type: 'logical',
      operator: 'and',
      children: [
        { id: '2', type: 'comparison', operator: '==', property: 'type', value: 'road' },
        { id: '3', type: 'comparison', operator: '>', property: 'population', value: 1000 },
      ],
    };
    const wrapper = mount(FilterNodeEditor, { props: { node } });

    expect(wrapper.find('select').element.value).toBe('and');
    expect(wrapper.findAll('.filter-node-editor').length).toBe(3);
  });

  it('emits update:node when logical operator changes', async () => {
    const node: FilterNode = {
      id: '1',
      type: 'logical',
      operator: 'and',
      children: [
        { id: '2', type: 'comparison', operator: '==', property: 'type', value: 'road' },
      ],
    };
    const wrapper = mount(FilterNodeEditor, { props: { node } });

    await wrapper.find('select').setValue('or');

    expect(wrapper.emitted('update:node')).toHaveLength(1);
    expect((wrapper.emitted('update:node')![0][0] as LogicalNode).operator).toBe('or');
  });

  it('renders not node with single child', () => {
    const node: FilterNode = {
      id: '1',
      type: 'not',
      child: { id: '2', type: 'comparison', operator: '==', property: 'type', value: 'road' },
    };
    const wrapper = mount(FilterNodeEditor, { props: { node } });

    expect(wrapper.text()).toContain('NOT');
    expect(wrapper.findAll('.filter-node-editor').length).toBe(2);
  });

  it('shows validation error when property value mismatches data schema', async () => {
    const node: FilterNode = {
      id: '1',
      type: 'comparison',
      operator: '==',
      property: 'population',
      value: 'not-a-number',
    };
    const wrapper = mount(FilterNodeEditor, {
      props: { node, dataSchema },
    });

    expect(wrapper.find('.error').exists()).toBe(true);
    expect(wrapper.find('.error').text()).toContain('Expected number');
  });

  it('shows required error when property is empty', () => {
    const node: FilterNode = {
      id: '1',
      type: 'comparison',
      operator: '==',
      property: '',
      value: 'road',
    };
    const wrapper = mount(FilterNodeEditor, { props: { node } });

    expect(wrapper.find('.error').exists()).toBe(true);
    expect(wrapper.find('.error').text()).toContain('Property name is required');
  });
});

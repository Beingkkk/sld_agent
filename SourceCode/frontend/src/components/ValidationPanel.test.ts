import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ValidationPanel from './ValidationPanel.vue';
import type { ValidationReport } from '@shared/types';

vi.mock('../stores/styleStore', async () => {
  const { ref } = await import('vue');
  const validationRef = ref<ValidationReport | undefined>(undefined);
  return {
    useStyleStore: () => ({
      get validation() {
        return validationRef.value;
      },
    }),
    __setValidation: (report: ValidationReport | undefined) => {
      validationRef.value = report;
    },
  };
});

// @ts-ignore - provided by mocked module
import { __setValidation } from '../stores/styleStore';

describe('ValidationPanel', () => {
  beforeEach(() => {
    __setValidation(undefined);
  });

  it('shows empty state when validation is undefined', () => {
    const wrapper = mount(ValidationPanel);
    expect(wrapper.find('.params-empty').exists()).toBe(true);
    expect(wrapper.text()).toContain('暂无校验结果');
  });

  it('shows pass state when validation passed', async () => {
    __setValidation({
      passed: true,
      schema: { passed: true, tool: 'ajv' },
      xsd: { passed: true, tool: 'xmllint-wasm' },
      roundtrip: { passed: true, tool: 'geostyler-sld-parser' },
      errors: [],
    } as ValidationReport);

    const wrapper = mount(ValidationPanel);
    await nextTick();

    const items = wrapper.findAll('.check-item');
    expect(items.length).toBe(3);
    expect(items.every((item) => item.classes().includes('pass'))).toBe(true);
    expect(wrapper.text()).toContain('JSON Schema');
    expect(wrapper.text()).toContain('XSD');
    expect(wrapper.text()).toContain('Roundtrip');
  });

  it('shows failure state and error list when validation failed', async () => {
    __setValidation({
      passed: false,
      xsd: { passed: false, tool: 'xmllint-wasm', message: 'Invalid SLD' },
      roundtrip: { passed: true, tool: 'geostyler-sld-parser' },
      errors: [
        { source: 'xsd', message: 'Invalid SLD' },
        { source: 'roundtrip', message: 'Mismatch', location: 'rules/0' },
      ],
    } as ValidationReport);

    const wrapper = mount(ValidationPanel);
    await nextTick();

    expect(wrapper.find('.check-item.fail').exists()).toBe(true);
    expect(wrapper.text()).toContain('校验未通过');
    expect(wrapper.text()).toContain('[xsd] Invalid SLD');
    expect(wrapper.text()).toContain('[roundtrip]');
    expect(wrapper.text()).toContain('Mismatch');
    expect(wrapper.text()).toContain('(rules/0)');
  });

  it('renders only available sub-results', async () => {
    __setValidation({
      passed: true,
      xsd: { passed: true, tool: 'xmllint-wasm' },
      errors: [],
    } as ValidationReport);

    const wrapper = mount(ValidationPanel);
    await nextTick();

    expect(wrapper.text()).toContain('XSD');
    expect(wrapper.text()).not.toContain('JSON Schema');
    expect(wrapper.text()).not.toContain('Roundtrip');
  });
});

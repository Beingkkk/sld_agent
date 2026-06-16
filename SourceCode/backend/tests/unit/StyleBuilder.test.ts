import { describe, it, expect } from 'vitest';
import {
  StyleBuilderFactory,
  DefaultValueResolver,
  SimpleStyleBuilder,
  CategorizedStyleBuilder,
  ClassifiedStyleBuilder,
  TextStyleBuilder,
  RuleGenerator,
} from '../../src/style/builder/StyleBuilder';
import type { DataSchema, StyleParams } from '@sldagent/shared/types';

const resolver = new DefaultValueResolver();

describe('StyleBuilderFactory', () => {
  it('creates SimpleStyleBuilder for simple style', () => {
    const params: StyleParams = {
      style_name: 'point',
      geometry_type: 'point',
      style_type: 'simple',
    };
    const builder = StyleBuilderFactory.create(params, { resolver });
    expect(builder).toBeInstanceOf(SimpleStyleBuilder);
  });

  it('creates CategorizedStyleBuilder for categorized style', () => {
    const params: StyleParams = {
      style_name: 'roads',
      geometry_type: 'line',
      style_type: 'categorized',
      field_name: 'type',
      categories: [
        { value: 'highway', label: 'Highway', stroke_color: '#FF0000', stroke_width: 4 },
        { value: 'street', label: 'Street', stroke_color: '#000000', stroke_width: 1 },
      ],
    };
    const builder = StyleBuilderFactory.create(params, { resolver });
    expect(builder).toBeInstanceOf(CategorizedStyleBuilder);
  });
});

describe('SimpleStyleBuilder', () => {
  it('builds point style with defaults', () => {
    const params: StyleParams = {
      style_name: 'red point',
      geometry_type: 'point',
      style_type: 'simple',
      fill_color: '#FF0000',
      size: 8,
    };
    const style = new SimpleStyleBuilder(params, { resolver }).build();
    expect(style.name).toBe('red point');
    expect(style.rules.length).toBe(1);
    const symbolizer = style.rules[0].symbolizers[0];
    expect(symbolizer.kind).toBe('Mark');
  });
});

describe('CategorizedStyleBuilder', () => {
  it('builds rules for each category plus default rule with explicit filter', () => {
    const params: StyleParams = {
      style_name: 'roads',
      geometry_type: 'line',
      style_type: 'categorized',
      field_name: 'type',
      categories: [
        { value: 'highway', stroke_color: '#FF0000' },
        { value: 'street', stroke_color: '#000000' },
      ],
    };
    const style = new CategorizedStyleBuilder(params, { resolver }).build();
    expect(style.rules.length).toBe(3);
    const defaultRule = style.rules[2];
    expect(defaultRule.name).toBe('Default');
    expect(defaultRule.filter).toEqual(['&&', ['!=', 'type', 'highway'], ['!=', 'type', 'street']]);
  });
});

describe('ClassifiedStyleBuilder', () => {
  it('builds class rules', () => {
    const params: StyleParams = {
      style_name: 'pop',
      geometry_type: 'polygon',
      style_type: 'classified',
      field_name: 'population',
      classes: 3,
      color_ramp: ['#FF0000', '#00FF00', '#0000FF'],
    };
    const style = new ClassifiedStyleBuilder(params, { resolver }).build();
    expect(style.rules.length).toBe(3);
  });
});

describe('TextStyleBuilder', () => {
  it('builds text symbolizer', () => {
    const params: StyleParams = {
      style_name: 'labels',
      geometry_type: 'point',
      style_type: 'text',
      label: 'name',
      font_size: 14,
      stroke_color: '#000000',
    };
    const style = new TextStyleBuilder(params, { resolver }).build();
    expect(style.rules[0].symbolizers[0].kind).toBe('Text');
  });
});

describe('RuleGenerator', () => {
  const gen = new RuleGenerator();

  function makeSchema(samples: unknown[], min?: number, max?: number, field = 'pop'): DataSchema {
    return {
      properties: [{ name: field, type: 'number', samples, min, max }],
    };
  }

  describe('quantile', () => {
    it('computes breaks from numeric samples', () => {
      const breaks = gen.computeBreaks('pop', 'quantile', 2, makeSchema([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 1, 10));
      expect(breaks).toEqual([1, 6, 10]);
    });

    it('falls back to equalInterval when samples are missing', () => {
      const breaks = gen.computeBreaks('pop', 'quantile', 4, {
        properties: [{ name: 'pop', type: 'number', min: 0, max: 100 }],
      });
      expect(breaks).toEqual([0, 25, 50, 75, 100]);
    });

    it('falls back to equalInterval when samples are non-numeric', () => {
      const breaks = gen.computeBreaks('name', 'quantile', 3, makeSchema(['A', 'B', 'C'], 0, 100, 'name'));
      expect(breaks).toEqual([0, 33.333333333333336, 66.66666666666667, 100]);
    });

    it('falls back to equalInterval when samples are fewer than classes', () => {
      const breaks = gen.computeBreaks('pop', 'quantile', 4, makeSchema([1, 2], 1, 2));
      expect(breaks).toEqual([1, 1.25, 1.5, 1.75, 2]);
    });

    it('handles all-identical samples by falling back', () => {
      const breaks = gen.computeBreaks('pop', 'quantile', 3, makeSchema([5, 5, 5, 5, 5], 5, 5));
      expect(breaks).toEqual([5, 5, 5, 5]);
    });

    it('ignores mixed non-numeric values in samples', () => {
      const breaks = gen.computeBreaks('pop', 'quantile', 2, makeSchema([1, 'bad', null, 2, 3, 4, undefined, 5], 1, 5));
      expect(breaks).toEqual([1, 3, 5]);
    });
  });

  describe('naturalBreaks', () => {
    it('computes breaks from bimodal numeric samples', () => {
      const breaks = gen.computeBreaks('pop', 'naturalBreaks', 2, makeSchema([1, 2, 3, 100, 101, 102], 1, 102));
      expect(breaks).toHaveLength(3);
      expect(breaks[0]).toBe(1);
      expect(breaks[2]).toBe(102);
      expect(breaks[1]).toBe(100);
    });

    it('falls back to equalInterval when samples are missing', () => {
      const breaks = gen.computeBreaks('pop', 'naturalBreaks', 4, {
        properties: [{ name: 'pop', type: 'number', min: 0, max: 100 }],
      });
      expect(breaks).toEqual([0, 25, 50, 75, 100]);
    });

    it('falls back when sample count equals class count', () => {
      const breaks = gen.computeBreaks('pop', 'naturalBreaks', 3, makeSchema([1, 2, 3], 1, 3));
      expect(breaks).toHaveLength(4);
      expect(breaks[0]).toBe(1);
      expect(breaks[3]).toBe(3);
      expect(breaks[1]).toBeCloseTo(5 / 3, 14);
      expect(breaks[2]).toBeCloseTo(7 / 3, 14);
    });
  });

  it('falls back to equalInterval when field is not in schema', () => {
    const breaks = gen.computeBreaks('pop', 'quantile', 4, {
      properties: [{ name: 'other', type: 'number', min: 0, max: 100 }],
    });
    expect(breaks).toEqual([0, 100, 200, 300, 400]);
  });
});

describe('ClassifiedStyleBuilder with sample-driven dataSchema', () => {
  it('uses quantile breaks from samples', () => {
    const params: StyleParams = {
      style_name: 'pop',
      geometry_type: 'polygon',
      style_type: 'classified',
      field_name: 'population',
      classes: 2,
      classification_method: 'quantile',
      color_ramp: ['#FF0000', '#00FF00'],
    };
    const dataSchema: DataSchema = {
      properties: [{
        name: 'population',
        type: 'number',
        samples: [10, 20, 30, 40, 50, 60, 70, 80],
        min: 10,
        max: 80,
      }],
    };
    const style = new ClassifiedStyleBuilder(params, {
      resolver,
      ruleGenerator: new RuleGenerator(),
      dataSchema,
    }).build();
    expect(style.rules.length).toBe(2);
    expect(style.rules[0].filter).toEqual(['&&', ['>=', 'population', 10], ['<', 'population', 50]]);
    expect(style.rules[1].filter).toEqual(['&&', ['>=', 'population', 50], ['<', 'population', 80]]);
  });
});

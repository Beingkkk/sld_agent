import { describe, it, expect } from 'vitest';
import {
  StyleBuilderFactory,
  DefaultValueResolver,
  SimpleStyleBuilder,
  CategorizedStyleBuilder,
  ClassifiedStyleBuilder,
  TextStyleBuilder,
} from '../../src/style/builder/StyleBuilder';
import type { StyleParams } from '../../src/shared/types';

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

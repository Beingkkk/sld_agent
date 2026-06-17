import { describe, it, expect } from 'vitest';
import { FilterTransformer, createFilterNode } from '../filter-transformer.js';
import type { FilterNode } from '../types.js';

describe('FilterTransformer', () => {
  describe('toGeoStyler', () => {
    it('converts comparison node to GeoStyler filter', () => {
      const node = createFilterNode('comparison', {
        operator: '==',
        propertyName: 'name',
        value: 'school',
      });
      expect(FilterTransformer.toGeoStyler(node)).toEqual(['==', 'name', 'school']);
    });

    it('converts LIKE comparison', () => {
      const node = createFilterNode('comparison', {
        operator: '*=',
        propertyName: 'name',
        value: '%学校%',
      });
      expect(FilterTransformer.toGeoStyler(node)).toEqual(['*=', 'name', '%学校%']);
    });

    it('converts numeric comparison', () => {
      const node = createFilterNode('comparison', {
        operator: '>',
        propertyName: 'population',
        value: 1000,
      });
      expect(FilterTransformer.toGeoStyler(node)).toEqual(['>', 'population', 1000]);
    });

    it('converts AND node', () => {
      const node = createFilterNode('and', {
        children: [
          createFilterNode('comparison', { operator: '==', propertyName: 'a', value: 1 }),
          createFilterNode('comparison', { operator: '>', propertyName: 'b', value: 2 }),
        ],
      });
      expect(FilterTransformer.toGeoStyler(node)).toEqual([
        '&&',
        ['==', 'a', 1],
        ['>', 'b', 2],
      ]);
    });

    it('converts OR node', () => {
      const node = createFilterNode('or', {
        children: [
          createFilterNode('comparison', { operator: '==', propertyName: 'a', value: 1 }),
          createFilterNode('comparison', { operator: '==', propertyName: 'b', value: 2 }),
        ],
      });
      expect(FilterTransformer.toGeoStyler(node)).toEqual([
        '||',
        ['==', 'a', 1],
        ['==', 'b', 2],
      ]);
    });

    it('converts NOT node', () => {
      const node = createFilterNode('not', {
        children: [createFilterNode('comparison', { operator: '==', propertyName: 'a', value: 1 })],
      });
      expect(FilterTransformer.toGeoStyler(node)).toEqual(['!', ['==', 'a', 1]]);
    });

    it('throws when AND has no children', () => {
      const node = createFilterNode('and', { children: [] });
      expect(() => FilterTransformer.toGeoStyler(node)).toThrow();
    });

    it('throws when NOT has more than one child', () => {
      const node = createFilterNode('not', {
        children: [
          createFilterNode('comparison', { operator: '==', propertyName: 'a', value: 1 }),
          createFilterNode('comparison', { operator: '==', propertyName: 'b', value: 2 }),
        ],
      });
      expect(() => FilterTransformer.toGeoStyler(node)).toThrow();
    });
  });

  describe('fromGeoStyler', () => {
    it('parses comparison filter', () => {
      const node = FilterTransformer.fromGeoStyler(['==', 'name', 'school']);
      expect(node.type).toBe('comparison');
      expect(node.operator).toBe('==');
      expect(node.propertyName).toBe('name');
      expect(node.value).toBe('school');
    });

    it('parses AND filter', () => {
      const node = FilterTransformer.fromGeoStyler([
        '&&',
        ['==', 'a', 1],
        ['>', 'b', 2],
      ]);
      expect(node.type).toBe('and');
      expect(node.children).toHaveLength(2);
      expect(node.children![0].type).toBe('comparison');
      expect(node.children![1].operator).toBe('>');
    });

    it('parses NOT filter', () => {
      const node = FilterTransformer.fromGeoStyler(['!', ['==', 'a', 1]]);
      expect(node.type).toBe('not');
      expect(node.children).toHaveLength(1);
      expect(node.children![0].type).toBe('comparison');
    });

    it('marks unsupported function as unsupported comparison', () => {
      const node = FilterTransformer.fromGeoStyler(['fnc_buffer', 'geom', 100] as any);
      expect(node.type).toBe('comparison');
      expect(node.propertyName).toBe('__unsupported__');
      expect(node.value).toBe(JSON.stringify(['fnc_buffer', 'geom', 100]));
    });
  });

  describe('round-trip', () => {
    it('preserves nested filter structure', () => {
      const original: FilterNode = createFilterNode('and', {
        children: [
          createFilterNode('or', {
            children: [
              createFilterNode('comparison', { operator: '==', propertyName: 'a', value: 1 }),
              createFilterNode('comparison', { operator: '==', propertyName: 'b', value: 2 }),
            ],
          }),
          createFilterNode('not', {
            children: [
              createFilterNode('comparison', { operator: '*=', propertyName: 'name', value: '%x%' }),
            ],
          }),
        ],
      });

      const geoStyler = FilterTransformer.toGeoStyler(original);
      const restored = FilterTransformer.fromGeoStyler(geoStyler);

      expect(restored.type).toBe('and');
      expect(restored.children).toHaveLength(2);
      expect(restored.children![0].type).toBe('or');
      expect(restored.children![1].type).toBe('not');
      expect(restored.children![1].children![0].operator).toBe('*=');
    });
  });
});

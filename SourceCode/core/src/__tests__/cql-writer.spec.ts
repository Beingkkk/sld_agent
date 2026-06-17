import { describe, it, expect } from 'vitest';
import { CqlWriter } from '../cql-writer.js';
import { createFilterNode } from '../filter-transformer.js';

describe('CqlWriter', () => {
  it('writes simple equality', () => {
    const node = createFilterNode('comparison', {
      operator: '==',
      propertyName: 'name',
      value: 'school',
    });
    expect(CqlWriter.write(node)).toBe("name = 'school'");
  });

  it('writes numeric comparison', () => {
    const node = createFilterNode('comparison', {
      operator: '>',
      propertyName: 'population',
      value: 1000,
    });
    expect(CqlWriter.write(node)).toBe('population > 1000');
  });

  it('writes LIKE comparison', () => {
    const node = createFilterNode('comparison', {
      operator: '*=',
      propertyName: 'name',
      value: '%学校%',
    });
    expect(CqlWriter.write(node)).toBe("name LIKE '%学校%'");
  });

  it('escapes single quotes in string values', () => {
    const node = createFilterNode('comparison', {
      operator: '==',
      propertyName: 'name',
      value: "O'Brien",
    });
    expect(CqlWriter.write(node)).toBe("name = 'O''Brien'");
  });

  it('writes AND with parentheses around nested logic', () => {
    const node = createFilterNode('and', {
      children: [
        createFilterNode('comparison', { operator: '==', propertyName: 'a', value: 1 }),
        createFilterNode('comparison', { operator: '>', propertyName: 'b', value: 2 }),
      ],
    });
    expect(CqlWriter.write(node)).toBe('a = 1 AND b > 2');
  });

  it('writes OR with parentheses', () => {
    const node = createFilterNode('or', {
      children: [
        createFilterNode('and', {
          children: [
            createFilterNode('comparison', { operator: '==', propertyName: 'a', value: 1 }),
            createFilterNode('comparison', { operator: '==', propertyName: 'b', value: 2 }),
          ],
        }),
        createFilterNode('comparison', { operator: '==', propertyName: 'c', value: 3 }),
      ],
    });
    expect(CqlWriter.write(node)).toBe('(a = 1 AND b = 2) OR c = 3');
  });

  it('writes NOT', () => {
    const node = createFilterNode('not', {
      children: [
        createFilterNode('comparison', { operator: '==', propertyName: 'a', value: 1 }),
      ],
    });
    expect(CqlWriter.write(node)).toBe('NOT a = 1');
  });

  it('writes NOT around nested logic with parentheses', () => {
    const node = createFilterNode('not', {
      children: [
        createFilterNode('or', {
          children: [
            createFilterNode('comparison', { operator: '==', propertyName: 'a', value: 1 }),
            createFilterNode('comparison', { operator: '==', propertyName: 'b', value: 2 }),
          ],
        }),
      ],
    });
    expect(CqlWriter.write(node)).toBe('NOT (a = 1 OR b = 2)');
  });
});

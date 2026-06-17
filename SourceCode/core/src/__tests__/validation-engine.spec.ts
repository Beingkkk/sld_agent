import { describe, it, expect } from 'vitest';
import { ValidationEngine, TreePath } from '../index.js';
import type { SLDRoot, FeatureTypeStyleNode, RuleNode, SymbolizerNode } from '../index.js';

function createMinimalRoot(rules: RuleNode[]): SLDRoot {
  const fts: FeatureTypeStyleNode = {
    id: 'fts_1',
    type: 'FeatureTypeStyle',
    data: { title: '', abstract: '', featureTypeName: '' },
    children: rules,
  };
  return {
    version: '1.0.0',
    namedLayer: {
      id: 'nl_1',
      type: 'NamedLayer',
      data: { name: 'test_layer' },
      children: [
        {
          id: 'us_1',
          type: 'UserStyle',
          data: { name: 'test_style', title: '', abstract: '', isDefault: false },
          children: [fts],
        },
      ],
    },
  };
}

function createRule(name: string, overrides: Partial<RuleNode['data']> = {}, symbolizers?: SymbolizerNode[]): RuleNode {
  return {
    id: `rule_${name}`,
    type: 'Rule',
    data: {
      name,
      title: '',
      abstract: '',
      elseFilter: false,
      scaleDenominator: { min: null, max: null },
      filter: null,
      ...overrides,
    },
    children: symbolizers === undefined
      ? [{
          id: 'sym_1',
          type: 'Symbolizer',
          kind: 'Mark',
          data: { markWellKnownName: 'circle' },
          children: [],
        }]
      : symbolizers,
  };
}

describe('ValidationEngine', () => {
  describe('Rule must have at least one Symbolizer', () => {
    it('returns error when Rule has no Symbolizers', () => {
      const root = createMinimalRoot([
        createRule('rule1', {}, []),
      ]);
      const engine = new ValidationEngine();
      const issues = engine.validate(root);

      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe('RULE_NO_SYMBOLIZER');
      expect(issues[0].severity).toBe('error');
      expect(issues[0].path.toArray()).toEqual([0, 0, 0, 0]);
    });

    it('passes when Rule has at least one Symbolizer', () => {
      const root = createMinimalRoot([createRule('rule1')]);
      const engine = new ValidationEngine();
      const issues = engine.validate(root);
      expect(issues).toHaveLength(0);
    });
  });

  describe('ElseFilter uniqueness', () => {
    it('returns error when two Rules in same FeatureTypeStyle have elseFilter', () => {
      const root = createMinimalRoot([
        createRule('rule1', { elseFilter: true }),
        createRule('rule2', { elseFilter: true }),
      ]);
      const engine = new ValidationEngine();
      const issues = engine.validate(root);

      const elseFilterIssues = issues.filter((i) => i.code === 'ELSEFILTER_DUPLICATE');
      expect(elseFilterIssues).toHaveLength(1);
      expect(elseFilterIssues[0].severity).toBe('error');
      expect(elseFilterIssues[0].path.toArray()).toEqual([0, 0, 0, 1]);
    });

    it('passes when only one Rule has elseFilter', () => {
      const root = createMinimalRoot([
        createRule('rule1', { elseFilter: true }),
        createRule('rule2'),
      ]);
      const engine = new ValidationEngine();
      const issues = engine.validate(root);
      expect(issues).toHaveLength(0);
    });
  });

  describe('Scale denominator validation', () => {
    it('returns error when min >= max', () => {
      const root = createMinimalRoot([
        createRule('rule1', { scaleDenominator: { min: 1000, max: 500 } }),
      ]);
      const engine = new ValidationEngine();
      const issues = engine.validate(root);

      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe('SCALE_DENOMINATOR_INVALID');
      expect(issues[0].severity).toBe('error');
    });

    it('passes when min < max', () => {
      const root = createMinimalRoot([
        createRule('rule1', { scaleDenominator: { min: 500, max: 1000 } }),
      ]);
      const engine = new ValidationEngine();
      const issues = engine.validate(root);
      expect(issues).toHaveLength(0);
    });

    it('passes when only min is set', () => {
      const root = createMinimalRoot([
        createRule('rule1', { scaleDenominator: { min: 500, max: null } }),
      ]);
      const engine = new ValidationEngine();
      const issues = engine.validate(root);
      expect(issues).toHaveLength(0);
    });

    it('passes when only max is set', () => {
      const root = createMinimalRoot([
        createRule('rule1', { scaleDenominator: { min: null, max: 1000 } }),
      ]);
      const engine = new ValidationEngine();
      const issues = engine.validate(root);
      expect(issues).toHaveLength(0);
    });
  });

  describe('Multiple issues', () => {
    it('reports all issues in a single tree', () => {
      const root = createMinimalRoot([
        createRule('rule1', { elseFilter: true, scaleDenominator: { min: 1000, max: 500 } }, []),
        createRule('rule2', { elseFilter: true }),
      ]);
      const engine = new ValidationEngine();
      const issues = engine.validate(root);

      expect(issues).toHaveLength(3);
      expect(issues.map((i) => i.code).sort()).toEqual([
        'ELSEFILTER_DUPLICATE',
        'RULE_NO_SYMBOLIZER',
        'SCALE_DENOMINATOR_INVALID',
      ]);
    });
  });
});

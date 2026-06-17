import {
  type SLDRoot,
  type NamedLayerNode,
  type UserStyleNode,
  type FeatureTypeStyleNode,
  type RuleNode,
  type SymbolizerNode,
  type ValidationIssue,
  TreePath,
} from './types.js';

export class ValidationEngine {
  validate(tree: SLDRoot): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const namedLayer = tree.namedLayer;
    const userStyle = namedLayer.children[0];

    for (let f = 0; f < userStyle.children.length; f++) {
      const fts = userStyle.children[f];
      const ftsPath = new TreePath([0, 0, f]);

      let elseFilterCount = 0;

      for (let r = 0; r < fts.children.length; r++) {
        const rule = fts.children[r];
        const rulePath = ftsPath.child(r);

        // Rule must have at least one Symbolizer
        if (rule.children.length === 0) {
          issues.push({
            path: rulePath,
            code: 'RULE_NO_SYMBOLIZER',
            message: 'Rule must contain at least one Symbolizer',
            severity: 'error',
          });
        }

        // ElseFilter uniqueness within FeatureTypeStyle
        if (rule.data.elseFilter) {
          elseFilterCount++;
          if (elseFilterCount > 1) {
            issues.push({
              path: rulePath,
              code: 'ELSEFILTER_DUPLICATE',
              message: 'Only one Rule per FeatureTypeStyle may have ElseFilter enabled',
              severity: 'error',
            });
          }
        }

        // Scale denominator validation
        const { min, max } = rule.data.scaleDenominator;
        if (min !== null && max !== null && min >= max) {
          issues.push({
            path: rulePath,
            code: 'SCALE_DENOMINATOR_INVALID',
            message: 'Minimum scale denominator must be less than maximum scale denominator',
            severity: 'error',
          });
        }
      }
    }

    return issues;
  }
}

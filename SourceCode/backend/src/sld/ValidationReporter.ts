import type { ValidationError, ValidationReport, ValidationResult } from '@sldagent/shared/types';

/**
 * 将多个独立校验结果聚合成统一的 ValidationReport。
 */
export class ValidationReporter {
  report(results: { xsd?: ValidationResult; roundtrip?: ValidationResult }): ValidationReport {
    const errors: ValidationError[] = [];

    if (results.xsd && !results.xsd.passed) {
      errors.push({
        source: 'xsd',
        message: results.xsd.message || 'XSD validation failed',
      });
    }

    if (results.roundtrip && !results.roundtrip.passed) {
      errors.push({
        source: 'roundtrip',
        message: results.roundtrip.message || 'Roundtrip validation failed',
      });
    }

    return {
      passed: errors.length === 0,
      xsd: results.xsd,
      roundtrip: results.roundtrip,
      errors,
    };
  }
}

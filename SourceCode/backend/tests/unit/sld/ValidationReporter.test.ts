import { describe, it, expect } from 'vitest';
import { ValidationReporter } from '../../../src/sld/ValidationReporter.js';
import type { ValidationResult } from '../../../src/shared/types.js';

describe('ValidationReporter', () => {
  const reporter = new ValidationReporter();

  const passed: ValidationResult = { passed: true, tool: 'xmllint-wasm' };
  const failedXsd: ValidationResult = { passed: false, tool: 'xmllint-wasm', message: 'XSD error' };
  const failedRoundtrip: ValidationResult = { passed: false, tool: 'geostyler-sld-parser', message: 'Mismatch' };

  it('reports all passed', () => {
    const report = reporter.report({ xsd: passed, roundtrip: passed });
    expect(report.passed).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it('reports xsd failure', () => {
    const report = reporter.report({ xsd: failedXsd, roundtrip: passed });
    expect(report.passed).toBe(false);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].source).toBe('xsd');
    expect(report.errors[0].message).toBe('XSD error');
  });

  it('reports roundtrip failure', () => {
    const report = reporter.report({ xsd: passed, roundtrip: failedRoundtrip });
    expect(report.passed).toBe(false);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].source).toBe('roundtrip');
    expect(report.errors[0].message).toBe('Mismatch');
  });

  it('reports multiple failures', () => {
    const report = reporter.report({ xsd: failedXsd, roundtrip: failedRoundtrip });
    expect(report.passed).toBe(false);
    expect(report.errors).toHaveLength(2);
  });
});

import { describe, it, expect } from 'vitest';
import { StyleParamsValidator } from '../../src/style/validation/StyleParamsValidator';

describe('StyleParamsValidator', () => {
  it('accepts valid simple point params', () => {
    const validator = new StyleParamsValidator();
    const result = validator.validateParams({
      style_name: 'red point',
      geometry_type: 'point',
      style_type: 'simple',
      fill_color: '#FF0000',
      size: 8,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects params missing required fields', () => {
    const validator = new StyleParamsValidator();
    const result = validator.validateParams({
      style_name: 'invalid',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects unknown fields', () => {
    const validator = new StyleParamsValidator();
    const result = validator.validateParams({
      style_name: 'red point',
      geometry_type: 'point',
      style_type: 'simple',
      unknown_field: 'x',
    });
    expect(result.valid).toBe(false);
  });
});

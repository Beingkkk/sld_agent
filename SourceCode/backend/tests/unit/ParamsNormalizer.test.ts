import { describe, it, expect } from 'vitest';
import { ParamsNormalizer } from '../../src/style/normalization/ParamsNormalizer';

describe('ParamsNormalizer', () => {
  it('maps font_color to stroke_color', () => {
    const normalizer = new ParamsNormalizer();
    const result = normalizer.normalize({
      style_name: 'text',
      geometry_type: 'point',
      style_type: 'text',
      font_color: '#000000',
    });
    expect(result.stroke_color).toBe('#000000');
    expect(result.font_color).toBeUndefined();
  });

  it('maps font_name to font_family', () => {
    const normalizer = new ParamsNormalizer();
    const result = normalizer.normalize({
      style_name: 'text',
      geometry_type: 'point',
      style_type: 'text',
      font_name: 'Arial',
    });
    expect(result.font_family).toBe('Arial');
    expect(result.font_name).toBeUndefined();
  });

  it('does not override canonical field when both alias and canonical exist', () => {
    const normalizer = new ParamsNormalizer();
    const result = normalizer.normalize({
      style_name: 'text',
      geometry_type: 'point',
      style_type: 'text',
      font_color: '#FF0000',
      stroke_color: '#000000',
    });
    expect(result.stroke_color).toBe('#000000');
  });
});

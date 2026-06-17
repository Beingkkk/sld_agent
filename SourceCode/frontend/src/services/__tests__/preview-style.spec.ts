import { describe, it, expect } from 'vitest';
import { buildSymbolizerPreviewStyle } from '../preview-style';

describe('buildSymbolizerPreviewStyle', () => {
  it('returns null for non-Symbolizer node', () => {
    expect(buildSymbolizerPreviewStyle({ type: 'Rule', data: {} })).toBeNull();
    expect(buildSymbolizerPreviewStyle(null)).toBeNull();
    expect(buildSymbolizerPreviewStyle(undefined)).toBeNull();
  });

  it('builds a single-Symbolizer GeoStyler Style for Mark', () => {
    const node = {
      type: 'Symbolizer',
      kind: 'Mark' as const,
      data: {
        markWellKnownName: 'square',
        markRadius: 8,
        markFillColor: '#00ff00',
      },
    };
    const style = buildSymbolizerPreviewStyle(node);

    expect(style).toMatchObject({
      name: 'preview',
      rules: [
        {
          name: 'preview',
          symbolizers: [
            {
              kind: 'Mark',
              wellKnownName: 'square',
              radius: 8,
              color: '#00ff00',
            },
          ],
        },
      ],
    });
    expect(style.rules[0].symbolizers).toHaveLength(1);
  });

  it('builds a single-Symbolizer GeoStyler Style for Line', () => {
    const node = {
      type: 'Symbolizer',
      kind: 'Line' as const,
      data: {
        lineColor: '#123456',
        lineWidth: 5,
      },
    };
    const style = buildSymbolizerPreviewStyle(node);

    expect(style.rules[0].symbolizers[0]).toMatchObject({
      kind: 'Line',
      color: '#123456',
      width: 5,
    });
  });
});

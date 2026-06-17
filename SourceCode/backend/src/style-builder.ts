import type { GeoStylerStyle, GeoStylerSymbolizer } from '@sldagent/core';

export interface StyleParams {
  name: string;
  symbolizers: GeoStylerSymbolizer[];
  rules?: Array<{
    name: string;
    symbolizers: GeoStylerSymbolizer[];
    filter?: unknown;
    scaleDenominator?: { min?: number; max?: number };
  }>;
}

export class StyleBuilder {
  /**
   * Build a GeoStyler Style from abstract parameters.
   * This is a basic implementation for MVP.
   */
  static build(params: StyleParams): GeoStylerStyle {
    const rules = params.rules ?? [
      {
        name: params.name,
        symbolizers: params.symbolizers,
      },
    ];

    return {
      name: params.name,
      rules: rules.map((r) => ({
        name: r.name,
        symbolizers: r.symbolizers,
        ...(r.filter ? { filter: r.filter } : {}),
        ...(r.scaleDenominator ? { scaleDenominator: r.scaleDenominator } : {}),
      })),
    };
  }

  /**
   * Create a simple single-symbolizer style.
   */
  static simple(name: string, symbolizer: GeoStylerSymbolizer): GeoStylerStyle {
    return StyleBuilder.build({
      name,
      symbolizers: [symbolizer],
    });
  }
}

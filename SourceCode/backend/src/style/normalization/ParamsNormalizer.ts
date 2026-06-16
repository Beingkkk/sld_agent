import type { StyleParams } from '@sldagent/shared/types';

const ALIAS_MAP: Record<string, keyof StyleParams> = {
  font_color: 'stroke_color',
  font_name: 'font_family',
};

export class ParamsNormalizer {
  normalize(params: Record<string, unknown> | StyleParams): StyleParams {
    const normalized = { ...(params as Record<string, unknown>) };
    for (const [alias, canonical] of Object.entries(ALIAS_MAP)) {
      if (alias in normalized && !(canonical in normalized)) {
        normalized[canonical] = normalized[alias];
        delete normalized[alias];
      }
    }
    return normalized as unknown as StyleParams;
  }
}

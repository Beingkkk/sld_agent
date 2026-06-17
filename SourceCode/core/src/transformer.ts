import {
  type SLDRoot,
  type NamedLayerNode,
  type UserStyleNode,
  type FeatureTypeStyleNode,
  type RuleNode,
  type SymbolizerNode,
  type SymbolizerKind,
  type GeoStylerStyle,
  type GeoStylerSymbolizer,
  type FeatureTypeStyleMeta,
  type ScaleDenominatorRange,
} from './types.js';
import { SymbolizerTransformer } from './symbolizer-transformer.js';
import { FilterTransformer } from './filter-transformer.js';
import type { ScaleDenominator, Rule as GeoStylerRule } from 'geostyler-style';

export class GeoStylerTransformer {
  static toGeoStyler(tree: SLDRoot): GeoStylerStyle {
    const namedLayer = tree.namedLayer;
    const userStyle = namedLayer.children[0];

    const rules: GeoStylerRule[] = [];
    for (const fts of userStyle.children) {
      for (const rule of fts.children) {
        const geoRule = GeoStylerTransformer.ruleToGeoStyler(rule, fts);
        rules.push(geoRule);
      }
    }

    return {
      name: userStyle.data.name || 'default',
      rules,
    };
  }

  static fromGeoStyler(
    style: GeoStylerStyle,
    featureTypeStyleMeta?: FeatureTypeStyleMeta[]
  ): SLDRoot {
    const metaList = featureTypeStyleMeta || [
      { title: '', abstract: '', featureTypeName: '' },
    ];

    const rules = style.rules || [];
    const allRules: RuleNode[] = [];
    for (const geoRule of rules) {
      allRules.push(GeoStylerTransformer.ruleFromGeoStyler(geoRule));
    }

    const featureTypeStyles: FeatureTypeStyleNode[] = [];
    if (metaList.length === 1) {
      featureTypeStyles.push({
        id: `fts_${Date.now()}`,
        type: 'FeatureTypeStyle',
        data: {
          title: metaList[0].title,
          abstract: metaList[0].abstract,
          featureTypeName: metaList[0].featureTypeName,
        },
        children: allRules,
      });
    } else {
      for (const meta of metaList) {
        featureTypeStyles.push({
          id: `fts_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          type: 'FeatureTypeStyle',
          data: {
            title: meta.title,
            abstract: meta.abstract,
            featureTypeName: meta.featureTypeName,
          },
          children: [],
        });
      }
      if (allRules.length > 0 && featureTypeStyles.length > 0) {
        featureTypeStyles[0].children = allRules;
      }
    }

    const userStyle: UserStyleNode = {
      id: `us_${Date.now()}`,
      type: 'UserStyle',
      data: {
        name: style.name || 'default_style',
        title: '',
        abstract: '',
        isDefault: false,
      },
      children: featureTypeStyles,
    };

    const namedLayer: NamedLayerNode = {
      id: `nl_${Date.now()}`,
      type: 'NamedLayer',
      data: { name: 'default_layer' },
      children: [userStyle],
    };

    return {
      version: '1.0.0',
      namedLayer,
    };
  }

  private static ruleToGeoStyler(rule: RuleNode, fts: FeatureTypeStyleNode): GeoStylerRule {
    const symbolizers: GeoStylerSymbolizer[] = [];
    for (const sym of rule.children) {
      symbolizers.push(SymbolizerTransformer.toGeoStyler(sym.kind, sym.data));
    }

    const scaleDenominator: ScaleDenominator = {};
    if (rule.data.scaleDenominator.min !== null) {
      scaleDenominator.min = rule.data.scaleDenominator.min as number;
    }
    if (rule.data.scaleDenominator.max !== null) {
      scaleDenominator.max = rule.data.scaleDenominator.max as number;
    }

    const geoRule: GeoStylerRule = {
      name: rule.data.name,
      symbolizers,
    };

    if (rule.data.filter) {
      geoRule.filter = FilterTransformer.toGeoStyler(rule.data.filter);
    }
    if (Object.keys(scaleDenominator).length > 0) {
      geoRule.scaleDenominator = scaleDenominator;
    }

    return geoRule;
  }

  private static ruleFromGeoStyler(geoRule: GeoStylerRule): RuleNode {
    const symbolizers: SymbolizerNode[] = [];
    if (geoRule.symbolizers) {
      for (const geoSym of geoRule.symbolizers) {
        symbolizers.push(SymbolizerTransformer.fromGeoStyler(geoSym));
      }
    }

    if (symbolizers.length === 0) {
      symbolizers.push(SymbolizerTransformer.createDefault('Mark'));
    }

    const scaleDenominator: ScaleDenominatorRange = { min: null, max: null };
    if (geoRule.scaleDenominator) {
      if (geoRule.scaleDenominator.min !== undefined) {
        scaleDenominator.min = geoRule.scaleDenominator.min as number;
      }
      if (geoRule.scaleDenominator.max !== undefined) {
        scaleDenominator.max = geoRule.scaleDenominator.max as number;
      }
    }

    return {
      id: `rule_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: 'Rule',
      data: {
        name: geoRule.name || 'rule',
        title: '',
        abstract: '',
        elseFilter: false,
        scaleDenominator,
        filter: geoRule.filter ? FilterTransformer.fromGeoStyler(geoRule.filter) : null,
      },
      children: symbolizers,
    };
  }
}
